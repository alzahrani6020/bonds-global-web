
begin;

create table if not exists public.service_categories (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category_code text references public.service_categories(code) on delete set null,
  name_ar text not null,
  name_en text not null,
  short_description_ar text,
  short_description_en text,
  delivery_type text not null default 'advisory' check (delivery_type in ('advisory','automated','hybrid','portal','knowledge')),
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  default_route_ar text,
  default_route_en text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_goals (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.service_goal_map (
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  goal_code text not null references public.service_goals(code) on delete cascade,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  primary key (service_id, goal_code)
);

create table if not exists public.service_country_map (
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  country_code text not null references public.country_profiles(country_code) on delete cascade,
  availability_status text not null default 'unknown' check (availability_status in ('unknown','available','custom','restricted','unavailable')),
  availability_reason_ar text,
  availability_reason_en text,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (service_id, country_code)
);

create table if not exists public.service_sector_map (
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  sector_code text not null references public.canonical_investment_sectors(code) on delete cascade,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  primary key (service_id, sector_code)
);

create table if not exists public.service_activity_map (
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  canonical_activity_id uuid not null references public.canonical_activities(id) on delete cascade,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  primary key (service_id, canonical_activity_id)
);

create table if not exists public.service_capability_map (
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  capability_code text not null,
  engine_route text,
  run_order integer not null default 100,
  is_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  primary key (service_id, capability_code)
);

create table if not exists public.service_form_definitions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  code text not null,
  name_ar text not null,
  name_en text not null,
  country_code text references public.country_profiles(country_code) on delete cascade,
  sector_code text references public.canonical_investment_sectors(code) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  is_active boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_id, code, country_code, sector_code, version)
);

create table if not exists public.service_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.service_form_definitions(id) on delete cascade,
  field_key text not null,
  label_ar text not null,
  label_en text not null,
  field_type text not null check (field_type in ('text','textarea','number','money','percentage','date','select','multiselect','checkbox','file','table','section','instruction')),
  is_required boolean not null default false,
  sort_order integer not null default 0,
  placeholder_ar text,
  placeholder_en text,
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique(form_id, field_key)
);

