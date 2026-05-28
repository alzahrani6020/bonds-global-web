-- ============================================
-- Bonds Global SaaS Schema — Phase 1
-- ============================================
-- Run this in Supabase SQL Editor (New Query)

-- -------------------------------------------
-- 1. Profiles (extends auth.users)
-- -------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  restaurant_name text,
  country text,
  language text default 'ar',
  tier text default 'free' check (tier in ('free','pro','enterprise')),
  status text default 'active' check (status in ('active','inactive','trialing','past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.profiles is 'User profiles extending Supabase Auth';

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, restaurant_name, country, language)
  values (
    new.id,
    new.raw_user_meta_data->>'restaurant_name',
    new.raw_user_meta_data->>'country',
    coalesce(new.raw_user_meta_data->>'language', 'ar')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------
-- 2. Subscriptions
-- -------------------------------------------
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  tier text not null check (tier in ('free','pro','enterprise')),
  status text not null default 'inactive' check (status in ('active','inactive','trialing','past_due','cancelled')),
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

comment on table public.subscriptions is 'Stripe-linked subscription records';

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Only service_role / Edge Functions can insert/update subscriptions
-- (Stripe webhooks will call Edge Function with service_role key)

-- -------------------------------------------
-- 3. Scenarios (saved calculator inputs)
-- -------------------------------------------
create table if not exists public.scenarios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  country text not null,
  inputs jsonb not null,        -- full calculator inputs object
  results jsonb,                -- cached calculation results
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.scenarios is 'Saved restaurant calculator scenarios';

alter table public.scenarios enable row level security;

create policy "Users can CRUD own scenarios"
  on public.scenarios for all
  using (auth.uid() = user_id);

-- Public scenarios readable by anyone

create policy "Public scenarios are readable"
  on public.scenarios for select
  using (is_public = true);

-- -------------------------------------------
-- 4. Health Scores (history)
-- -------------------------------------------
create table if not exists public.health_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  scenario_id uuid references public.scenarios on delete set null,
  country text not null,
  score integer not null check (score >= 0 and score <= 100),
  breakdown jsonb not null,     -- { profitScore, foodCostScore, commissionScore, breakEvenScore }
  inputs_snapshot jsonb,        -- inputs at time of scoring
  created_at timestamptz default now()
);

comment on table public.health_scores is 'Restaurant health score history';

alter table public.health_scores enable row level security;

create policy "Users can read own health scores"
  on public.health_scores for select
  using (auth.uid() = user_id);

create policy "Users can insert own health scores"
  on public.health_scores for insert
  with check (auth.uid() = user_id);

-- -------------------------------------------
-- 5. Invoice Corrections (actual vs estimated)
-- -------------------------------------------
create table if not exists public.invoice_corrections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  country text not null,
  platform_id text not null,
  estimated_fee numeric(5,2) not null,
  actual_fee numeric(5,2) not null,
  difference numeric(5,2) generated always as (actual_fee - estimated_fee) stored,
  notes text,
  invoice_date date,
  created_at timestamptz default now(),
  unique(user_id, country, platform_id)
);

comment on table public.invoice_corrections is 'User-verified actual platform fees vs estimates';

alter table public.invoice_corrections enable row level security;

create policy "Users can CRUD own corrections"
  on public.invoice_corrections for all
  using (auth.uid() = user_id);

-- -------------------------------------------
-- 6. Webhook Events (Stripe audit log)
-- -------------------------------------------
create table if not exists public.webhook_events (
  id uuid default gen_random_uuid() primary key,
  stripe_event_id text unique not null,
  event_type text not null,
  payload jsonb not null,
  processed boolean default false,
  created_at timestamptz default now()
);

comment on table public.webhook_events is 'Incoming Stripe webhook audit log';

-- Only service_role can write
alter table public.webhook_events enable row level security;

-- -------------------------------------------
-- 7. Functions
-- -------------------------------------------

-- Count scenarios for a user (for free tier limit)
create or replace function public.count_user_scenarios(p_user_id uuid)
returns integer as $$
  select count(*)::int from public.scenarios where user_id = p_user_id;
$$ language sql stable;

-- Count countries used by user (for free tier limit)
create or replace function public.count_user_countries(p_user_id uuid)
returns integer as $$
  select count(distinct country)::int from public.scenarios where user_id = p_user_id;
$$ language sql stable;

-- Get user tier + limits
create or replace function public.get_user_limits(p_user_id uuid)
returns json as $$
declare
  v_tier text;
  v_status text;
