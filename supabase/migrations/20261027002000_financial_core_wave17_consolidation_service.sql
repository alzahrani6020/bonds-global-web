begin;

-- Financial Core Wave 17 service execution.
-- One consolidation service governs group setup, intercompany tagging,
-- deterministic consolidation calculation, and ledger-backed reporting.

insert into public.service_catalog(
  code,category_code,group_code,name_ar,name_en,
  short_description_ar,short_description_en,
  delivery_type,status,is_active,sort_order,metadata,updated_at
)
values (
  'consolidation_analysis',
  'financial_advisory',
  'financial_statements_reporting',
  'الدمج المالي ومعاملات الأطراف بين الشركات',
  'Financial Consolidation & Intercompany',
  'إعداد دمج مالي حتمي لمجموعة شركات من الدفاتر المنشورة مع مطابقة وإلغاء معاملات الأطراف بين الشركات وملكية الشركات التابعة.',
  'Prepare deterministic group financial consolidation from posted ledgers with governed ownership and intercompany reconciliation and eliminations.',
  'automated',
  'published',
  true,
  155,
  '{"source":"financial_core_wave17","deterministic":true,"no_parallel_ledger":true,"explicit_nci":true,"fx_translation_fail_closed":true}'::jsonb,
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
  'accounting_consolidation_report',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  coalesce(p.version,0)+1,
  true,
  '{"source":"financial_core_wave17","deterministic":true,"fail_closed":true,"no_parallel_ledger":true}'::jsonb,
  now()
from public.service_catalog s
left join public.service_execution_profiles p on p.service_id=s.id
where s.code='consolidation_analysis'
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
  x.capability_code,
  x.run_order,
  x.is_required,
  '{"wave":17,"deterministic":true}'::jsonb
from public.service_catalog s
cross join (
  values
    ('accounting_group_configure',10,false),
    ('accounting_intercompany_link',20,false),
    ('consolidation_run',30,false),
    ('accounting_consolidation_report',40,true)
) as x(capability_code,run_order,is_required)
where s.code='consolidation_analysis'
on conflict(service_id,capability_code) do update set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
