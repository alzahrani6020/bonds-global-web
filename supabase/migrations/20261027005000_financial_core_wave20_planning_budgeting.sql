begin;

-- Financial Core Wave 20: deterministic planning, budgeting and rolling forecast.
-- One governed service and one engine capability; no parallel planning store,
-- no AI-generated budget values, and no inferred growth or seasonality.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,metadata,updated_at
)
values (
  'planning_budgeting_forecasting',
  'financial_advisory',
  'financial_statements_reporting',
  'التخطيط والموازنات والتنبؤ المالي',
  'Planning, Budgeting & Forecasting',
  'تحليل حتمي للموازنة مقابل الفعلي وإدارة الانحرافات وبناء التوقع المتجدد من القيم الفعلية والتوقعات المستقبلية الصريحة فقط.',
  'Deterministic actual-versus-budget variance analysis and rolling forecast built only from actuals and explicit future forecast values.',
  'automated',
  'published',
  true,
  155,
  '{"source":"financial_core_wave20","deterministic":true,"single_planning_service":true,"no_parallel_planning_store":true,"no_ai_budget_values":true,"no_inferred_growth":true,"no_inferred_seasonality":true}'::jsonb,
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
  'planning_budgeting_run',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  coalesce(p.version,0)+1,
  true,
  '{"source":"financial_core_wave20","deterministic":true,"fail_closed":true,"explicit_future_values":true}'::jsonb,
  now()
from public.service_catalog s
left join public.service_execution_profiles p on p.service_id=s.id
where s.code='planning_budgeting_forecasting'
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
  'planning_budgeting_run',
  10,
  true,
  '{"wave":20,"deterministic":true,"explicit_future_values":true}'::jsonb
from public.service_catalog s
where s.code='planning_budgeting_forecasting'
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
