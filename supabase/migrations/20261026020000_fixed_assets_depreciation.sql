begin;

-- Wave 7: deterministic fixed-asset depreciation profiles.
-- public.bonds_assets remains the canonical asset master.

create table if not exists public.accounting_fixed_asset_profiles (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete restrict,
  asset_id uuid not null,
  depreciation_method text not null default 'straight_line'
    check (depreciation_method in ('straight_line')),
  in_service_date date not null,
  useful_life_months integer not null
    check (useful_life_months > 0),
  residual_value numeric(20,2) not null default 0
    check (residual_value >= 0),
  depreciation_expense_account_code text not null,
  accumulated_depreciation_account_code text not null,
  status text not null default 'active'
    check (status in ('active','suspended','fully_depreciated','disposed')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, asset_id),
  foreign key (accounting_entity_id, asset_id)
    references public.bonds_assets(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_fixed_asset_profiles_entity_status
  on public.accounting_fixed_asset_profiles(accounting_entity_id, status);

create index if not exists idx_fixed_asset_profiles_created_by
  on public.accounting_fixed_asset_profiles(created_by)
  where created_by is not null;

alter table public.accounting_fixed_asset_profiles enable row level security;

revoke all on public.accounting_fixed_asset_profiles from anon, authenticated;
grant select, insert, update, delete
  on public.accounting_fixed_asset_profiles to service_role;

comment on table public.accounting_fixed_asset_profiles is
  'Deterministic accounting depreciation profiles for canonical bonds_assets.';

commit;