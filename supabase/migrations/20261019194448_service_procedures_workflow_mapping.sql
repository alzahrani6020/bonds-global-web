
begin;

create table if not exists public.service_procedures (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  country_code text references public.country_profiles(country_code) on delete cascade,
  sector_code text references public.canonical_investment_sectors(code) on delete cascade,
  canonical_activity_id uuid references public.canonical_activities(id) on delete cascade,
  title_ar text not null,
  title_en text,
  description_ar text,
  description_en text,
  procedure_type text not null default 'manual'
    check (procedure_type in ('manual','automated','approval','document','workflow')),
  visibility text not null default 'public'
    check (visibility in ('public','client','internal')),
  capability_code text,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_procedures_lookup
on public.service_procedures(service_id,country_code,sector_code,sort_order);

create table if not exists public.service_workflow_map (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  country_code text references public.country_profiles(country_code) on delete cascade,
  sector_code text references public.canonical_investment_sectors(code) on delete cascade,
  is_primary boolean not null default false,
  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists service_workflow_map_unique
on public.service_workflow_map(service_id,workflow_definition_id,coalesce(country_code,''),coalesce(sector_code,''));

alter table public.service_procedures enable row level security;
alter table public.service_workflow_map enable row level security;

drop policy if exists "Public read public service procedures" on public.service_procedures;
create policy "Public read public service procedures"
on public.service_procedures for select to anon,authenticated
using (visibility='public');

grant select on public.service_procedures to anon,authenticated;
revoke all on public.service_workflow_map from anon,authenticated;

insert into public.service_procedures(service_id,title_ar,title_en,procedure_type,sort_order)
select s.id,v.title_ar,v.title_en,v.kind,v.ord
from public.service_catalog s
join (values
('funding_extraction','تقييم الحالة المالية','Financial assessment','automated',10),
('funding_extraction','اختيار مصدر التمويل المناسب','Select the suitable funding source','manual',20),
('funding_extraction','إعداد الملف والمتابعة','Prepare and follow up the funding file','workflow',30),
('project_rescue','التشخيص السريع','Rapid diagnosis','manual',10),
('project_rescue','تحديد نقاط الألم','Identify critical pain points','manual',20),
('project_rescue','إعداد خطة إحياء واقعية','Build an actionable rescue plan','manual',30),
('project_rescue','إعادة الهيكلة','Restructuring','workflow',40),
('project_rescue','المتابعة والتعافي','Follow-up and recovery','workflow',50),
('asset_company_valuation','تصنيف الأصل وتحديد منهجية التقييم','Classify the asset and valuation methodology','automated',10),
('asset_company_valuation','تنفيذ التقييم وتحليل المخاطر والسوق','Run valuation with risk and market analysis','automated',20),
('asset_company_valuation','إعداد التقرير التنفيذي','Generate the executive report','automated',30),
('asset_company_valuation','إصدار شهادة التقييم عند الاعتماد','Issue valuation certificate after approval','approval',40)
) v(service_code,title_ar,title_en,kind,ord)
on s.code=v.service_code
where not exists (
  select 1 from public.service_procedures p
  where p.service_id=s.id and p.title_ar=v.title_ar
);

commit;