begin
  select tier, status into v_tier, v_status
  from public.subscriptions where user_id = p_user_id;

  if v_tier is null then
    v_tier := 'free';
    v_status := 'inactive';
  end if;

  return json_build_object(
    'tier', v_tier,
    'status', v_status,
    'maxScenarios', case when v_tier in ('pro','enterprise') then null else 3 end,
    'maxCountries', case when v_tier in ('pro','enterprise') then null else 5 end,
    'pdfExport', v_tier in ('pro','enterprise') and v_status = 'active',
    'healthHistory', v_tier in ('pro','enterprise') and v_status = 'active',
    'apiAccess', v_tier in ('pro','enterprise') and v_status = 'active',
    'webhooks', v_tier = 'enterprise' and v_status = 'active',
    'emailParser', v_tier = 'enterprise' and v_status = 'active',
    'prioritySupport', v_tier = 'enterprise' and v_status = 'active'
  );
end;
$$ language plpgsql stable security definer;

-- -------------------------------------------
-- 8. Ingredients (Inventory)
-- -------------------------------------------
create table if not exists public.ingredients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  name_en text,
  category text default 'other',
  unit text not null,
  current_price numeric(10,2) not null default 0,
  vat_included boolean default true,
  supplier text,
  country text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.ingredients is 'User ingredient inventory for recipe costing';
alter table public.ingredients enable row level security;
create policy "Users can CRUD own ingredients"
  on public.ingredients for all
  using (auth.uid() = user_id);

-- -------------------------------------------
-- 9. Ingredient Price History
-- -------------------------------------------
create table if not exists public.ingredient_prices (
  id uuid default gen_random_uuid() primary key,
  ingredient_id uuid references public.ingredients on delete cascade not null,
  price numeric(10,2) not null,
  changed_at timestamptz default now()
);

comment on table public.ingredient_prices is 'Ingredient price change history';
alter table public.ingredient_prices enable row level security;
create policy "Users can read own ingredient prices"
  on public.ingredient_prices for select
  using (exists (select 1 from public.ingredients i where i.id = ingredient_id and i.user_id = auth.uid()));

-- -------------------------------------------
-- 10. Recipes (Dishes)
-- -------------------------------------------
create table if not exists public.recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  name_en text,
  country text,
  selling_price numeric(10,2),
  target_profit numeric(10,2) default 0,
  waste_buffer_pct numeric(5,2) default 5,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.recipes is 'User recipe/dish definitions';
alter table public.recipes enable row level security;
create policy "Users can CRUD own recipes"
  on public.recipes for all
  using (auth.uid() = user_id);

-- -------------------------------------------
-- 11. Recipe Ingredients (junction)
-- -------------------------------------------
create table if not exists public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes on delete cascade not null,
  ingredient_id uuid references public.ingredients on delete cascade not null,
  quantity numeric(10,3) not null default 0,
  unit text not null,
  created_at timestamptz default now(),
  unique(recipe_id, ingredient_id)
);

comment on table public.recipe_ingredients is 'Links recipes to ingredients with quantities';
alter table public.recipe_ingredients enable row level security;
create policy "Users can CRUD own recipe ingredients"
  on public.recipe_ingredients for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- -------------------------------------------
-- 12. VAT Transactions (ZATCA / Tax Authority)
-- -------------------------------------------
create table if not exists public.vat_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  transaction_type text not null check (transaction_type in ('output_sale','input_purchase')),
  platform_id text,
  amount_before_vat numeric(12,2) not null,
  vat_amount numeric(12,2) not null,
  vat_rate numeric(5,2) default 15,
  invoice_number text,
  transaction_date date default now(),
  created_at timestamptz default now()
);

comment on table public.vat_transactions is 'VAT input/output tracking for tax reconciliation';
alter table public.vat_transactions enable row level security;
create policy "Users can CRUD own vat transactions"
  on public.vat_transactions for all
  using (auth.uid() = user_id);

-- -------------------------------------------
-- 13. Indexes
-- -------------------------------------------
create index if not exists idx_scenarios_user on public.scenarios(user_id);
create index if not exists idx_scenarios_country on public.scenarios(country);
create index if not exists idx_health_scores_user on public.health_scores(user_id);
create index if not exists idx_health_scores_created on public.health_scores(created_at desc);
create index if not exists idx_corrections_user on public.invoice_corrections(user_id);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_webhook_events_stripe on public.webhook_events(stripe_event_id);
create index if not exists idx_ingredients_user on public.ingredients(user_id);
create index if not exists idx_ingredient_prices_ingredient on public.ingredient_prices(ingredient_id);
create index if not exists idx_recipes_user on public.recipes(user_id);
create index if not exists idx_recipe_ingredients_recipe on public.recipe_ingredients(recipe_id);
create index if not exists idx_vat_transactions_user on public.vat_transactions(user_id);
create index if not exists idx_vat_transactions_date on public.vat_transactions(transaction_date desc);

-- Auto-log ingredient price changes
create or replace function public.log_ingredient_price_change()
returns trigger as $$
begin
  if old.current_price is distinct from new.current_price then
    insert into public.ingredient_prices (ingredient_id, price)
    values (new.id, new.current_price);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ingredient_price_change on public.ingredients;
create trigger trg_ingredient_price_change
  after update on public.ingredients
  for each row execute function public.log_ingredient_price_change();
