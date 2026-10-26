begin;

-- Accounting Reporting Wave 18: governed cash-flow configuration and
-- dimension-based cash-flow statement.
-- Reuses canonical posted journals, financial events, cash accounts,
-- cash-flow policies, dimensions, and the existing service execution path.
-- No parallel ledger, persisted statement table, or alternate HTTP endpoint.

create or replace function public.accounting_configure_cash_account(
  p_accounting_entity_id uuid,
  p_account_id uuid,
  p_status text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text := lower(btrim(coalesce(p_status,'active')));
begin
  if p_accounting_entity_id is null
     or p_account_id is null
     or p_actor_id is null then
    raise exception 'ACCOUNTING_CASH_ACCOUNT_IDENTIFIERS_REQUIRED';
  end if;

  if v_status not in ('active','inactive') then
    raise exception 'ACCOUNTING_CASH_ACCOUNT_STATUS_INVALID';
  end if;

  if not exists (
    select 1
    from public.accounting_entity_members m
    join public.accounting_entities e
      on e.id=m.accounting_entity_id
     and e.status='active'
    where m.accounting_entity_id=p_accounting_entity_id
      and m.user_id=p_actor_id
      and m.status='active'
      and m.role in ('owner','admin')
  ) then
    raise exception 'ACCOUNTING_CASH_ACCOUNT_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.accounting_accounts a
    where a.accounting_entity_id=p_accounting_entity_id
      and a.id=p_account_id
      and a.account_type='asset'
      and a.is_active=true
      and a.is_postable=true
  ) then
    raise exception 'ACCOUNTING_CASH_ACCOUNT_INVALID';
  end if;

  insert into public.accounting_cash_accounts(
    accounting_entity_id,
    account_id,
    status,
    created_by,
    updated_at
  )
  values(
    p_accounting_entity_id,
    p_account_id,
    v_status,
    p_actor_id,
    now()
  )
  on conflict(accounting_entity_id,account_id) do update
  set
    status=excluded.status,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'accounting_entity_id',p_accounting_entity_id,
    'account_id',p_account_id,
    'status',v_status
  );
end;
$$;

revoke all on function public.accounting_configure_cash_account(
  uuid,uuid,text,uuid
) from public, anon, authenticated;
grant execute on function public.accounting_configure_cash_account(
  uuid,uuid,text,uuid
) to service_role;

create or replace function public.accounting_configure_cash_flow_policy(
  p_accounting_entity_id uuid,
  p_event_type text,
  p_cash_flow_category text,
  p_status text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_type text := nullif(btrim(coalesce(p_event_type,'')),'');
  v_category text := lower(btrim(coalesce(p_cash_flow_category,'')));
  v_status text := lower(btrim(coalesce(p_status,'active')));
begin
  if p_accounting_entity_id is null or p_actor_id is null then
    raise exception 'ACCOUNTING_CASH_FLOW_POLICY_IDENTIFIERS_REQUIRED';
  end if;

  if v_event_type is null then
    raise exception 'ACCOUNTING_CASH_FLOW_EVENT_TYPE_REQUIRED';
  end if;

  if v_category not in ('operating','investing','financing') then
    raise exception 'ACCOUNTING_CASH_FLOW_CATEGORY_INVALID';
  end if;

  if v_status not in ('active','inactive') then
    raise exception 'ACCOUNTING_CASH_FLOW_POLICY_STATUS_INVALID';
  end if;

  if not exists (
    select 1
    from public.accounting_entity_members m
    join public.accounting_entities e
      on e.id=m.accounting_entity_id
     and e.status='active'
    where m.accounting_entity_id=p_accounting_entity_id
      and m.user_id=p_actor_id
      and m.status='active'
      and m.role in ('owner','admin')
  ) then
    raise exception 'ACCOUNTING_CASH_FLOW_POLICY_FORBIDDEN';
  end if;

  insert into public.accounting_cash_flow_policies(
    accounting_entity_id,
    event_type,
    cash_flow_category,
    status,
    created_by,
    updated_at
  )
  values(
    p_accounting_entity_id,
    v_event_type,
    v_category,
    v_status,
    p_actor_id,
    now()
  )
  on conflict(accounting_entity_id,event_type) do update
  set
    cash_flow_category=excluded.cash_flow_category,
    status=excluded.status,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'accounting_entity_id',p_accounting_entity_id,
    'event_type',v_event_type,
    'cash_flow_category',v_category,
    'status',v_status
  );
end;
$$;

