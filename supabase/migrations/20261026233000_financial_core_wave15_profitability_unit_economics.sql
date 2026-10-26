begin;

-- Wave 15: profitability intelligence + unit economics.
-- Reuses existing cost allocation and governed financial-engine execution.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,metadata,updated_at
)
values
(
  'profitability_analysis',
  'financial_advisory',
  'core_financial_analysis',
  'تحليل الربحية',
  'Profitability Analysis',
  'تحليل ربحيّة العميل أو المنتج أو الفرع أو المشروع أو القطاع أو مركز التكلفة باستخدام التكاليف المباشرة والموزعة.',
  'Analyze profitability by customer, product, branch, project, segment or cost center using explicit direct and allocated costs.',
  'automated',
  'published',
  true,
  152,
  '{"source":"financial_core_wave15","deterministic":true,"uses_existing_cost_allocation":true,"dimensional_profitability":true}'::jsonb,
  now()
),
(
  'unit_economics_analysis',
  'financial_advisory',
  'returns_margins',
  'تحليل اقتصاديات الوحدة',
  'Unit Economics Analysis',
  'احتساب تكلفة اكتساب العميل والقيمة العمرية ونسبة LTV إلى CAC وفترة الاسترداد وربحية الوحدة من مدخلات صريحة.',
  'Calculate CAC, LTV, LTV-to-CAC, payback and unit contribution economics from explicit inputs.',
  'automated',
  'published',
  true,
  153,
  '{"source":"financial_core_wave15","deterministic":true,"no_inferred_ltv_without_support":true}'::jsonb,
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
    when s.code='profitability_analysis' then 'profitability_intelligence_run'
    when s.code='unit_economics_analysis' then 'unit_economics_run'
  end,
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  coalesce(p.version,0)+1,
  true,
  jsonb_build_object(
    'source','financial_core_wave15',
    'deterministic',true,
    'fail_closed',true,
    'uses_existing_cost_allocation',s.code='profitability_analysis'
  ),
  now()
from public.service_catalog s
left join public.service_execution_profiles p on p.service_id=s.id
where s.code in ('profitability_analysis','unit_economics_analysis')
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
  case
    when s.code='profitability_analysis' then 'profitability_intelligence_run'
    when s.code='unit_economics_analysis' then 'unit_economics_run'
  end,
  10,
  true,
  '{"wave":15,"deterministic":true}'::jsonb
from public.service_catalog s
where s.code in ('profitability_analysis','unit_economics_analysis')
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
