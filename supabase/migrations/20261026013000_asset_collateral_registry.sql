begin;

-- Wave 6: governed Asset / Collateral Registry.
-- Reuse public.bonds_assets as the canonical asset master; do not create a parallel asset table.

alter table public.bonds_assets
  add column if not exists accounting_entity_id uuid
    references public.accounting_entities(id) on delete restrict,
  add column if not exists acquisition_date date,
  add column if not exists acquisition_cost numeric(20,2),
  add column if not exists currency text not null default 'SAR',
  add column if not exists useful_life_months integer,
  add column if not exists residual_value numeric(20,2),
  add column if not exists lifecycle_status text not null default 'active';

alter table public.bonds_assets
  drop constraint if exists bonds_assets_acquisition_cost_nonnegative,
  add constraint bonds_assets_acquisition_cost_nonnegative
    check (acquisition_cost is null or acquisition_cost >= 0),
  drop constraint if exists bonds_assets_residual_value_nonnegative,
  add constraint bonds_assets_residual_value_nonnegative
    check (residual_value is null or residual_value >= 0),
  drop constraint if exists bonds_assets_useful_life_positive,
  add constraint bonds_assets_useful_life_positive
    check (useful_life_months is null or useful_life_months > 0),
  drop constraint if exists bonds_assets_currency_iso,
  add constraint bonds_assets_currency_iso
    check (currency ~ '^[A-Z]{3}$'),
  drop constraint if exists bonds_assets_lifecycle_status_check,
  add constraint bonds_assets_lifecycle_status_check
    check (lifecycle_status in ('active','inactive','disposed','written_off'));

create unique index if not exists uq_bonds_assets_entity_id
  on public.bonds_assets(accounting_entity_id, id);

create index if not exists idx_bonds_assets_accounting_entity
  on public.bonds_assets(accounting_entity_id)
  where accounting_entity_id is not null;

create or replace function public.accounting_assert_asset_entity_assignment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.accounting_entity_id is null then
    return new;
  end if;

  if current_user in ('postgres','service_role') then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if not public.accounting_user_can_access_entity(new.accounting_entity_id) then
    raise exception 'ACCOUNTING_ENTITY_ACCESS_DENIED';
  end if;

  return new;
end;
$$;

revoke all on function public.accounting_assert_asset_entity_assignment()
  from public, anon, authenticated;
grant execute on function public.accounting_assert_asset_entity_assignment()
  to service_role;

drop trigger if exists trg_accounting_assert_asset_entity_assignment
  on public.bonds_assets;

create trigger trg_accounting_assert_asset_entity_assignment
before insert or update of accounting_entity_id
on public.bonds_assets
for each row execute function public.accounting_assert_asset_entity_assignment();

create table if not exists public.asset_collateral_assignments (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete restrict,
  asset_id uuid not null,
  status text not null default 'proposed'
    check (status in ('proposed','active','released','enforced','expired')),
  secured_amount numeric(20,2)
    check (secured_amount is null or secured_amount >= 0),
  collateral_value numeric(20,2)
    check (collateral_value is null or collateral_value >= 0),
  currency text not null default 'SAR'
    check (currency ~ '^[A-Z]{3}$'),
  priority integer
    check (priority is null or priority > 0),
  lien_holder text,
  agreement_reference text,
  valid_from date,
  valid_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  foreign key (accounting_entity_id, asset_id)
    references public.bonds_assets(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_asset_collateral_entity_status
  on public.asset_collateral_assignments(accounting_entity_id, status);

create index if not exists idx_asset_collateral_asset
  on public.asset_collateral_assignments(accounting_entity_id, asset_id);

create index if not exists idx_asset_collateral_created_by
  on public.asset_collateral_assignments(created_by)
  where created_by is not null;

alter table public.asset_collateral_assignments enable row level security;

revoke all on public.asset_collateral_assignments from anon, authenticated;
grant select, insert, update, delete
  on public.asset_collateral_assignments to service_role;

comment on table public.asset_collateral_assignments is
  'Governed collateral relationships for canonical bonds_assets, scoped by accounting_entity_id.';

commit;
