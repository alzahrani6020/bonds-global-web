begin;

-- Batch 3 only promotes services whose named output is directly supported by
-- the existing deterministic financial engine. Capability mappings for broader
-- services stay discoverable but are not made primary until a matching engine exists.

do $$
declare
  baseline_count integer;
  capability_count integer;
begin
  select count(*)
    into baseline_count
  from public.service_catalog s
  join public.service_execution_profiles p on p.service_id=s.id
  where s.status='published'
    and s.is_active=true
    and p.is_active=true
    and (
      (
        s.code='financial_analysis'
        and p.execution_status='request_only'
        and p.execution_mode='request_only'
        and p.primary_action is null
        and p.version=1
      )
      or
      (
        s.code='dscr_analysis'
        and p.execution_status='request_only'
        and p.execution_mode='request_only'
        and p.primary_action is null
        and p.version=1
      )
      or
      (
        s.code='scenario_analysis'
        and p.execution_status='request_only'
        and p.execution_mode='request_only'
        and p.primary_action is null
        and p.version=1
      )
      or
      (
        s.code='cashflow_management'
        and p.execution_status='partially_automated'
        and p.execution_mode='capability_plan'
        and p.primary_action='calculator_open'
        and p.tool_id='cash-flow'
        and p.version=2
      )
    );

  if baseline_count <> 4 then
    raise exception
      'service execution batch 3 baseline mismatch: expected 4 profiles, found %',
      baseline_count;
  end if;

  select count(*)
    into capability_count
  from public.service_catalog s
  join public.service_capability_map m on m.service_id=s.id
  where (s.code='financial_analysis' and m.capability_code='financial_analysis_run')
     or (s.code='cashflow_management' and m.capability_code='cash_flow_analysis_run')
     or (s.code='dscr_analysis' and m.capability_code='funding_readiness_run')
     or (s.code='scenario_analysis' and m.capability_code='scenario_forecast_run');

  if capability_count <> 4 then
    raise exception
      'service execution batch 3 capability mismatch: expected 4 mappings, found %',
      capability_count;
  end if;
end
$$;

with desired(service_code, primary_action) as (
  values
    ('financial_analysis','financial_analysis_run'),
    ('cashflow_management','cash_flow_analysis_run'),
    ('dscr_analysis','funding_readiness_run'),
    ('scenario_analysis','scenario_forecast_run')
)
update public.service_execution_profiles p
set execution_status='automated',
    execution_mode='capability_plan',
    primary_action=d.primary_action,
    version=p.version+1,
    metadata=coalesce(p.metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'direct_financial_engine_primary', true,
        'service_execution_batch', 3
      ),
    updated_at=now()
from desired d
join public.service_catalog s on s.code=d.service_code
where p.service_id=s.id
  and s.status='published'
  and s.is_active=true
  and p.is_active=true;

commit;
