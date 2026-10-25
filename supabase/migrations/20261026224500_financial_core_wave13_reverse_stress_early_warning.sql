begin;

-- Wave 13: strengthen existing risk/scenario engines for early warning and reverse stress.
-- No parallel API or registry is introduced.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,metadata,updated_at
)
values (
  'reverse_stress_testing',
  'financial_advisory',
  'risk_resilience',
  'اختبارات الضغط العكسية',
  'Reverse Stress Testing',
  'تحديد مقدار الصدمة المطلوبة للوصول إلى حد فشل مالي صريح باستخدام حساسية موثقة لكل مؤشر.',
  'Determine the shock required to reach an explicit financial failure threshold using governed metric sensitivity.',
  'automated',
  'published',
  true,
  150,
  '{"source":"financial_core_wave13","deterministic":true,"requires_explicit_sensitivity":true,"no_hidden_thresholds":true}'::jsonb,
  now()
)
on conflict(code) do update set
  category_code=excluded.category_code,
  group_code=excluded.group_code,
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  short_description_ar=excluded.short_description_ar,
  short_description_en=excluded.short_description_en,
  delivery_type=excluded.delivery_type,
  status='published',
  is_active=true,
  sort_order=excluded.sort_order,
  metadata=public.service_catalog.metadata || excluded.metadata,
  updated_at=now();

insert into public.service_execution_profiles(
  service_id,execution_status,execution_mode,primary_action,
  orchestrator_intent,tool_id,ai_mode,research_mode,token_mode,
  assistant_enabled,version,is_active,metadata,updated_at
)
select
  s.id,
  'automated',
  'capability_plan',
  case
    when s.code='early_warning_analysis' then 'risk_analysis_run'
    when s.code='reverse_stress_testing' then 'scenario_forecast_run'
  end,
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  1,
  true,
  jsonb_build_object(
    'source','financial_core_wave13',
    'deterministic',true,
    'fail_closed',true,
    'service_scope_required',true
  ),
  now()
from public.service_catalog s
where s.code in ('early_warning_analysis','reverse_stress_testing')
on conflict(service_id) do update set
  execution_status=excluded.execution_status,
  execution_mode=excluded.execution_mode,
  primary_action=excluded.primary_action,
  orchestrator_intent=null,
  tool_id=null,
  ai_mode='none',
  research_mode='none',
  token_mode='as_required',
  assistant_enabled=true,
  is_active=true,
  metadata=public.service_execution_profiles.metadata || excluded.metadata,
  updated_at=now();

insert into public.service_capability_map(
  service_id,capability_code,run_order,is_required,metadata
)
select
  s.id,
  case
    when s.code='early_warning_analysis' then 'risk_analysis_run'
    when s.code='reverse_stress_testing' then 'scenario_forecast_run'
  end,
  10,
  true,
  '{"wave":13,"deterministic":true,"service_scoped":true}'::jsonb
from public.service_catalog s
where s.code in ('early_warning_analysis','reverse_stress_testing')
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
