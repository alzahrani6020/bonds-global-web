begin;

-- Wave 7: accounting depreciation + cost centers.
-- public.bonds_assets remains the canonical asset master from the governed
-- Asset / Collateral Registry. No parallel asset registry is created.

create table if not exists public.accounting_cost_centers (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  code text not null,
  name text not null,
  parent_id uuid,
  status text not null default 'active'
    check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, code),
  unique(accounting_entity_id, id),
  foreign key (accounting_entity_id, parent_id)
    references public.accounting_cost_centers(accounting_entity_id, id)
    on delete restrict
);

alter table public.accounting_journal_lines
  add column if not exists cost_center_id uuid;

alter table public.accounting_journal_lines
  drop constraint if exists accounting_journal_lines_entity_cost_center_fkey;

alter table public.accounting_journal_lines
  add constraint accounting_journal_lines_entity_cost_center_fkey
  foreign key (accounting_entity_id, cost_center_id)
  references public.accounting_cost_centers(accounting_entity_id, id)
  on delete restrict;

create table if not exists public.accounting_asset_depreciation_profiles (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  asset_id uuid not null,
  in_service_date date not null,
  depreciation_method text not null default 'straight_line'
    check (depreciation_method = 'straight_line'),
  depreciation_convention text not null default 'full_month'
    check (depreciation_convention = 'full_month'),
  asset_account_id uuid not null,
  accumulated_depreciation_account_id uuid not null,
  depreciation_expense_account_id uuid not null,
  cost_center_id uuid,
  status text not null default 'active'
    check (status in ('active','paused','fully_depreciated')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, asset_id),
  unique(accounting_entity_id, id),
  foreign key (accounting_entity_id, asset_id)
    references public.bonds_assets(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, asset_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, accumulated_depreciation_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, depreciation_expense_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, cost_center_id)
    references public.accounting_cost_centers(accounting_entity_id, id)
    on delete restrict
);

