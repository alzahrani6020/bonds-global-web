begin;

-- Wave 12: governed credit-risk expected-loss capability.
-- This does not estimate PD/LGD from an internal score.
-- It requires explicit governed parameters or calibrated model metadata.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,metadata,updated_at
)
values (
  'credit_risk_expected_loss',
  'financial_advisory',
  'risk_resilience',
  'تحليل مخاطر الائتمان والخسارة المتوقعة',
  'Credit Risk Expected Loss Analysis',
  'حساب الخسارة الائتمانية المتوقعة باستخدام PD وLGD وEAD موثقة مع سيناريو ضغط وحوكمة مصدر المعلمات.',
  'Calculate expected credit loss from governed PD, LGD and EAD parameters with stress analysis and parameter provenance.',
  'automated',
  'published',
  true,
  149,
  '{"source":"financial_core_wave12","deterministic":true,"requires_governed_parameters":true,"does_not_infer_pd_lgd_from_score":true}'::jsonb,
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
  'credit_risk_run',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  1,
  true,
  '{"source":"financial_core_wave12","deterministic":true,"fail_closed":true,"requires_parameter_source":true}'::jsonb,
  now()
from public.service_catalog s
where s.code='credit_risk_expected_loss'
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
  'credit_risk_run',
  10,
  true,
  '{"wave":12,"deterministic":true,"requires_governed_parameters":true}'::jsonb
from public.service_catalog s
where s.code='credit_risk_expected_loss'
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
