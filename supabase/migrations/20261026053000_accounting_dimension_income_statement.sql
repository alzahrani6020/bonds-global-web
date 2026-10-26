begin;

-- Accounting Reporting Wave 15: dimension income statement.
-- Reuses canonical posted journals, canonical dimensions, existing GIN index,
-- the published income_statement service, and /api/v3/services/execute.

create or replace function public.accounting_dimension_income_statement_rows(
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
  statement_class text,
  account_code text,
  account_name text,
  account_type text,
  amount numeric,
  gross_revenue numeric,
  contra_revenue_total numeric,
  net_revenue numeric,
  gross_expense numeric,
  contra_expense_total numeric,
  net_expense numeric,
  net_income numeric
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
  with account_rows as (
    select
      l.dimensions->>v_dimension_type as dimension_code,
      d.name as dimension_name,
      case a.account_type
        when 'revenue' then 'revenue'
        when 'contra_revenue' then 'contra_revenue'
        when 'expense' then 'expense'
        when 'contra_expense' then 'contra_expense'
        else null
      end as statement_class,
      a.code as account_code,
      a.name as account_name,
      a.account_type,
      (
        case a.account_type
          when 'revenue' then coalesce(sum(l.credit-l.debit),0)
          when 'contra_revenue' then coalesce(sum(l.debit-l.credit),0)
          when 'expense' then coalesce(sum(l.debit-l.credit),0)
          when 'contra_expense' then coalesce(sum(l.credit-l.debit),0)
          else 0
        end
      )::numeric as amount
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
      and a.account_type in (
        'revenue','contra_revenue','expense','contra_expense'
      )
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
    having case a.account_type
      when 'revenue' then coalesce(sum(l.credit-l.debit),0)
      when 'contra_revenue' then coalesce(sum(l.debit-l.credit),0)
      when 'expense' then coalesce(sum(l.debit-l.credit),0)
      when 'contra_expense' then coalesce(sum(l.credit-l.debit),0)
      else 0
    end <> 0
  ),
  with_totals as (
    select
      r.*,
      coalesce(sum(r.amount) filter(where r.statement_class='revenue')
        over(partition by r.dimension_code),0)::numeric as gross_revenue,
      coalesce(sum(r.amount) filter(where r.statement_class='contra_revenue')
        over(partition by r.dimension_code),0)::numeric as contra_revenue_total,
      coalesce(sum(r.amount) filter(where r.statement_class='expense')
        over(partition by r.dimension_code),0)::numeric as gross_expense,
      coalesce(sum(r.amount) filter(where r.statement_class='contra_expense')
        over(partition by r.dimension_code),0)::numeric as contra_expense_total
    from account_rows r
  )
  select
    v_dimension_type,
    t.dimension_code,
    t.dimension_name,
    t.statement_class,
    t.account_code,
    t.account_name,
    t.account_type,
    t.amount,
    t.gross_revenue,
    t.contra_revenue_total,
    (t.gross_revenue-t.contra_revenue_total)::numeric as net_revenue,
    t.gross_expense,
    t.contra_expense_total,
    (t.gross_expense-t.contra_expense_total)::numeric as net_expense,
    (
      (t.gross_revenue-t.contra_revenue_total) -
      (t.gross_expense-t.contra_expense_total)
    )::numeric as net_income
  from with_totals t
  order by
    t.dimension_code,
    case t.statement_class
      when 'revenue' then 10
      when 'contra_revenue' then 20
      when 'expense' then 30
      when 'contra_expense' then 40
      else 99
    end,
    t.account_code;
end;
$$;

revoke all on function public.accounting_dimension_income_statement_rows(
  uuid,text,text,date,date
) from public, anon, authenticated;
grant execute on function public.accounting_dimension_income_statement_rows(
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
  'accounting_dimension_income_statement',
  10,
  true,
  jsonb_build_object(
    'accounting_reporting_wave',15,
    'mapped_action',true,
    'read_only',true
  )
from public.service_catalog s
where s.code='income_statement'
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
  'accounting_dimension_income_statement',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  2,
  true,
  jsonb_build_object(
    'accounting_reporting_wave',15,
    'read_only',true,
    'canonical_source','posted_accounting_journal_lines',
    'statement_basis','account_type'
  )
from public.service_catalog s
where s.code='income_statement'
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