create table if not exists public.accounting_asset_depreciation_schedule (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null,
  depreciation_profile_id uuid not null,
  asset_id uuid not null,
  period_id uuid not null,
  depreciation_amount numeric(20,2) not null check (depreciation_amount >= 0),
  accumulated_depreciation numeric(20,2) not null check (accumulated_depreciation >= 0),
  ending_book_value numeric(20,2) not null check (ending_book_value >= 0),
  status text not null default 'scheduled'
    check (status in ('scheduled','posted','skipped')),
  financial_event_id uuid,
  journal_entry_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  unique(accounting_entity_id, depreciation_profile_id, period_id),
  foreign key (accounting_entity_id, depreciation_profile_id)
    references public.accounting_asset_depreciation_profiles(accounting_entity_id, id)
    on delete cascade,
  foreign key (accounting_entity_id, asset_id)
    references public.bonds_assets(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, period_id)
    references public.accounting_periods(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, financial_event_id)
    references public.financial_events(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, journal_entry_id)
    references public.accounting_journal_entries(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_accounting_cost_centers_entity_parent
  on public.accounting_cost_centers(accounting_entity_id, parent_id)
  where parent_id is not null;

create index if not exists idx_accounting_cost_centers_created_by
  on public.accounting_cost_centers(created_by)
  where created_by is not null;

create index if not exists idx_accounting_journal_lines_entity_cost_center
  on public.accounting_journal_lines(accounting_entity_id, cost_center_id)
  where cost_center_id is not null;

create index if not exists idx_depreciation_profiles_asset
  on public.accounting_asset_depreciation_profiles(accounting_entity_id, asset_id);

create index if not exists idx_depreciation_profiles_cost_center
  on public.accounting_asset_depreciation_profiles(accounting_entity_id, cost_center_id)
  where cost_center_id is not null;

create index if not exists idx_depreciation_profiles_created_by
  on public.accounting_asset_depreciation_profiles(created_by)
  where created_by is not null;

create index if not exists idx_depreciation_schedule_period
  on public.accounting_asset_depreciation_schedule(accounting_entity_id, period_id, status);

create index if not exists idx_depreciation_schedule_asset
  on public.accounting_asset_depreciation_schedule(accounting_entity_id, asset_id);

create index if not exists idx_depreciation_schedule_event
  on public.accounting_asset_depreciation_schedule(accounting_entity_id, financial_event_id)
  where financial_event_id is not null;

create index if not exists idx_depreciation_schedule_journal
  on public.accounting_asset_depreciation_schedule(accounting_entity_id, journal_entry_id)
  where journal_entry_id is not null;

alter table public.accounting_cost_centers enable row level security;
alter table public.accounting_asset_depreciation_profiles enable row level security;
alter table public.accounting_asset_depreciation_schedule enable row level security;

revoke all on public.accounting_cost_centers from anon, authenticated;
revoke all on public.accounting_asset_depreciation_profiles from anon, authenticated;
revoke all on public.accounting_asset_depreciation_schedule from anon, authenticated;

grant select, insert, update, delete on public.accounting_cost_centers to service_role;
grant select, insert, update, delete on public.accounting_asset_depreciation_profiles to service_role;
grant select, insert, update, delete on public.accounting_asset_depreciation_schedule to service_role;

create or replace function public.accounting_resolve_line_cost_center()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_dimension text;
begin
  v_dimension := nullif(new.dimensions->>'cost_center_id','');

  if v_dimension is not null then
    begin
      new.cost_center_id := v_dimension::uuid;
    exception when invalid_text_representation then
      raise exception 'COST_CENTER_ID_INVALID';
    end;
  end if;

  if new.cost_center_id is not null and not exists (
    select 1
    from public.accounting_cost_centers c
    where c.accounting_entity_id = new.accounting_entity_id
      and c.id = new.cost_center_id
      and c.status = 'active'
  ) then
    raise exception 'COST_CENTER_NOT_ACTIVE';
  end if;

  return new;
end;
$$;

revoke all on function public.accounting_resolve_line_cost_center()
  from public, anon, authenticated;
grant execute on function public.accounting_resolve_line_cost_center()
  to service_role;

drop trigger if exists trg_accounting_resolve_line_cost_center
  on public.accounting_journal_lines;

create trigger trg_accounting_resolve_line_cost_center
before insert or update of dimensions, cost_center_id, accounting_entity_id
on public.accounting_journal_lines
for each row execute function public.accounting_resolve_line_cost_center();

create or replace function public.accounting_commit_asset_depreciation(
  p_schedule_id uuid,
  p_event jsonb,
  p_posting jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_schedule public.accounting_asset_depreciation_schedule%rowtype;
  v_profile public.accounting_asset_depreciation_profiles%rowtype;
  v_asset public.bonds_assets%rowtype;
  v_result jsonb;
  v_event_id uuid;
  v_journal_id uuid;
begin
  if p_schedule_id is null then
    raise exception 'DEPRECIATION_SCHEDULE_REQUIRED';
  end if;

  select *
    into v_schedule
  from public.accounting_asset_depreciation_schedule
  where id = p_schedule_id
  for update;

  if not found then
    raise exception 'DEPRECIATION_SCHEDULE_NOT_FOUND';
  end if;

  if v_schedule.status = 'posted' then
    return jsonb_build_object(
      'ok', true,
      'state', 'replayed',
      'schedule_id', v_schedule.id,
      'event_id', v_schedule.financial_event_id,
      'posting_id', v_schedule.journal_entry_id
    );
  end if;

  if v_schedule.status <> 'scheduled' then
    raise exception 'DEPRECIATION_SCHEDULE_NOT_POSTABLE';
  end if;

  select *
    into v_profile
  from public.accounting_asset_depreciation_profiles
  where accounting_entity_id = v_schedule.accounting_entity_id
    and id = v_schedule.depreciation_profile_id
    and asset_id = v_schedule.asset_id
  limit 1;

  if not found or v_profile.status <> 'active' then
    raise exception 'DEPRECIATION_PROFILE_NOT_ACTIVE';
  end if;

  select *
    into v_asset
  from public.bonds_assets
  where accounting_entity_id = v_schedule.accounting_entity_id
    and id = v_schedule.asset_id
  limit 1;

  if not found or v_asset.lifecycle_status <> 'active' then
    raise exception 'CANONICAL_ASSET_NOT_ACTIVE';
  end if;

  if v_asset.acquisition_cost is null
     or v_asset.residual_value is null
     or v_asset.useful_life_months is null
     or v_asset.acquisition_date is null then
    raise exception 'CANONICAL_ASSET_DEPRECIATION_DATA_REQUIRED';
  end if;

  if coalesce(p_event->>'type','') <> 'asset.depreciation.recorded' then
    raise exception 'DEPRECIATION_EVENT_TYPE_INVALID';
  end if;

  if nullif(p_event->>'accounting_entity_id','')::uuid <> v_schedule.accounting_entity_id then
    raise exception 'DEPRECIATION_ENTITY_MISMATCH';
  end if;

  if nullif(p_event->>'amount','')::numeric <> v_schedule.depreciation_amount then
    raise exception 'DEPRECIATION_AMOUNT_MISMATCH';
  end if;

  if nullif(p_event#>>'{payload,asset_id}','')::uuid <> v_schedule.asset_id
     or nullif(p_event#>>'{payload,depreciation_profile_id}','')::uuid <> v_schedule.depreciation_profile_id
     or nullif(p_event#>>'{payload,period_id}','')::uuid <> v_schedule.period_id then
    raise exception 'DEPRECIATION_EVENT_REFERENCE_MISMATCH';
  end if;

  v_result := public.accounting_commit_posting(p_event,p_posting);

  v_event_id := nullif(v_result->>'event_id','')::uuid;
  v_journal_id := nullif(v_result->>'posting_id','')::uuid;

  if v_event_id is null or v_journal_id is null then
    raise exception 'DEPRECIATION_POSTING_RESULT_INVALID';
  end if;

  update public.accounting_asset_depreciation_schedule
  set status = 'posted',
      financial_event_id = v_event_id,
      journal_entry_id = v_journal_id,
      posted_at = coalesce(posted_at,now())
  where id = v_schedule.id;

  return v_result || jsonb_build_object('schedule_id',v_schedule.id);
end;
$$;

revoke all on function public.accounting_commit_asset_depreciation(uuid,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.accounting_commit_asset_depreciation(uuid,jsonb,jsonb)
  to service_role;

create or replace function public.accounting_cost_center_ledger(
  p_accounting_entity_id uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  cost_center_id uuid,
  cost_center_code text,
  cost_center_name text,
  account_code text,
  account_name text,
  account_type text,
  debit numeric,
  credit numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_accounting_entity_id is null then
    raise exception 'ACCOUNTING_ENTITY_REQUIRED';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'ACCOUNTING_REPORT_DATE_RANGE_INVALID';
  end if;

  return query
  select
    l.cost_center_id,
    coalesce(c.code,'UNASSIGNED'),
    coalesce(c.name,'Unassigned'),
    a.code,
    a.name,
    a.account_type,
    coalesce(sum(l.debit),0)::numeric,
    coalesce(sum(l.credit),0)::numeric
  from public.accounting_journal_entries j
  join public.accounting_journal_lines l
    on l.accounting_entity_id = j.accounting_entity_id
   and l.journal_entry_id = j.id
  join public.accounting_accounts a
    on a.accounting_entity_id = l.accounting_entity_id
   and a.id = l.account_id
  left join public.accounting_cost_centers c
    on c.accounting_entity_id = l.accounting_entity_id
   and c.id = l.cost_center_id
  where j.accounting_entity_id = p_accounting_entity_id
    and j.status = 'posted'
    and (p_from is null or j.effective_at::date >= p_from)
    and (p_to is null or j.effective_at::date <= p_to)
  group by
    l.cost_center_id,
    c.code,
    c.name,
    a.code,
    a.name,
    a.account_type
  having coalesce(sum(l.debit),0) <> 0
      or coalesce(sum(l.credit),0) <> 0
  order by coalesce(c.code,'UNASSIGNED'), a.code;
end;
$$;

revoke all on function public.accounting_cost_center_ledger(uuid,date,date)
  from public, anon, authenticated;
grant execute on function public.accounting_cost_center_ledger(uuid,date,date)
  to service_role;

commit;
