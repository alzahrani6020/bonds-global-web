begin;

-- Wave 10: expose governed accounting operations through the existing
-- /services/execute path. No parallel API or execution engine is introduced.

insert into public.service_catalog(
  code,
  category_code,
  group_code,
  name_ar,
  name_en,
  short_description_ar,
  short_description_en,
  delivery_type,
  status,
  is_active,
  sort_order,
  metadata,
  updated_at
)
values (
  'accounting_operations',
  'financial_advisory',
  'accounting_records',
  'العمليات المحاسبية',
  'Accounting Operations',
  'تنفيذ عمليات محاسبية محكومة للأصول والإهلاك والفترات ومراكز التكلفة والقطاعات.',
  'Governed execution of accounting assets, depreciation, periods, cost centers and segments.',
  'automated',
  'published',
  true,
  15,
  jsonb_build_object(
    'source','financial_operations_core_wave10',
    'execution_boundary','services.execute',
    'deterministic',true
  ),
  now()
)
on conflict (code) do update
set
  category_code=excluded.category_code,
  group_code=excluded.group_code,
  name_ar=excluded.name_ar,
  name_en=excluded.name_en,
  short_description_ar=excluded.short_description_ar,
  short_description_en=excluded.short_description_en,
  delivery_type=excluded.delivery_type,
  status=excluded.status,
  is_active=excluded.is_active,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.service_execution_profiles(
  service_id,
  execution_status,
  execution_mode,
  primary_action,
  orchestrator_intent,
  tool_id,
  ai_mode,
  research_mode,
  token_mode,
  assistant_enabled,
  version,
  is_active,
  metadata,
  updated_at
)
select
  s.id,
  'automated',
  'capability_plan',
  'accounting_dimension_create',
  null,
  null,
  'none',
  'none',
  'as_required',
  true,
  1,
  true,
  jsonb_build_object(
    'multi_action',true,
    'action_source','body.action',
    'mapped_actions_only',true,
    'membership_enforced',true
  ),
  now()
from public.service_catalog s
where s.code='accounting_operations'
on conflict (service_id) do update
set
  execution_status=excluded.execution_status,
  execution_mode=excluded.execution_mode,
  primary_action=excluded.primary_action,
  ai_mode=excluded.ai_mode,
  research_mode=excluded.research_mode,
  token_mode=excluded.token_mode,
  assistant_enabled=excluded.assistant_enabled,
  version=excluded.version,
  is_active=excluded.is_active,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.service_capability_map(
  service_id,
  capability_code,
  run_order,
  is_required,
  metadata
)
select
  s.id,
  v.capability_code,
  v.run_order,
  true,
  jsonb_build_object('wave',10,'mapped_action',true)
from public.service_catalog s
cross join (
  values
    ('accounting_dimension_create',10),
    ('accounting_period_transition',20),
    ('accounting_asset_create',30),
    ('accounting_collateral_assign',40),
    ('accounting_depreciation_policy_configure',50),
    ('accounting_depreciation_post',60)
) as v(capability_code,run_order)
where s.code='accounting_operations'
on conflict (service_id,capability_code) do update
set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

commit;