create table if not exists public.service_requirements (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  country_code text references public.country_profiles(country_code) on delete cascade,
  sector_code text references public.canonical_investment_sectors(code) on delete cascade,
  requirement_type text not null default 'document' check (requirement_type in ('document','data','approval','license','other')),
  label_ar text not null,
  label_en text,
  is_required boolean not null default true,
  sort_order integer not null default 0,
  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.service_deliverables (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  code text not null,
  name_ar text not null,
  name_en text,
  deliverable_type text not null default 'report',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique(service_id, code)
);

create table if not exists public.service_dependencies (
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  depends_on_service_id uuid not null references public.service_catalog(id) on delete cascade,
  dependency_type text not null default 'recommended' check (dependency_type in ('required','recommended','next')),
  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  primary key(service_id, depends_on_service_id, dependency_type),
  check(service_id <> depends_on_service_id)
);

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_package_items (
  package_id uuid not null references public.service_packages(id) on delete cascade,
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  primary key(package_id, service_id)
);

create table if not exists public.service_pricing (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  country_code text references public.country_profiles(country_code) on delete cascade,
  sector_code text references public.canonical_investment_sectors(code) on delete cascade,
  pricing_type text not null check (pricing_type in ('fixed','starting_from','quote','tiered')),
  currency_code text,
  amount numeric,
  min_amount numeric,
  max_amount numeric,
  conditions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  valid_from date,
  valid_to date,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_reference text not null unique default ('SR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid,
  service_id uuid not null references public.service_catalog(id),
  package_id uuid references public.service_packages(id),
  goal_code text references public.service_goals(code),
  country_code text references public.country_profiles(country_code),
  region_code text,
  region_name text,
  locality_code text,
  locality_name text,
  sector_code text references public.canonical_investment_sectors(code),
  canonical_activity_id uuid references public.canonical_activities(id),
  status text not null default 'draft' check (status in ('draft','submitted','triage','in_progress','awaiting_client','awaiting_approval','completed','cancelled')),
  crm_opportunity_id uuid,
  funding_case_id uuid,
  valuation_id uuid,
  workflow_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_requests_user_created on public.service_requests(user_id, created_at desc);
create index if not exists idx_service_requests_service_status on public.service_requests(service_id, status);
create index if not exists idx_service_country_map_country on public.service_country_map(country_code, availability_status);
create index if not exists idx_service_sector_map_sector on public.service_sector_map(sector_code);
create index if not exists idx_service_activity_map_activity on public.service_activity_map(canonical_activity_id);

create table if not exists public.service_request_values (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  field_key text not null,
  value jsonb not null default 'null'::jsonb,
  form_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_request_id, field_key)
);

create table if not exists public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  quote_number text not null unique default ('Q-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','converted')),
  currency_code text,
  subtotal numeric,
  tax_amount numeric,
  total_amount numeric,
  valid_until date,
  terms jsonb not null default '{}'::jsonb,
  finance_contract_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nps_surveys add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;
alter table public.crm_opportunities add column if not exists service_request_id uuid references public.service_requests(id) on delete set null;

alter table public.service_categories enable row level security;
alter table public.service_catalog enable row level security;
alter table public.service_goals enable row level security;
alter table public.service_goal_map enable row level security;
alter table public.service_country_map enable row level security;
alter table public.service_sector_map enable row level security;
alter table public.service_activity_map enable row level security;
alter table public.service_capability_map enable row level security;
alter table public.service_form_definitions enable row level security;
alter table public.service_form_fields enable row level security;
alter table public.service_requirements enable row level security;
alter table public.service_deliverables enable row level security;
alter table public.service_dependencies enable row level security;
alter table public.service_packages enable row level security;
alter table public.service_package_items enable row level security;
alter table public.service_pricing enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_values enable row level security;
alter table public.service_quotes enable row level security;

drop policy if exists "Public read published service catalog" on public.service_catalog;
create policy "Public read published service catalog" on public.service_catalog for select to anon, authenticated using (status='published' and is_active=true);
drop policy if exists "Public read active service categories" on public.service_categories;
create policy "Public read active service categories" on public.service_categories for select to anon, authenticated using (is_active=true);
drop policy if exists "Public read active service goals" on public.service_goals;
create policy "Public read active service goals" on public.service_goals for select to anon, authenticated using (is_active=true);
drop policy if exists "Public read service goal map" on public.service_goal_map;
create policy "Public read service goal map" on public.service_goal_map for select to anon, authenticated using (true);
drop policy if exists "Public read service country map" on public.service_country_map;
create policy "Public read service country map" on public.service_country_map for select to anon, authenticated using (true);
drop policy if exists "Public read service sector map" on public.service_sector_map;
create policy "Public read service sector map" on public.service_sector_map for select to anon, authenticated using (true);
drop policy if exists "Public read service activity map" on public.service_activity_map;
create policy "Public read service activity map" on public.service_activity_map for select to anon, authenticated using (true);
drop policy if exists "Public read service capability map" on public.service_capability_map;
create policy "Public read service capability map" on public.service_capability_map for select to anon, authenticated using (true);
drop policy if exists "Public read service forms" on public.service_form_definitions;
create policy "Public read service forms" on public.service_form_definitions for select to anon, authenticated using (status='published' and is_active=true);
drop policy if exists "Public read service form fields" on public.service_form_fields;
create policy "Public read service form fields" on public.service_form_fields for select to anon, authenticated using (true);
drop policy if exists "Public read service requirements" on public.service_requirements;
create policy "Public read service requirements" on public.service_requirements for select to anon, authenticated using (true);
drop policy if exists "Public read service deliverables" on public.service_deliverables;
create policy "Public read service deliverables" on public.service_deliverables for select to anon, authenticated using (true);
drop policy if exists "Public read service dependencies" on public.service_dependencies;
create policy "Public read service dependencies" on public.service_dependencies for select to anon, authenticated using (true);
drop policy if exists "Public read published packages" on public.service_packages;
create policy "Public read published packages" on public.service_packages for select to anon, authenticated using (status='published' and is_active=true);
drop policy if exists "Public read package items" on public.service_package_items;
create policy "Public read package items" on public.service_package_items for select to anon, authenticated using (true);
drop policy if exists "Authenticated read active pricing" on public.service_pricing;
create policy "Authenticated read active pricing" on public.service_pricing for select to authenticated using (is_active=true);

drop policy if exists "Users insert own service requests" on public.service_requests;
create policy "Users insert own service requests" on public.service_requests for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users read own service requests" on public.service_requests;
create policy "Users read own service requests" on public.service_requests for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users update own draft service requests" on public.service_requests;
create policy "Users update own draft service requests" on public.service_requests
for update to authenticated using ((select auth.uid()) = user_id and status in ('draft','awaiting_client'))
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own service request values" on public.service_request_values;
create policy "Users manage own service request values" on public.service_request_values
for all to authenticated
using (exists(select 1 from public.service_requests sr where sr.id=service_request_id and sr.user_id=(select auth.uid())))
with check (exists(select 1 from public.service_requests sr where sr.id=service_request_id and sr.user_id=(select auth.uid())));

drop policy if exists "Users read own service quotes" on public.service_quotes;
create policy "Users read own service quotes" on public.service_quotes
for select to authenticated
using (exists(select 1 from public.service_requests sr where sr.id=service_request_id and sr.user_id=(select auth.uid())));

grant select on public.service_categories, public.service_catalog, public.service_goals,
 public.service_goal_map, public.service_country_map, public.service_sector_map,
 public.service_activity_map, public.service_capability_map, public.service_form_definitions,
 public.service_form_fields, public.service_requirements, public.service_deliverables,
 public.service_dependencies, public.service_packages, public.service_package_items to anon, authenticated;
grant select on public.service_pricing to authenticated;
grant select, insert, update on public.service_requests to authenticated;
grant select, insert, update, delete on public.service_request_values to authenticated;
grant select on public.service_quotes to authenticated;

insert into public.service_categories(code,name_ar,name_en,sort_order) values
('financial_advisory','الاستشارات المالية','Financial Advisory',10),
('studies_valuation','الدراسات والتقييم','Studies & Valuation',20),
('funding_restructuring','التمويل وإعادة الهيكلة','Funding & Restructuring',30),
('business_market','الأعمال والسوق','Business & Market',40)
on conflict(code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,sort_order=excluded.sort_order,is_active=true;

insert into public.service_goals(code,name_ar,name_en,sort_order) values
('funding','أريد تمويلاً','I need funding',10),
('expansion','أريد التوسع','I want to expand',20),
('valuation','أريد تقييم مشروعي أو أصولي','I need a valuation',30),
('profitability','أريد تحسين الربحية','I want to improve profitability',40),
('new_market','أريد دخول سوق جديد','I want to enter a new market',50),
('restructuring','أريد إعادة الهيكلة','I need restructuring',60),
('feasibility','أريد دراسة جدوى','I need a feasibility study',70)
on conflict(code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,sort_order=excluded.sort_order,is_active=true;

insert into public.service_catalog(code,category_code,name_ar,name_en,short_description_ar,delivery_type,status,is_active,sort_order,default_route_ar,default_route_en) values
('financial_analysis','financial_advisory','التحليل المالي','Financial Analysis','تحليل القوائم والمؤشرات والربحية والسيولة.','hybrid','published',true,10,'/services#analysis','/en/services#analysis'),
('cashflow_management','financial_advisory','إدارة التدفقات النقدية','Cash Flow Management','تخطيط التدفقات وتحسين التحصيل والدفع.','hybrid','published',true,20,'/services#cashflow','/en/services#cashflow'),
('budgeting_forecasting','financial_advisory','الموازنات والتقديرات','Budgeting & Forecasting','إعداد الموازنات والتوقعات ومقارنة الفعلي بالمخطط.','advisory','published',true,30,'/services#budgets','/en/services#budgets'),
('financial_strategy','financial_advisory','الاستراتيجية المالية','Financial Strategy','مؤشرات أداء وأولويات استثمار وخطة مالية قابلة للتنفيذ.','advisory','published',true,40,'/services#strategy','/en/services#strategy'),
('feasibility_studies','studies_valuation','دراسات الجدوى','Feasibility Studies','دراسة متكاملة للسوق والتشغيل والاستثمار والتمويل والمخاطر.','hybrid','published',true,50,'/services#feasibility','/en/services#feasibility'),
('asset_company_valuation','studies_valuation','تقييم الأصول والشركات','Asset & Company Valuation','تقييم مؤتمت ومدعوم بالمخاطر والسوق وتقارير وشهادات بوندز.','hybrid','published',true,60,'/valuation/','/en/valuation/'),
('risk_analysis','studies_valuation','تحليل المخاطر','Risk Analysis','تقييم المخاطر المالية والتشغيلية والسوقية وخطط المعالجة.','hybrid','published',true,70,'/services#risk','/en/services#risk'),
('funding_extraction','funding_restructuring','استخراج وتمكين التمويل','Funding Extraction','تقييم الحالة واختيار المصدر وتجهيز الملف والمتابعة.','hybrid','published',true,80,'/funding-extraction','/en/funding-extraction'),
('funding_readiness','funding_restructuring','الجاهزية التمويلية','Funding Readiness','تقييم مؤتمت لمدى جاهزية المشروع أو المنشأة للحصول على التمويل.','automated','published',true,90,'/funding-readiness','/en/funding-readiness'),
('project_rescue','funding_restructuring','إحياء وإعادة هيكلة المشاريع','Project Rescue & Restructuring','تشخيص التعثر وخطة إحياء وإعادة هيكلة ومتابعة التنفيذ.','advisory','published',true,100,'/project-rescue','/en/project-rescue'),
('operational_consulting','business_market','الاستشارات التشغيلية','Operational Consulting','رفع كفاءة العمليات والأدوار والأداء التشغيلي.','advisory','published',true,110,'/services#operations','/en/services#operations'),
('market_research','business_market','البحوث والدراسات السوقية','Market Research','دراسات سوق واستبيانات وتحليل المنافسة والطلب.','hybrid','published',true,120,'/services#research','/en/services#research')
on conflict(code) do update set category_code=excluded.category_code,name_ar=excluded.name_ar,name_en=excluded.name_en,
 short_description_ar=excluded.short_description_ar,delivery_type=excluded.delivery_type,status='published',is_active=true,
 sort_order=excluded.sort_order,default_route_ar=excluded.default_route_ar,default_route_en=excluded.default_route_en,updated_at=now();

insert into public.service_goal_map(service_id,goal_code,priority)
select s.id,v.goal_code,v.priority from public.service_catalog s
join (values
('funding_extraction','funding',1),('funding_readiness','funding',2),
('feasibility_studies','feasibility',1),('feasibility_studies','funding',20),
('asset_company_valuation','valuation',1),('risk_analysis','valuation',20),
('project_rescue','restructuring',1),('financial_analysis','profitability',1),
('cashflow_management','profitability',2),('operational_consulting','profitability',3),
('market_research','new_market',1),('feasibility_studies','new_market',2),
('financial_strategy','expansion',1),('feasibility_studies','expansion',2)
) as v(service_code,goal_code,priority) on s.code=v.service_code
on conflict(service_id,goal_code) do update set priority=excluded.priority;

insert into public.service_capability_map(service_id,capability_code,engine_route,run_order,is_required)
select s.id,v.capability,v.route,v.run_order,v.required
from public.service_catalog s
join (values
('funding_extraction','funding_engine','/api/funding',10,true),
('funding_extraction','funding_readiness','/api/funding-readiness',20,false),
('funding_readiness','funding_readiness','/api/funding-readiness',10,true),
('asset_company_valuation','valuation_engine','/api/v3/valuation/analyze',10,true),
('asset_company_valuation','risk_assessment','risk_assessments',20,false),
('asset_company_valuation','valuation_ai_report','valuation_ai_reports',30,false),
('asset_company_valuation','valuation_certificate','valuation_certificates',40,false),
('feasibility_studies','ucp','/api/v3/ucp',10,false),
('feasibility_studies','market_intelligence','/api/v3/investment-intelligence',20,false),
('feasibility_studies','scenario_engine','/api/v3/scenarios',30,false),
('risk_analysis','risk_assessment','risk_assessments',10,true),
('market_research','market_intelligence','/api/v3/investment-intelligence',10,true),
('project_rescue','risk_assessment','risk_assessments',10,false),
('project_rescue','enterprise_lifecycle','/api/v3/enterprise-lifecycle',20,false),
('financial_analysis','ucp','/api/v3/ucp',10,false)
) as v(service_code,capability,route,run_order,required) on s.code=v.service_code
on conflict(service_id,capability_code) do update set engine_route=excluded.engine_route,run_order=excluded.run_order,is_required=excluded.is_required;

insert into public.service_dependencies(service_id,depends_on_service_id,dependency_type)
select s.id,d.id,v.kind
from (values
('funding_extraction','funding_readiness','recommended'),
('funding_extraction','financial_analysis','recommended'),
('project_rescue','financial_analysis','recommended')
) v(service_code,depends_code,kind)
join public.service_catalog s on s.code=v.service_code
join public.service_catalog d on d.code=v.depends_code
on conflict do nothing;

insert into public.service_packages(code,name_ar,name_en,description_ar,status,is_active,sort_order) values
('funding_package','حزمة الجاهزية والتمويل','Funding Readiness & Extraction','الجاهزية التمويلية والتحليل وتجهيز ملف التمويل والمتابعة.','published',true,10),
('startup_package','حزمة تأسيس المشروع','Project Launch Package','دراسة الجدوى والسوق والمخاطر والاستراتيجية المالية.','published',true,20),
('expansion_package','حزمة التوسع','Expansion Package','الاستراتيجية والجدوى والسوق والتحليل المالي للتوسع.','published',true,30),
('restructuring_package','حزمة إعادة الهيكلة','Restructuring Package','تشخيص مالي ومخاطر وإحياء وإعادة هيكلة.','published',true,40)
on conflict(code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description_ar=excluded.description_ar,status='published',is_active=true,sort_order=excluded.sort_order;

insert into public.service_package_items(package_id,service_id,sort_order,is_required)
select p.id,s.id,v.sort_order,v.required
from (values
('funding_package','funding_readiness',10,true),
('funding_package','financial_analysis',20,false),
('funding_package','funding_extraction',30,true),
('startup_package','feasibility_studies',10,true),
('startup_package','market_research',20,false),
('startup_package','risk_analysis',30,false),
('startup_package','financial_strategy',40,false),
('expansion_package','financial_strategy',10,true),
('expansion_package','feasibility_studies',20,false),
('expansion_package','market_research',30,false),
('expansion_package','financial_analysis',40,false),
('restructuring_package','financial_analysis',10,true),
('restructuring_package','risk_analysis',20,false),
('restructuring_package','project_rescue',30,true)
) v(package_code,service_code,sort_order,required)
join public.service_packages p on p.code=v.package_code
join public.service_catalog s on s.code=v.service_code
on conflict(package_id,service_id) do update set sort_order=excluded.sort_order,is_required=excluded.is_required;

commit;
