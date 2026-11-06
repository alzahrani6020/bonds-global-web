begin;

insert into public.service_capability_map(
  service_id, capability_code, run_order, is_required, metadata
)
select s.id, 'accounting_period_initialize_monthly', 15, false,
       jsonb_build_object(
         'wave','period_onboarding_2026_11_05',
         'purpose','initialize_explicit_monthly_accounting_periods'
       )
from public.service_catalog s
where s.code='planning_budgeting_forecasting'
  and not exists (
    select 1
    from public.service_capability_map m
    where m.service_id=s.id
      and m.capability_code='accounting_period_initialize_monthly'
  );

update public.service_catalog
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'accounting_period_onboarding', true,
  'accounting_period_onboarding_mode', 'explicit_monthly'
),
updated_at=now()
where code='planning_budgeting_forecasting';

commit;
