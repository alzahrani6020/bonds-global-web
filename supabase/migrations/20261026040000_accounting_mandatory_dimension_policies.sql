begin;

-- Wave 11: mandatory accounting dimensions by account.
-- Reuses the canonical account master, accounting_dimensions, journal-line
-- dimensions JSONB and the existing /services/execute boundary.

create table if not exists public.accounting_account_dimension_policies (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  account_id uuid not null,
  dimension_type text not null
    check (dimension_type in ('cost_center','segment')),
  required boolean not null default true,
  status text not null default 'active'
    check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  configured_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, account_id, dimension_type),
  foreign key (accounting_entity_id, account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete cascade
);

create index if not exists idx_accounting_account_dimension_policies_entity_account
  on public.accounting_account_dimension_policies(accounting_entity_id, account_id, status);

create index if not exists idx_accounting_account_dimension_policies_configured_by
  on public.accounting_account_dimension_policies(configured_by)
  where configured_by is not null;

alter table public.accounting_account_dimension_policies enable row level security;

revoke all on public.accounting_account_dimension_policies from anon, authenticated;
grant select, insert, update, delete
  on public.accounting_account_dimension_policies to service_role;

create or replace function public.accounting_validate_journal_dimensions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text;
  v_value text;
  v_dimension_type text;
begin
  if new.dimensions is null then
    new.dimensions := '{}'::jsonb;
  end if;

  if jsonb_typeof(new.dimensions) <> 'object' then
    raise exception 'ACCOUNTING_DIMENSIONS_OBJECT_REQUIRED';
  end if;

  for v_key, v_value in
    select key, value #>> '{}'
    from jsonb_each(new.dimensions)
  loop
    if v_key not in ('cost_center','segment') then
      raise exception 'ACCOUNTING_DIMENSION_KEY_UNSUPPORTED';
    end if;

    if jsonb_typeof(new.dimensions -> v_key) <> 'string'
       or nullif(btrim(v_value),'') is null then
      raise exception 'ACCOUNTING_DIMENSION_CODE_INVALID';
    end if;

    v_dimension_type := case
      when v_key = 'cost_center' then 'cost_center'
      when v_key = 'segment' then 'segment'
      else null
    end;

    if not exists (
      select 1
      from public.accounting_dimensions d
      where d.accounting_entity_id = new.accounting_entity_id
        and d.dimension_type = v_dimension_type
        and d.code = v_value
        and d.status = 'active'
    ) then
      raise exception 'ACCOUNTING_DIMENSION_NOT_ACTIVE_OR_NOT_FOUND';
    end if;
  end loop;

  for v_dimension_type in
    select p.dimension_type
    from public.accounting_account_dimension_policies p
    where p.accounting_entity_id = new.accounting_entity_id
      and p.account_id = new.account_id
      and p.required = true
      and p.status = 'active'
  loop
    if not (new.dimensions ? v_dimension_type)
       or jsonb_typeof(new.dimensions -> v_dimension_type) <> 'string'
       or nullif(btrim(new.dimensions ->> v_dimension_type),'') is null then
      raise exception 'ACCOUNTING_REQUIRED_DIMENSION_MISSING';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.accounting_validate_journal_dimensions()
  from public, anon, authenticated;
grant execute on function public.accounting_validate_journal_dimensions()
  to service_role;

drop trigger if exists trg_accounting_validate_journal_dimensions
  on public.accounting_journal_lines;

create trigger trg_accounting_validate_journal_dimensions
before insert or update of accounting_entity_id, account_id, dimensions
on public.accounting_journal_lines
for each row execute function public.accounting_validate_journal_dimensions();

insert into public.service_capability_map(
  service_id,
  capability_code,
  run_order,
  is_required,
  metadata
)
select
  s.id,
  'accounting_dimension_policy_configure',
  15,
  true,
  jsonb_build_object('wave',11,'mapped_action',true)
from public.service_catalog s
where s.code='accounting_operations'
on conflict (service_id,capability_code) do update
set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

comment on table public.accounting_account_dimension_policies is
  'Governed per-account requirements for canonical cost-center and segment journal dimensions.';

commit;
