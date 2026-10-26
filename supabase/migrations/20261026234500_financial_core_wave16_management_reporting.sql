begin;

-- Wave 16: deterministic management reporting.
-- Reuses existing financial-engine runtime and /api/v3/services/execute.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,metadata,updated_at
)
values (
  'management_reporting',
  'financial_advisory',
  'financial_statements_reporting',
  'التقارير الإدارية',
  'Management Reporting',
  'إعداد حزم مالية إدارية حتمية للمدير المالي ومجلس الإدارة والتقرير الشهري وحزمة المؤشرات من البيانات الفعلية والموازنة والفترة السابقة.',
  'Compose deterministic CFO, board, monthly management and KPI packs from actual, budget, prior-period, KPI, risk and action inputs.',
  'automated',
  'published',
  true,
  154,
  '{"source":"financial_core_wave16","deterministic":true,"reuses_existing_financial_engine":true,"no_parallel_reporting_store":true,"no_ai_commentary":true}'::jsonb,
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
  'management_reporting_run',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  coalesce(p.version,0)+1,
  true,
  '{"source":"financial_core_wave16","deterministic":true,"fail_closed":true,"no_ai_commentary":true}'::jsonb,
  now()
from public.service_catalog s
left join public.service_execution_profiles p on p.service_id=s.id
where s.code='management_reporting'
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
  version=excluded.version,
  is_active=true,
  metadata=public.service_execution_profiles.metadata || excluded.metadata,
  updated_at=now();

insert into public.service_capability_map(
  service_id,capability_code,run_order,is_required,metadata
)
select
  s.id,
  'management_reporting_run',
  10,
  true,
  '{"wave":16,"deterministic":true}'::jsonb
from public.service_catalog s
where s.code='management_reporting'
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
