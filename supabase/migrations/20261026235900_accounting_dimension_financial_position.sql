begin;

-- Accounting Reporting Wave 16: statement of financial position by dimension.
-- Reuses canonical posted journals, canonical dimensions, existing reporting
-- execution path, and the published statement_financial_position service.
-- No parallel ledger, reporting cube, balance table, account taxonomy, or
-- HTTP endpoint is introduced.

create or replace function public.accounting_dimension_financial_position_rows(
  p_accounting_entity_id uuid,
  p_dimension_type text,
  p_dimension_code text default null,
  p_as_of date default null
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
  gross_assets numeric,
  contra_assets_total numeric,
  net_assets numeric,
  gross_liabilities numeric,
  contra_liabilities_total numeric,
  net_liabilities numeric,
  gross_equity numeric,
  contra_equity_total numeric,
  current_period_earnings numeric,
  net_equity numeric,
  liabilities_and_equity numeric,
  balance_delta numeric
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
  with permanent_rows as (
    select
      l.dimensions->>v_dimension_type as dimension_code,
      d.name as dimension_name,
      case a.account_type
        when 'asset' then 'asset'
        when 'contra_asset' then 'contra_asset'
        when 'liability' then 'liability'
        when 'contra_liability' then 'contra_liability'
        when 'equity' then 'equity'
        when 'contra_equity' then 'contra_equity'
        else null
      end as statement_class,
      a.code as account_code,
      a.name as account_name,
      a.account_type,
      case a.account_type
        when 'asset' then coalesce(sum(l.debit-l.credit),0)
        when 'contra_asset' then coalesce(sum(l.credit-l.debit),0)
        when 'liability' then coalesce(sum(l.credit-l.debit),0)
        when 'contra_liability' then coalesce(sum(l.debit-l.credit),0)
        when 'equity' then coalesce(sum(l.credit-l.debit),0)
        when 'contra_equity' then coalesce(sum(l.debit-l.credit),0)
        else 0
      end::numeric as amount
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
        'asset','contra_asset',
        'liability','contra_liability',
        'equity','contra_equity'
      )
      and l.dimensions ? v_dimension_type
      and nullif(btrim(l.dimensions->>v_dimension_type),'') is not null
      and (v_dimension_code is null or l.dimensions->>v_dimension_type=v_dimension_code)
      and (p_as_of is null or j.effective_at::date <= p_as_of)
    group by
      l.dimensions->>v_dimension_type,
      d.name,
      a.code,
      a.name,
      a.account_type
    having case a.account_type
      when 'asset' then coalesce(sum(l.debit-l.credit),0)
      when 'contra_asset' then coalesce(sum(l.credit-l.debit),0)
      when 'liability' then coalesce(sum(l.credit-l.debit),0)
      when 'contra_liability' then coalesce(sum(l.debit-l.credit),0)
      when 'equity' then coalesce(sum(l.credit-l.debit),0)
      when 'contra_equity' then coalesce(sum(l.debit-l.credit),0)
      else 0
    end <> 0
  ),
  current_earnings as (
    select
      l.dimensions->>v_dimension_type as dimension_code,
      d.name as dimension_name,
      coalesce(sum(l.credit-l.debit),0)::numeric as amount
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
      and (p_as_of is null or j.effective_at::date <= p_as_of)
    group by
      l.dimensions->>v_dimension_type,
      d.name
    having coalesce(sum(l.credit-l.debit),0) <> 0
  ),
  statement_rows as (
    select * from permanent_rows
    union all
    select
      e.dimension_code,
      e.dimension_name,
      'current_period_earnings'::text,
      'CURRENT_PERIOD_EARNINGS'::text,
      'Current Period Earnings'::text,
      'equity'::text,
      e.amount
    from current_earnings e
  ),
  with_totals as (
    select
      r.*,
      coalesce(sum(r.amount) filter(where r.statement_class='asset')
        over(partition by r.dimension_code),0)::numeric as gross_assets,
      coalesce(sum(r.amount) filter(where r.statement_class='contra_asset')
        over(partition by r.dimension_code),0)::numeric as contra_assets_total,
      coalesce(sum(r.amount) filter(where r.statement_class='liability')
        over(partition by r.dimension_code),0)::numeric as gross_liabilities,
      coalesce(sum(r.amount) filter(where r.statement_class='contra_liability')
        over(partition by r.dimension_code),0)::numeric as contra_liabilities_total,
      coalesce(sum(r.amount) filter(where r.statement_class='equity')
        over(partition by r.dimension_code),0)::numeric as gross_equity,
      coalesce(sum(r.amount) filter(where r.statement_class='contra_equity')
        over(partition by r.dimension_code),0)::numeric as contra_equity_total,
      coalesce(sum(r.amount) filter(where r.statement_class='current_period_earnings')
        over(partition by r.dimension_code),0)::numeric as current_period_earnings
    from statement_rows r
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
    t.gross_assets,
    t.contra_assets_total,
    (t.gross_assets-t.contra_assets_total)::numeric as net_assets,
    t.gross_liabilities,
    t.contra_liabilities_total,
    (t.gross_liabilities-t.contra_liabilities_total)::numeric as net_liabilities,
    t.gross_equity,
    t.contra_equity_total,
    t.current_period_earnings,
    (
      t.gross_equity -
      t.contra_equity_total +
      t.current_period_earnings
    )::numeric as net_equity,
    (
      (t.gross_liabilities-t.contra_liabilities_total) +
      (t.gross_equity-t.contra_equity_total+t.current_period_earnings)
    )::numeric as liabilities_and_equity,
    (
      (t.gross_assets-t.contra_assets_total) -
      (
        (t.gross_liabilities-t.contra_liabilities_total) +
        (t.gross_equity-t.contra_equity_total+t.current_period_earnings)
      )
    )::numeric as balance_delta
  from with_totals t
  order by
    t.dimension_code,
    case t.statement_class
      when 'asset' then 10
      when 'contra_asset' then 20
      when 'liability' then 30
      when 'contra_liability' then 40
      when 'equity' then 50
      when 'contra_equity' then 60
      when 'current_period_earnings' then 70
      else 99
    end,
    t.account_code;
end;
$$;

revoke all on function public.accounting_dimension_financial_position_rows(
  uuid,text,text,date
) from public, anon, authenticated;
grant execute on function public.accounting_dimension_financial_position_rows(
  uuid,text,text,date
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
  'accounting_dimension_financial_position',
  10,
  true,
  jsonb_build_object(
    'accounting_reporting_wave',16,
    'mapped_action',true,
    'read_only',true
  )
from public.service_catalog s
where s.code='statement_financial_position'
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
  'accounting_dimension_financial_position',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  2,
  true,
  jsonb_build_object(
    'accounting_reporting_wave',16,
    'read_only',true,
    'canonical_source','posted_accounting_journal_lines',
    'statement_basis','permanent_accounts_plus_current_period_earnings',
    'position_basis','cumulative_as_of'
  )
from public.service_catalog s
where s.code='statement_financial_position'
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
