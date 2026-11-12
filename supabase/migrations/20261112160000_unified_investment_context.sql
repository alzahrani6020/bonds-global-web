-- BONDS unified investment context.
-- Additive only. No destructive DDL/DML.

create table if not exists public.bonds_investment_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.bonds_projects(id) on delete set null,
  deal_id uuid references public.bonds_deals(id) on delete set null,
  source_type text not null default 'manual'
    check (source_type in ('opportunity_bank','investment_map','direct','manual','imported')),
  source_key text,
  title text not null,
  country_code text,
  city_code text,
  sector_code text,
  activity_code text,
  score numeric,
  status text not null default 'saved'
    check (status in ('saved','qualified','converted','archived')),
  summary text,
  snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score is null or (score >= 0 and score <= 100))
);

create unique index if not exists uq_bonds_investment_opportunities_source
  on public.bonds_investment_opportunities(user_id,source_type,source_key)
  where source_key is not null;
create index if not exists idx_bonds_investment_opportunities_project
  on public.bonds_investment_opportunities(project_id,updated_at desc)
  where project_id is not null;
create index if not exists idx_bonds_investment_opportunities_deal
  on public.bonds_investment_opportunities(deal_id,updated_at desc)
  where deal_id is not null;

create table if not exists public.bonds_investment_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid references public.bonds_investment_opportunities(id) on delete set null,
  project_id uuid references public.bonds_projects(id) on delete set null,
  deal_id uuid references public.bonds_deals(id) on delete set null,
  artifact_type text not null
    check (artifact_type in (
      'opportunity_snapshot','investment_map','city_comparison','scenario',
      'feasibility','risk','valuation','readiness','direct_interest'
    )),
  title text,
  source_url text,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'saved'
    check (status in ('draft','saved','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opportunity_id is not null or project_id is not null or deal_id is not null)
);

create index if not exists idx_bonds_investment_artifacts_project
  on public.bonds_investment_artifacts(project_id,artifact_type,updated_at desc);
create index if not exists idx_bonds_investment_artifacts_opportunity
  on public.bonds_investment_artifacts(opportunity_id,artifact_type,updated_at desc);
create index if not exists idx_bonds_investment_artifacts_deal
  on public.bonds_investment_artifacts(deal_id,artifact_type,updated_at desc);

alter table public.asset_valuations
  add column if not exists project_id uuid references public.bonds_projects(id) on delete set null;
alter table public.asset_valuations
  add column if not exists deal_id uuid references public.bonds_deals(id) on delete set null;
alter table public.asset_valuations
  add column if not exists opportunity_id uuid references public.bonds_investment_opportunities(id) on delete set null;

create index if not exists idx_asset_valuations_project_id
  on public.asset_valuations(project_id,created_at desc)
  where project_id is not null;
create index if not exists idx_asset_valuations_deal_id
  on public.asset_valuations(deal_id,created_at desc)
  where deal_id is not null;

create table if not exists public.bonds_investment_interest_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  city text,
  amount_band text,
  investor_type text,
  message text,
  source text not null default 'investment-opportunities-page',
  status text not null default 'new'
    check (status in ('new','qualified','converted','closed')),
  opportunity_id uuid references public.bonds_investment_opportunities(id) on delete set null,
  deal_id uuid references public.bonds_deals(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_bonds_investment_context_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='trg_bonds_investment_opportunities_updated_at') then
    create trigger trg_bonds_investment_opportunities_updated_at
    before update on public.bonds_investment_opportunities
    for each row execute function public.touch_bonds_investment_context_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_bonds_investment_artifacts_updated_at') then
    create trigger trg_bonds_investment_artifacts_updated_at
    before update on public.bonds_investment_artifacts
    for each row execute function public.touch_bonds_investment_context_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='trg_bonds_investment_interest_leads_updated_at') then
    create trigger trg_bonds_investment_interest_leads_updated_at
    before update on public.bonds_investment_interest_leads
    for each row execute function public.touch_bonds_investment_context_updated_at();
  end if;
end;
$$;

alter table public.bonds_investment_opportunities enable row level security;
alter table public.bonds_investment_artifacts enable row level security;
alter table public.bonds_investment_interest_leads enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_investment_opportunities' and policyname='bonds_investment_opportunities_owner_all') then
    create policy bonds_investment_opportunities_owner_all on public.bonds_investment_opportunities
      for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bonds_investment_artifacts' and policyname='bonds_investment_artifacts_owner_all') then
    create policy bonds_investment_artifacts_owner_all on public.bonds_investment_artifacts
      for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end;
$$;

revoke all on public.bonds_investment_opportunities from anon;
revoke all on public.bonds_investment_artifacts from anon;
revoke all on public.bonds_investment_interest_leads from anon;

grant select,insert,update on public.bonds_investment_opportunities to authenticated;
grant select,insert,update on public.bonds_investment_artifacts to authenticated;

grant all on public.bonds_investment_opportunities to service_role;
grant all on public.bonds_investment_artifacts to service_role;
grant all on public.bonds_investment_interest_leads to service_role;
