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
    and p.execution_mode='request_only'
    and p.primary_action is null
    and s.code in ('trial_balance','financial_statements');

  if candidate_count <> 2 then
    raise exception 'Expected 2 ledger-report activation candidates, found %', candidate_count;
  end if;

  select count(*) into mapped_count
  from public.service_capability_map m
  join public.service_catalog s on s.id=m.service_id
  where s.code in ('trial_balance','financial_statements');

  if mapped_count <> 0 then
    raise exception 'Expected no existing ledger-report mappings, found %', mapped_count;
  end if;
end $$;

insert into public.service_capability_map(service_id,capability_code,run_order,is_required)
select s.id, x.capability_code, 10, true
from public.service_catalog s
join (values
  ('trial_balance','accounting_trial_balance_report'),
  ('financial_statements','accounting_financial_statements_report')
) as x(service_code,capability_code)
  on x.service_code=s.code
where s.status='published' and s.is_active=true
on conflict(service_id,capability_code) do update
set run_order=excluded.run_order,is_required=excluded.is_required;

with activation(service_code,primary_action) as (
  values
    ('trial_balance','accounting_trial_balance_report'),
    ('financial_statements','accounting_financial_statements_report')
)
update public.service_execution_profiles p
set
  execution_status='automated',
  execution_mode='capability_plan',
  primary_action=a.primary_action,
  ai_mode='none',
  research_mode='none',
  version=p.version+1,
  metadata=coalesce(p.metadata,'{}'::jsonb) || jsonb_build_object(
    'activation_source','canonical_accounting_ledger',
    'activation_wave','ledger_reports_2026_10_26'
  ),
  updated_at=now()
from public.service_catalog s
join activation a on a.service_code=s.code
where p.service_id=s.id
  and p.is_active=true
  and p.execution_mode='request_only'
  and p.primary_action is null;

commit;
