begin;

-- Wave 11: strengthen liquidity planning and add canonical debt/covenant execution.
-- Reuses the existing financial-engine service, capability registry and /services/execute path.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,metadata,updated_at
)
values
(
  'thirteen_week_cash_forecast','financial_advisory','planning_cashflow',
  'التوقع النقدي لمدة 13 أسبوعًا','13-Week Cash Forecast',
  'توقع نقدي أسبوعي صريح لمدة 13 أسبوعًا مع كشف فجوات السيولة وتوقيت العجز.',
  'Explicit 13-week weekly cash forecast with liquidity-gap and deficit timing analysis.',
  'automated','published',true,145,
  '{"source":"financial_core_wave11","deterministic":true,"requires_exact_13_periods":true}'::jsonb,now()
),
(
  'cash_runway_analysis','financial_advisory','working_capital_cash',
  'تحليل مدة استمرار السيولة','Cash Runway Analysis',
  'قياس مدة استمرار السيولة فوق حد نقدي أدنى باستخدام الحرق الصافي المتوقع.',
  'Measure runway above an explicit minimum-cash threshold using forecast net burn.',
  'automated','published',true,146,
  '{"source":"financial_core_wave11","deterministic":true,"requires_minimum_cash_threshold":true}'::jsonb,now()
),
(
  'debt_schedule_analysis','financial_advisory','leverage_capital_debt',
  'جدول خدمة واستحقاقات الدين','Debt Schedule Analysis',
  'إنشاء جدول حتمي لأصل الدين والفوائد وخدمة الدين والاستحقاقات لكل تسهيل تمويلي.',
  'Build deterministic principal, interest, debt-service and maturity schedules per facility.',
  'automated','published',true,147,
  '{"source":"financial_core_wave11","deterministic":true}'::jsonb,now()
),
(
  'covenant_monitoring','financial_advisory','leverage_capital_debt',
  'مراقبة التعهدات والشروط التمويلية','Covenant Monitoring',
  'قياس الالتزام بالتعهدات المالية وهامش الأمان والتنبؤ بأول فترة إخلال.',
  'Evaluate financial covenant compliance, headroom and first forecast breach period.',
  'automated','published',true,148,
  '{"source":"financial_core_wave11","deterministic":true,"fail_closed":true}'::jsonb,now()
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
  s.id,'automated','capability_plan',
  case
    when s.code in ('thirteen_week_cash_forecast','cash_runway_analysis')
      then 'cash_flow_analysis_run'
    when s.code='debt_schedule_analysis'
      then 'debt_schedule_run'
    when s.code='covenant_monitoring'
      then 'covenant_monitoring_run'
  end,
  null,null,'none','none','as_required',true,1,true,
  jsonb_build_object(
    'source','financial_core_wave11',
    'deterministic',true,
    'fail_closed',true
  ),
  now()
from public.service_catalog s
where s.code in (
  'thirteen_week_cash_forecast',
  'cash_runway_analysis',
  'debt_schedule_analysis',
  'covenant_monitoring'
)
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

insert into public.service_capability_map(service_id,capability_code,run_order,is_required,metadata)
select s.id, m.capability_code, 10, true,
       '{"wave":11,"deterministic":true}'::jsonb
from public.service_catalog s
join (
  values
    ('thirteen_week_cash_forecast','cash_flow_analysis_run'),
    ('cash_runway_analysis','cash_flow_analysis_run'),
    ('debt_schedule_analysis','debt_schedule_run'),
    ('covenant_monitoring','covenant_monitoring_run')
) as m(service_code,capability_code)
on s.code=m.service_code
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
