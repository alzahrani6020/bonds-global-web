begin;

insert into public.service_capability_map(
  service_id, capability_code, run_order, is_required, metadata
)
select s.id, x.capability_code, x.run_order, false,
       jsonb_build_object(
         'wave','chart_fiscal_onboarding_2026_11_05',
         'purpose',x.purpose
       )
from public.service_catalog s
cross join (values
  ('accounting_account_create', 12, 'create_governed_chart_account'),
  ('accounting_year_end_policy_configure', 13, 'configure_explicit_fiscal_year_policy')
) as x(capability_code, run_order, purpose)
where s.code='planning_budgeting_forecasting'
  and not exists (
    select 1
    from public.service_capability_map m
    where m.service_id=s.id
      and m.capability_code=x.capability_code
  );

update public.service_catalog
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'chart_of_accounts_onboarding', true,
  'fiscal_year_policy_onboarding', true,
  'fiscal_year_policy_mode', 'explicit'
),
updated_at=now()
where code='planning_budgeting_forecasting';

commit;
