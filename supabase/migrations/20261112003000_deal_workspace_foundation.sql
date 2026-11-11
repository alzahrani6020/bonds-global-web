-- Bonds Deal Operating System - foundation.
-- Additive only. No DROP/TRUNCATE/DELETE/REINDEX operations.

create table if not exists public.bonds_deals (
  id uuid primary key default gen_random_uuid(),
  deal_number text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  deal_type text not null default 'other'
    check (deal_type in ('funding','investment','ma_buy','ma_sell','joint_venture','restructuring','other')),
  stage text not null default 'draft'
    check (stage in ('draft','preparation','due_diligence','marketing','offers','negotiation','approvals','closing','closed','on_hold')),
  status text not null default 'active'
    check (status in ('active','on_hold','closed','cancelled')),
  currency text not null default 'SAR',
  target_value numeric,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_value is null or target_value >= 0)
);

create index if not exists idx_bonds_deals_user_stage
  on public.bonds_deals(user_id, stage, updated_at desc);

create table if not exists public.bonds_deal_parties (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  name text not null,
  party_role text not null default 'other'
    check (party_role in ('client','buyer','seller','investor','lender','advisor','legal','auditor','other')),
  organization text,
  email text,
  phone text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bonds_deal_parties_deal
  on public.bonds_deal_parties(deal_id, created_at);

create table if not exists public.bonds_deal_tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  title text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','blocked','completed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  due_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bonds_deal_tasks_work
  on public.bonds_deal_tasks(deal_id, status, due_at);

create table if not exists public.bonds_deal_due_diligence_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  area text not null
    check (area in ('financial','commercial','legal','tax','operational','technical','governance')),
  title text not null,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','blocked','complete','not_applicable')),
  risk_rating text
    check (risk_rating is null or risk_rating in ('low','medium','high','critical')),
  finding text,
  owner_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bonds_deal_dd_status
  on public.bonds_deal_due_diligence_items(deal_id, area, status);

create table if not exists public.bonds_deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.bonds_deals(id) on delete cascade,
  name text not null,
  category text not null default 'general',
  status text not null default 'requested'
    check (status in ('requested','received','reviewed','approved','rejected')),
  confidentiality text not null default 'confidential'
    check (confidentiality in ('standard','confidential','restricted')),
  storage_bucket text,
  storage_path text,
  version integer not null default 1 check (version >= 1),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bonds_deal_documents_deal
  on public.bonds_deal_documents(deal_id, category, status, created_at desc);

create or replace function public.touch_bonds_deal_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deals_updated_at'
      and tgrelid = 'public.bonds_deals'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deals_updated_at
    before update on public.bonds_deals
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_tasks_updated_at'
      and tgrelid = 'public.bonds_deal_tasks'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_tasks_updated_at
    before update on public.bonds_deal_tasks
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_dd_updated_at'
      and tgrelid = 'public.bonds_deal_due_diligence_items'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_dd_updated_at
    before update on public.bonds_deal_due_diligence_items
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_bonds_deal_documents_updated_at'
      and tgrelid = 'public.bonds_deal_documents'::regclass
      and not tgisinternal
  ) then
    create trigger trg_bonds_deal_documents_updated_at
    before update on public.bonds_deal_documents
    for each row execute function public.touch_bonds_deal_updated_at();
  end if;
end;
$$;

alter table public.bonds_deals enable row level security;
alter table public.bonds_deal_parties enable row level security;
alter table public.bonds_deal_tasks enable row level security;
alter table public.bonds_deal_due_diligence_items enable row level security;
alter table public.bonds_deal_documents enable row level security;

create policy bonds_deals_owner_all on public.bonds_deals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy bonds_deal_parties_owner_all on public.bonds_deal_parties
  for all to authenticated
  using (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ));

create policy bonds_deal_tasks_owner_all on public.bonds_deal_tasks
  for all to authenticated
  using (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ));

create policy bonds_deal_dd_owner_all on public.bonds_deal_due_diligence_items
  for all to authenticated
  using (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ));

create policy bonds_deal_documents_owner_all on public.bonds_deal_documents
  for all to authenticated
  using (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.bonds_deals d
    where d.id = deal_id and d.user_id = auth.uid()
  ));

revoke all on public.bonds_deals from anon;
revoke all on public.bonds_deal_parties from anon;
revoke all on public.bonds_deal_tasks from anon;
revoke all on public.bonds_deal_due_diligence_items from anon;
revoke all on public.bonds_deal_documents from anon;

grant select, insert, update on public.bonds_deals to authenticated;
grant select, insert, update on public.bonds_deal_parties to authenticated;
grant select, insert, update on public.bonds_deal_tasks to authenticated;
grant select, insert, update on public.bonds_deal_due_diligence_items to authenticated;
grant select, insert, update on public.bonds_deal_documents to authenticated;

grant all on public.bonds_deals to service_role;
grant all on public.bonds_deal_parties to service_role;
grant all on public.bonds_deal_tasks to service_role;
grant all on public.bonds_deal_due_diligence_items to service_role;
grant all on public.bonds_deal_documents to service_role;
