begin;

-- Accounting Reporting Wave 20: governed statement of changes in equity.
-- Reuses canonical posted journals, financial events, year-end close controls,
-- and the existing service execution path. No parallel ledger or statement table.

create table if not exists public.accounting_equity_movement_policies (
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  event_type text not null,
  movement_category text not null
    check (
      movement_category in (
        'capital_contribution',
        'distribution',
        'other_equity'
      )
    ),
  status text not null default 'active'
    check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  configured_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(accounting_entity_id,event_type)
);

alter table public.accounting_equity_movement_policies
  enable row level security;

revoke all on public.accounting_equity_movement_policies
  from anon, authenticated;
grant select,insert,update,delete
  on public.accounting_equity_movement_policies to service_role;

create or replace function public.accounting_configure_equity_movement_policy(
  p_accounting_entity_id uuid,
  p_event_type text,
  p_movement_category text,
  p_status text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_event_type text:=nullif(btrim(coalesce(p_event_type,'')),'');
  v_category text:=lower(btrim(coalesce(p_movement_category,'')));
  v_status text:=lower(btrim(coalesce(p_status,'active')));
begin
  if p_accounting_entity_id is null or p_actor_id is null then
    raise exception 'ACCOUNTING_EQUITY_POLICY_IDENTIFIERS_REQUIRED';
  end if;

  if v_event_type is null then
    raise exception 'ACCOUNTING_EQUITY_EVENT_TYPE_REQUIRED';
  end if;

  if v_category not in (
    'capital_contribution',
    'distribution',
    'other_equity'
  ) then
    raise exception 'ACCOUNTING_EQUITY_MOVEMENT_CATEGORY_INVALID';
  end if;

  if v_status not in ('active','inactive') then
    raise exception 'ACCOUNTING_EQUITY_POLICY_STATUS_INVALID';
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
    raise exception 'ACCOUNTING_EQUITY_POLICY_FORBIDDEN';
  end if;

  insert into public.accounting_equity_movement_policies(
    accounting_entity_id,
    event_type,
    movement_category,
    status,
    configured_by,
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
    movement_category=excluded.movement_category,
    status=excluded.status,
    configured_by=excluded.configured_by,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'accounting_entity_id',p_accounting_entity_id,
    'event_type',v_event_type,
    'movement_category',v_category,
    'status',v_status
  );
end;
$$;

revoke all on function public.accounting_configure_equity_movement_policy(
  uuid,text,text,text,uuid
) from public,anon,authenticated;
grant execute on function public.accounting_configure_equity_movement_policy(
  uuid,text,text,text,uuid
) to service_role;

create or replace function public.accounting_changes_in_equity_statement_rows(
  p_accounting_entity_id uuid,
  p_from date,
  p_to date
)
returns table(
  movement_category text,
  category_amount numeric,
  opening_equity numeric,
  capital_contributions numeric,
  distributions numeric,
  other_equity_movements numeric,
  current_period_earnings numeric,
  closing_equity numeric,
  direct_closing_equity numeric,
  reconciliation_delta numeric
)
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  v_unclassified integer;
begin
  if p_accounting_entity_id is null then
    raise exception 'ACCOUNTING_ENTITY_REQUIRED';
  end if;

  if p_from is null or p_to is null then
    raise exception 'EQUITY_DATE_RANGE_REQUIRED';
  end if;

  if p_from>p_to then
    raise exception 'EQUITY_DATE_RANGE_INVALID';
  end if;

  if not exists (
    select 1
    from public.accounting_entities e
    where e.id=p_accounting_entity_id
      and e.status='active'
  ) then
    raise exception 'ACCOUNTING_ENTITY_NOT_ACTIVE';
  end if;

  select count(*)
    into v_unclassified
  from (
    select e.event_type
    from public.accounting_journal_entries j
    join public.accounting_journal_lines l
      on l.accounting_entity_id=j.accounting_entity_id
     and l.journal_entry_id=j.id
    join public.accounting_accounts a
      on a.accounting_entity_id=l.accounting_entity_id
     and a.id=l.account_id
    join public.financial_events e
      on e.accounting_entity_id=j.accounting_entity_id
     and e.id=j.financial_event_id
    left join public.accounting_equity_movement_policies p
      on p.accounting_entity_id=e.accounting_entity_id
     and p.event_type=e.event_type
     and p.status='active'
    where j.accounting_entity_id=p_accounting_entity_id
      and j.status='posted'
      and j.effective_at::date between p_from and p_to
      and a.account_type in ('equity','contra_equity')
      and coalesce(e.source_system,'') <> 'accounting_year_end'
    group by e.event_type,p.movement_category
    having abs(sum(l.credit-l.debit))>0.005
       and p.movement_category is null
  ) q;

  if v_unclassified>0 then
    raise exception 'EQUITY_MOVEMENT_CLASSIFICATION_REQUIRED';
  end if;

  return query
  with all_lines as (
    select
      j.effective_at::date as effective_date,
      e.event_type,
      e.source_system,
      a.account_type,
      (l.credit-l.debit)::numeric as signed_amount
    from public.accounting_journal_entries j
    join public.accounting_journal_lines l
      on l.accounting_entity_id=j.accounting_entity_id
     and l.journal_entry_id=j.id
    join public.accounting_accounts a
      on a.accounting_entity_id=l.accounting_entity_id
     and a.id=l.account_id
    join public.financial_events e
      on e.accounting_entity_id=j.accounting_entity_id
     and e.id=j.financial_event_id
    where j.accounting_entity_id=p_accounting_entity_id
      and j.status='posted'
      and a.account_type in (
        'equity','contra_equity',
        'revenue','contra_revenue','expense','contra_expense'
      )
      and j.effective_at::date<=p_to
  ),
  opening as (
    select coalesce(sum(signed_amount),0)::numeric as amount
    from all_lines
    where effective_date<p_from
  ),
  period_equity as (
    select
      p.movement_category,
      coalesce(sum(l.signed_amount),0)::numeric as amount
    from all_lines l
    join public.accounting_equity_movement_policies p
      on p.accounting_entity_id=p_accounting_entity_id
     and p.event_type=l.event_type
     and p.status='active'
    where l.effective_date between p_from and p_to
      and l.account_type in ('equity','contra_equity')
      and coalesce(l.source_system,'') <> 'accounting_year_end'
    group by p.movement_category
  ),
  earnings as (
    select coalesce(sum(signed_amount),0)::numeric as amount
    from all_lines
    where effective_date between p_from and p_to
      and account_type in (
        'revenue','contra_revenue','expense','contra_expense'
      )
      and coalesce(source_system,'') <> 'accounting_year_end'
  ),
  direct_close as (
    select coalesce(sum(signed_amount),0)::numeric as amount
    from all_lines
  ),
  totals as (
    select
      o.amount as opening_equity,
      coalesce(max(pe.amount) filter(
        where pe.movement_category='capital_contribution'
      ),0)::numeric as capital_contributions,
      coalesce(max(pe.amount) filter(
        where pe.movement_category='distribution'
      ),0)::numeric as distributions,
      coalesce(max(pe.amount) filter(
        where pe.movement_category='other_equity'
      ),0)::numeric as other_equity_movements,
      e.amount as current_period_earnings,
      dc.amount as direct_closing_equity
    from opening o
    cross join earnings e
    cross join direct_close dc
    left join period_equity pe on true
    group by o.amount,e.amount,dc.amount
  ),
  categories as (
    select * from (values
      ('capital_contribution'::text,1),
      ('distribution'::text,2),
      ('other_equity'::text,3),
      ('current_period_earnings'::text,4)
    ) v(category,sort_order)
  )
  select
    c.category,
    case c.category
      when 'capital_contribution' then t.capital_contributions
      when 'distribution' then t.distributions
      when 'other_equity' then t.other_equity_movements
      else t.current_period_earnings
    end::numeric,
    t.opening_equity,
    t.capital_contributions,
    t.distributions,
    t.other_equity_movements,
    t.current_period_earnings,
    (
      t.opening_equity+
      t.capital_contributions+
      t.distributions+
      t.other_equity_movements+
      t.current_period_earnings
    )::numeric,
    t.direct_closing_equity,
    (
      t.direct_closing_equity-
      (
        t.opening_equity+
        t.capital_contributions+
        t.distributions+
        t.other_equity_movements+
        t.current_period_earnings
      )
    )::numeric
  from totals t
  cross join categories c
  order by c.sort_order;
end;
$$;

revoke all on function public.accounting_changes_in_equity_statement_rows(
  uuid,date,date
) from public,anon,authenticated;
grant execute on function public.accounting_changes_in_equity_statement_rows(
  uuid,date,date
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
    'accounting_reporting_wave',20,
    'mapped_action',true
  )
from public.service_catalog s
cross join (values
  ('accounting_changes_in_equity_statement'::text,10,true),
  ('accounting_equity_movement_policy_configure'::text,20,false)
) x(capability_code,run_order,is_required)
where s.code='changes_in_equity'
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
  'accounting_changes_in_equity_statement',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  coalesce(p.version,0)+1,
  true,
  coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object(
    'accounting_reporting_wave',20,
    'canonical_source','posted_accounting_journal_lines',
    'classification_source','accounting_equity_movement_policies',
    'year_end_source','accounting_year_end',
    'fail_closed',true
  )
from public.service_catalog s
left join public.service_execution_profiles p
  on p.service_id=s.id
where s.code='changes_in_equity'
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
