begin;

-- Wave 9: governed accounting dimensions.
-- Reuses accounting_journal_lines.dimensions JSONB and validates it against
-- a canonical dimension master. No parallel journal or ledger path.

create table if not exists public.accounting_dimensions (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  dimension_type text not null
    check (dimension_type in ('cost_center','segment')),
  code text not null,
  name text not null,
  parent_id uuid,
  status text not null default 'active'
    check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, dimension_type, code),
  unique(accounting_entity_id, dimension_type, id),
  foreign key (accounting_entity_id, dimension_type, parent_id)
    references public.accounting_dimensions(accounting_entity_id, dimension_type, id)
    on delete restrict
);

create index if not exists idx_accounting_dimensions_entity_type_status
  on public.accounting_dimensions(accounting_entity_id, dimension_type, status);

create index if not exists idx_accounting_dimensions_parent
  on public.accounting_dimensions(accounting_entity_id, dimension_type, parent_id)
  where parent_id is not null;

create index if not exists idx_accounting_dimensions_created_by
  on public.accounting_dimensions(created_by)
  where created_by is not null;

alter table public.accounting_dimensions enable row level security;

revoke all on public.accounting_dimensions from anon, authenticated;
grant select, insert, update, delete
  on public.accounting_dimensions to service_role;

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
    return new;
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
before insert or update of accounting_entity_id, dimensions
on public.accounting_journal_lines
for each row execute function public.accounting_validate_journal_dimensions();

comment on table public.accounting_dimensions is
  'Canonical accounting cost-center and segment master used to validate journal-line dimensions.';

commit;
