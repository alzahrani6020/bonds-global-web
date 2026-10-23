begin;

do $$
declare
  baseline_count integer;
  capability_count integer;
begin
  select count(*) into baseline_count
  from public.service_catalog s
  join public.service_execution_profiles p
    on p.service_id=s.id
  where s.code='cash_generation_analysis'
    and s.status='published'
    and s.is_active=true
    and p.is_active=true
    and p.execution_status='request_only'
    and p.execution_mode='request_only'
    and p.primary_action is null
    and p.version=1;

  if baseline_count <> 1 then
    raise exception 'batch 6A-2 baseline mismatch';
  end if;

  select count(*) into capability_count
  from public.service_catalog s
  join public.service_capability_map m
    on m.service_id=s.id
  where s.code='cash_generation_analysis'
    and m.capability_code='cash_flow_analysis_run'
    and m.is_required=true;

  if capability_count <> 1 then
    raise exception 'batch 6A-2 capability mismatch';
  end if;
end
$$;

update public.service_execution_profiles p
set execution_status='automated',
    execution_mode='capability_plan',
    primary_action='cash_flow_analysis_run',
    version=p.version+1,
    metadata=coalesce(p.metadata,'{}'::jsonb) ||
      jsonb_build_object(
        'service_execution_batch','6A-2',
        'cash_flow_metric','cash_generation',
        'cash_generation_method','period_net_cash_generation',
        'requires_explicit_opening_balance',true
      ),
    updated_at=now()
from public.service_catalog s
where p.service_id=s.id
  and s.code='cash_generation_analysis'
  and s.status='published'
  and s.is_active=true
  and p.is_active=true;

commit;
