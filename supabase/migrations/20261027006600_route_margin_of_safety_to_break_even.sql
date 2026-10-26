begin;

do $$
declare
  candidate_count integer;
begin
  select count(*) into candidate_count
  from public.service_catalog s
  join public.service_execution_profiles p
    on p.service_id=s.id and p.is_active=true
  where s.status='published'
    and s.is_active=true
    and s.code='margin_of_safety_analysis'
    and p.execution_mode='request_only'
    and p.primary_action is null;

  if candidate_count <> 1 then
    raise exception 'Expected margin_of_safety_analysis request-only candidate, found %', candidate_count;
  end if;
end $$;

update public.service_catalog
set
  default_route_ar='/calculators/break-even.html',
  default_route_en='/en/calculators/break-even.html',
  metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
    'workspace_route_source','existing_break_even_workspace',
    'workspace_route_metric','margin_of_safety',
    'workspace_route_wave','margin_of_safety_2026_10_26'
  ),
  updated_at=now()
where status='published'
  and is_active=true
  and code='margin_of_safety_analysis';

update public.service_execution_profiles p
set
  execution_status='partially_automated',
  tool_id='break-even',
  ai_mode='none',
  research_mode='none',
  version=p.version+1,
  metadata=coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object(
    'tool_workspace','break-even',
    'tool_metric','margin_of_safety',
    'execution_note','direct_tool_workspace_no_api_automation'
  ),
  updated_at=now()
from public.service_catalog s
where p.service_id=s.id
  and p.is_active=true
  and s.code='margin_of_safety_analysis'
  and p.execution_mode='request_only'
  and p.primary_action is null;

commit;
