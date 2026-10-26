begin;

-- Activate only request-only services that already have exactly one governed,
-- deterministic financial capability mapped in the canonical capability map.
-- Fail closed if the verified production candidate set changes unexpectedly.
do $$
declare
  candidate_count integer;
begin
  with candidates as (
    select p.service_id
    from public.service_execution_profiles p
    join public.service_catalog s on s.id = p.service_id
    join public.service_capability_map m on m.service_id = p.service_id
    where s.status = 'published'
      and s.is_active = true
      and p.is_active = true
      and p.execution_mode = 'request_only'
      and p.primary_action is null
      group by p.service_id
    having count(*) = 1
       and bool_and(m.capability_code in (
         'financial_analysis_run',
         'risk_analysis_run',
         'funding_readiness_run',
         'cash_flow_analysis_run',
         'scenario_forecast_run'
       ))
  )
  select count(*) into candidate_count from candidates;

  if candidate_count <> 36 then
    raise exception 'Expected 36 mapped request-only activation candidates, found %', candidate_count;
  end if;
end $$;

with candidates as (
  select
    p.service_id,
    min(m.capability_code) as primary_action
  from public.service_execution_profiles p
  join public.service_catalog s on s.id = p.service_id
  join public.service_capability_map m on m.service_id = p.service_id
  where s.status = 'published'
    and s.is_active = true
    and p.is_active = true
    and p.execution_mode = 'request_only'
    and p.primary_action is null
  group by p.service_id
  having count(*) = 1
     and bool_and(m.capability_code in (
       'financial_analysis_run',
       'risk_analysis_run',
       'funding_readiness_run',
       'cash_flow_analysis_run',
       'scenario_forecast_run'
     ))
)
update public.service_execution_profiles p
set
  execution_status = 'partially_automated',
  execution_mode = 'capability_plan',
  primary_action = c.primary_action,
  ai_mode = 'none',
  research_mode = 'none',
  version = p.version + 1,
  metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
    'activation_source', 'existing_governed_capability_map',
    'activation_wave', 'workspace_activation_2026_10_26'
  ),
  updated_at = now()
from candidates c
where p.service_id = c.service_id;

commit;
