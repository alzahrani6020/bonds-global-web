begin;

-- Accounting Reporting Wave 14: governed dimension ledger reporting.
-- Reuses canonical posted journals, accounting dimensions, membership boundary,
-- general_ledger service, and /api/v3/services/execute.

create or replace function public.accounting_dimension_ledger_balances(
  p_accounting_entity_id uuid,
  p_dimension_type text,
  p_dimension_code text default null,
  p_from date default null,
  p_to date default null
)
returns table(
  dimension_type text,
  dimension_code text,
  dimension_name text,
  account_code text,
  account_name text,
  account_type text,
  debit numeric,
  credit numeric,
  net_balance numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_dimension_type text := nullif(btrim(coalesce(p_dimension_type,'')),'');
  v_dimension_code text := nullif(btrim(coalesce(p_dimension_code,'')),'');
begin
  if p_accounting_entity_id is null then
    raise exception 'ACCOUNTING_ENTITY_REQUIRED';
  end if;

  if v_dimension_type is null
     or v_dimension_type not in ('cost_center','segment') then
    raise exception 'ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'ACCOUNTING_REPORT_DATE_RANGE_INVALID';
  end if;

  if not exists (
    select 1
    from public.accounting_entities e
    where e.id=p_accounting_entity_id
      and e.status='active'
  ) then
    raise exception 'ACCOUNTING_ENTITY_NOT_ACTIVE';
  end if;

  if v_dimension_code is not null
     and not exists (
       select 1
       from public.accounting_dimensions d
       where d.accounting_entity_id=p_accounting_entity_id
         and d.dimension_type=v_dimension_type
         and d.code=v_dimension_code
     ) then
    raise exception 'ACCOUNTING_DIMENSION_NOT_FOUND';
  end if;

  return query
  select
    v_dimension_type,
    l.dimensions->>v_dimension_type as dimension_code,
    d.name as dimension_name,
    a.code as account_code,
    a.name as account_name,
    a.account_type,
    coalesce(sum(l.debit),0)::numeric as debit,
    coalesce(sum(l.credit),0)::numeric as credit,
    coalesce(sum(l.debit-l.credit),0)::numeric as net_balance
  from public.accounting_journal_entries j
  join public.accounting_journal_lines l
    on l.accounting_entity_id=j.accounting_entity_id
   and l.journal_entry_id=j.id
  join public.accounting_accounts a
    on a.accounting_entity_id=l.accounting_entity_id
   and a.id=l.account_id
  join public.accounting_dimensions d
    on d.accounting_entity_id=l.accounting_entity_id
   and d.dimension_type=v_dimension_type
   and d.code=l.dimensions->>v_dimension_type
  where j.accounting_entity_id=p_accounting_entity_id
    and j.status='posted'
    and l.dimensions ? v_dimension_type
    and nullif(btrim(l.dimensions->>v_dimension_type),'') is not null
    and (v_dimension_code is null or l.dimensions->>v_dimension_type=v_dimension_code)
    and (p_from is null or j.effective_at::date >= p_from)
    and (p_to is null or j.effective_at::date <= p_to)
  group by
    l.dimensions->>v_dimension_type,
    d.name,
    a.code,
    a.name,
    a.account_type
  having coalesce(sum(l.debit),0) <> 0
      or coalesce(sum(l.credit),0) <> 0
  order by
    l.dimensions->>v_dimension_type,
    a.code;
end;
$$;

revoke all on function public.accounting_dimension_ledger_balances(
  uuid,text,text,date,date
) from public, anon, authenticated;
grant execute on function public.accounting_dimension_ledger_balances(
  uuid,text,text,date,date
) to service_role;

insert into public.service_capability_map(
  service_id,
  capability_code,
  run_order,
  is_required,
  metadata
)
select
  s.id,
  'accounting_dimension_ledger_report',
  10,
  true,
  jsonb_build_object(
    'accounting_reporting_wave',14,
    'mapped_action',true,
    'read_only',true
  )
from public.service_catalog s
where s.code='general_ledger'
on conflict(service_id,capability_code) do update
set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

insert into public.service_execution_profiles(
  service_id,
  execution_status,
  execution_mode,
  primary_action,
  orchestrator_intent,
  tool_id,
  ai_mode,
  research_mode,
  token_mode,
  assistant_enabled,
  version,
  is_active,
  metadata
)
select
  s.id,
  'automated',
  'capability_plan',
  'accounting_dimension_ledger_report',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  2,
  true,
  jsonb_build_object(
    'accounting_reporting_wave',14,
    'read_only',true,
    'canonical_source','posted_accounting_journal_lines'
  )
from public.service_catalog s
where s.code='general_ledger'
on conflict(service_id) do update
set
  execution_status=excluded.execution_status,
  execution_mode=excluded.execution_mode,
  primary_action=excluded.primary_action,
  orchestrator_intent=excluded.orchestrator_intent,
  tool_id=excluded.tool_id,
  ai_mode=excluded.ai_mode,
  research_mode=excluded.research_mode,
  token_mode=excluded.token_mode,
  assistant_enabled=excluded.assistant_enabled,
  version=excluded.version,
  is_active=excluded.is_active,
  metadata=excluded.metadata;

commit;
