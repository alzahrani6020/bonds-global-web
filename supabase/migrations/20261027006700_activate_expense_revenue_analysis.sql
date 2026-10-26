begin;

do $$
declare
  candidate_count integer;
  mapped_count integer;
begin
  select count(*) into candidate_count
  from public.service_catalog s
  join public.service_execution_profiles p
    on p.service_id=s.id and p.is_active=true
  where s.status='published'
    and s.is_active=true
    and s.code='expense_revenue_analysis'
    and p.execution_mode='request_only'
    and p.primary_action is null;

  if candidate_count <> 1 then
    raise exception 'Expected expense_revenue_analysis request-only candidate, found %', candidate_count;
  end if;

  select count(*) into mapped_count
  from public.service_capability_map m
  join public.service_catalog s on s.id=m.service_id
  where s.code='expense_revenue_analysis';

  if mapped_count <> 0 then
    raise exception 'Expected no existing expense_revenue_analysis capability mapping, found %', mapped_count;
  end if;
end $$;

insert into public.service_capability_map(service_id,capability_code,run_order,is_required)
select s.id,'financial_analysis_run',10,true
from public.service_catalog s
where s.code='expense_revenue_analysis'
  and s.status='published'
  and s.is_active=true
on conflict(service_id,capability_code) do update
set run_order=excluded.run_order,is_required=excluded.is_required;

update public.service_execution_profiles p
set
  execution_status='partially_automated',
  execution_mode='capability_plan',
  primary_action='financial_analysis_run',
  ai_mode='none',
  research_mode='none',
  version=p.version+1,
  metadata=coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object(
    'activation_source','scoped_deterministic_financial_analysis',
    'activation_wave','expense_revenue_analysis_2026_10_26',
    'required_inputs',jsonb_build_array('revenue','total_expenses')
  ),
  updated_at=now()
from public.service_catalog s
where p.service_id=s.id
  and p.is_active=true
  and s.code='expense_revenue_analysis'
  and p.execution_mode='request_only'
  and p.primary_action is null;

commit;
