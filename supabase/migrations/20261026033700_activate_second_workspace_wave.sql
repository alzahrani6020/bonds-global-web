begin;

-- Activate the second verified workspace wave using only capabilities that
-- already exist in the governed runtime. Fail closed if the catalog state
-- differs from the verified production inventory.

do $$
declare
  candidate_count integer;
  preexisting_map_count integer;
begin
  select count(*) into candidate_count
  from public.service_catalog s
  join public.service_execution_profiles p
    on p.service_id=s.id and p.is_active=true
  where s.status='published'
    and s.is_active=true
    and p.execution_mode='request_only'
    and p.primary_action is null
    and s.code in (
      'variance_analysis',
      'budgeting_forecasting',
      'cost_centers',
      'financial_closing',
      'financial_ratios',
      'liquidity_analysis'
    );

  if candidate_count <> 6 then
    raise exception 'Expected 6 second-wave request-only candidates, found %', candidate_count;
  end if;

  select count(*) into preexisting_map_count
  from public.service_capability_map m
  join public.service_catalog s on s.id=m.service_id
  where s.code in (
    'variance_analysis',
    'budgeting_forecasting',
    'cost_centers',
    'financial_closing',
    'financial_ratios',
    'liquidity_analysis'
  );

  if preexisting_map_count <> 0 then
    raise exception 'Expected no pre-existing capability mappings for second-wave candidates, found %', preexisting_map_count;
  end if;
end $$;

-- Deterministic analysis services.
insert into public.service_capability_map(service_id,capability_code,run_order,is_required)
select s.id, x.capability_code, x.run_order, x.is_required
from public.service_catalog s
join (values
  ('variance_analysis','management_reporting_run',10,true),
  ('budgeting_forecasting','scenario_forecast_run',10,true),
  ('financial_ratios','financial_analysis_run',10,true),
  ('liquidity_analysis','financial_analysis_run',10,true)
) as x(service_code,capability_code,run_order,is_required)
  on x.service_code=s.code
where s.status='published' and s.is_active=true
on conflict(service_id,capability_code) do update
set run_order=excluded.run_order,is_required=excluded.is_required;

-- Cost-center workspace: create/configure/allocate/report using the canonical
-- accounting dimension subsystem.
insert into public.service_capability_map(service_id,capability_code,run_order,is_required)
select s.id, x.capability_code, x.run_order, x.is_required
from public.service_catalog s
cross join (values
  ('accounting_dimension_create',10,true),
  ('accounting_dimension_policy_configure',20,false),
  ('accounting_allocation_rule_configure',30,false),
  ('accounting_allocation_execute',40,false),
  ('accounting_dimension_income_statement',50,false),
  ('accounting_dimension_financial_position',60,false),
  ('accounting_dimension_ledger_report',70,false)
) as x(capability_code,run_order,is_required)
where s.code='cost_centers'
  and s.status='published' and s.is_active=true
on conflict(service_id,capability_code) do update
set run_order=excluded.run_order,is_required=excluded.is_required;

-- Financial closing workspace: monthly/period close plus governed year-end
-- policy, close and reopen. Primary action remains period transition.
insert into public.service_capability_map(service_id,capability_code,run_order,is_required)
select s.id, x.capability_code, x.run_order, x.is_required
from public.service_catalog s
cross join (values
  ('accounting_period_transition',10,true),
  ('accounting_year_end_policy_configure',20,false),
  ('accounting_year_end_close',30,false),
  ('accounting_year_end_reopen',40,false)
) as x(capability_code,run_order,is_required)
where s.code='financial_closing'
  and s.status='published' and s.is_active=true
on conflict(service_id,capability_code) do update
set run_order=excluded.run_order,is_required=excluded.is_required;

with activation(service_code,primary_action) as (
  values
    ('variance_analysis','management_reporting_run'),
    ('budgeting_forecasting','scenario_forecast_run'),
    ('cost_centers','accounting_dimension_create'),
    ('financial_closing','accounting_period_transition'),
    ('financial_ratios','financial_analysis_run'),
    ('liquidity_analysis','financial_analysis_run')
)
update public.service_execution_profiles p
set
  execution_status='partially_automated',
  execution_mode='capability_plan',
  primary_action=a.primary_action,
  ai_mode='none',
  research_mode='none',
  version=p.version+1,
  metadata=coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object(
    'activation_source','existing_governed_runtime',
    'activation_wave','workspace_activation_wave2_2026_10_26'
  ),
  updated_at=now()
from public.service_catalog s
join activation a on a.service_code=s.code
where p.service_id=s.id
  and p.is_active=true
  and p.execution_mode='request_only'
  and p.primary_action is null;

commit;