revoke all on function public.accounting_configure_cash_flow_policy(
  uuid,text,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.accounting_configure_cash_flow_policy(
  uuid,text,text,text,uuid
) to service_role;

create or replace function public.accounting_dimension_cash_flow_statement_rows(
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
  cash_flow_category text,
  category_amount numeric,
  opening_cash numeric,
  operating_cash_flow numeric,
  investing_cash_flow numeric,
  financing_cash_flow numeric,
  net_cash_change numeric,
  closing_cash numeric,
  direct_closing_cash numeric,
  reconciliation_delta numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_dimension_type text := nullif(btrim(coalesce(p_dimension_type,'')),'');
  v_dimension_code text := nullif(btrim(coalesce(p_dimension_code,'')),'');
  v_missing_dimension integer;
  v_unclassified integer;
begin
  if p_accounting_entity_id is null then
    raise exception 'ACCOUNTING_ENTITY_REQUIRED';
  end if;

  if v_dimension_type is null
     or v_dimension_type not in ('cost_center','segment') then
    raise exception 'ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED';
  end if;

  if p_from is null or p_to is null then
    raise exception 'CASH_FLOW_DATE_RANGE_REQUIRED';
  end if;

  if p_from > p_to then
    raise exception 'CASH_FLOW_DATE_RANGE_INVALID';
  end if;

  if not exists (
    select 1
    from public.accounting_entities e
    where e.id=p_accounting_entity_id
      and e.status='active'
  ) then
    raise exception 'ACCOUNTING_ENTITY_NOT_ACTIVE';
  end if;

  if not exists (
    select 1
    from public.accounting_cash_accounts ca
    where ca.accounting_entity_id=p_accounting_entity_id
      and ca.status='active'
  ) then
    raise exception 'CASH_FLOW_CASH_ACCOUNT_REQUIRED';
  end if;

  if v_dimension_code is not null
     and not exists (
       select 1
       from public.accounting_dimensions d
       where d.accounting_entity_id=p_accounting_entity_id
         and d.dimension_type=v_dimension_type
         and d.code=v_dimension_code
         and d.status='active'
     ) then
    raise exception 'ACCOUNTING_DIMENSION_NOT_FOUND';
  end if;

  select count(*)
    into v_missing_dimension
  from public.accounting_journal_entries j
  join public.accounting_journal_lines l
    on l.accounting_entity_id=j.accounting_entity_id
   and l.journal_entry_id=j.id
  join public.accounting_cash_accounts ca
    on ca.accounting_entity_id=l.accounting_entity_id
   and ca.account_id=l.account_id
   and ca.status='active'
  where j.accounting_entity_id=p_accounting_entity_id
    and j.status='posted'
    and j.effective_at::date <= p_to
    and abs(l.debit-l.credit) > 0.005
    and (
      not (l.dimensions ? v_dimension_type)
      or nullif(btrim(l.dimensions->>v_dimension_type),'') is null
    );

  if v_missing_dimension > 0 then
    raise exception 'CASH_FLOW_DIMENSION_REQUIRED';
  end if;

  select count(*)
    into v_unclassified
  from (
    select
      j.financial_event_id,
      l.dimensions->>v_dimension_type as dimension_code
    from public.accounting_journal_entries j
    join public.accounting_journal_lines l
      on l.accounting_entity_id=j.accounting_entity_id
     and l.journal_entry_id=j.id
    join public.accounting_cash_accounts ca
      on ca.accounting_entity_id=l.accounting_entity_id
     and ca.account_id=l.account_id
     and ca.status='active'
    join public.financial_events e
      on e.accounting_entity_id=j.accounting_entity_id
     and e.id=j.financial_event_id
    left join public.accounting_cash_flow_policies p
      on p.accounting_entity_id=e.accounting_entity_id
     and p.event_type=e.event_type
     and p.status='active'
    where j.accounting_entity_id=p_accounting_entity_id
      and j.status='posted'
      and j.effective_at::date between p_from and p_to
      and (
        v_dimension_code is null
        or l.dimensions->>v_dimension_type=v_dimension_code
      )
    group by
      j.financial_event_id,
      l.dimensions->>v_dimension_type,
      p.cash_flow_category
    having abs(sum(l.debit-l.credit)) > 0.005
       and p.cash_flow_category is null
  ) missing;

  if v_unclassified > 0 then
    raise exception 'CASH_FLOW_CLASSIFICATION_REQUIRED';
  end if;

  return query
  with cash_lines as (
    select
      l.dimensions->>v_dimension_type as dim_code,
      d.name as dim_name,
      j.effective_at::date as effective_date,
      e.event_type,
      (l.debit-l.credit)::numeric as cash_amount
    from public.accounting_journal_entries j
    join public.accounting_journal_lines l
      on l.accounting_entity_id=j.accounting_entity_id
     and l.journal_entry_id=j.id
    join public.accounting_cash_accounts ca
      on ca.accounting_entity_id=l.accounting_entity_id
     and ca.account_id=l.account_id
     and ca.status='active'
    join public.financial_events e
      on e.accounting_entity_id=j.accounting_entity_id
     and e.id=j.financial_event_id
    join public.accounting_dimensions d
      on d.accounting_entity_id=l.accounting_entity_id
     and d.dimension_type=v_dimension_type
     and d.code=l.dimensions->>v_dimension_type
     and d.status='active'
    where j.accounting_entity_id=p_accounting_entity_id
      and j.status='posted'
      and j.effective_at::date <= p_to
      and (
        v_dimension_code is null
        or l.dimensions->>v_dimension_type=v_dimension_code
      )
  ),
  dims as (
    select distinct dim_code,dim_name
    from cash_lines
  ),
  categories as (
    select *
    from (values
      ('operating'::text,1),
      ('investing'::text,2),
      ('financing'::text,3)
    ) v(category,sort_order)
  ),
  opening as (
    select
      dim_code,
      round(sum(cash_amount),2)::numeric as amount
    from cash_lines
    where effective_date < p_from
    group by dim_code
  ),
  period_classified as (
    select
      c.dim_code,
      p.cash_flow_category,
      round(sum(c.cash_amount),2)::numeric as amount
    from cash_lines c
    join public.accounting_cash_flow_policies p
      on p.accounting_entity_id=p_accounting_entity_id
     and p.event_type=c.event_type
     and p.status='active'
    where c.effective_date between p_from and p_to
    group by c.dim_code,p.cash_flow_category
  ),
  direct_close as (
    select
      dim_code,
      round(sum(cash_amount),2)::numeric as amount
    from cash_lines
    group by dim_code
  ),
  totals as (
    select
      d.dim_code,
      d.dim_name,
      coalesce(o.amount,0)::numeric as opening_cash,
      coalesce(max(pc.amount) filter(
        where pc.cash_flow_category='operating'
      ),0)::numeric as operating_cash_flow,
      coalesce(max(pc.amount) filter(
        where pc.cash_flow_category='investing'
      ),0)::numeric as investing_cash_flow,
      coalesce(max(pc.amount) filter(
        where pc.cash_flow_category='financing'
      ),0)::numeric as financing_cash_flow,
      coalesce(dc.amount,0)::numeric as direct_closing_cash
    from dims d
    left join opening o
      on o.dim_code=d.dim_code
    left join period_classified pc
      on pc.dim_code=d.dim_code
    left join direct_close dc
      on dc.dim_code=d.dim_code
    group by
      d.dim_code,
      d.dim_name,
      o.amount,
      dc.amount
  )
  select
    v_dimension_type,
    t.dim_code,
    t.dim_name,
    c.category,
    coalesce(pc.amount,0)::numeric,
    t.opening_cash,
    t.operating_cash_flow,
    t.investing_cash_flow,
    t.financing_cash_flow,
    (
      t.operating_cash_flow+
      t.investing_cash_flow+
      t.financing_cash_flow
    )::numeric,
    (
      t.opening_cash+
      t.operating_cash_flow+
      t.investing_cash_flow+
      t.financing_cash_flow
    )::numeric,
    t.direct_closing_cash,
    (
      t.direct_closing_cash -
      (
        t.opening_cash+
        t.operating_cash_flow+
        t.investing_cash_flow+
        t.financing_cash_flow
      )
    )::numeric
  from totals t
  cross join categories c
  left join period_classified pc
    on pc.dim_code=t.dim_code
   and pc.cash_flow_category=c.category
  order by t.dim_code,c.sort_order;
end;
$$;

revoke all on function public.accounting_dimension_cash_flow_statement_rows(
  uuid,text,text,date,date
) from public, anon, authenticated;
grant execute on function public.accounting_dimension_cash_flow_statement_rows(
  uuid,text,text,date,date
) to service_role;

insert into public.service_capability_map(
  service_id,capability_code,run_order,is_required,metadata
)
select
  s.id,
  x.capability_code,
  x.run_order,
  x.is_required,
  jsonb_build_object(
    'accounting_reporting_wave',18,
    'mapped_action',true
  )
from public.service_catalog s
cross join (values
  ('accounting_cash_account_configure'::text,20,false),
  ('accounting_cash_flow_policy_configure'::text,30,false),
  ('accounting_dimension_cash_flow_statement'::text,10,true)
) x(capability_code,run_order,is_required)
where s.code='cash_flow_statement'
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
  'accounting_dimension_cash_flow_statement',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  coalesce(p.version,0)+1,
  true,
  coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object(
    'accounting_reporting_wave',18,
    'canonical_source','posted_accounting_journal_lines',
    'classification_source','accounting_cash_flow_policies',
    'cash_account_source','accounting_cash_accounts',
    'fail_closed',true
  )
from public.service_catalog s
left join public.service_execution_profiles p
  on p.service_id=s.id
where s.code='cash_flow_statement'
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
