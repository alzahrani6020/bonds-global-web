
begin;

create table if not exists public.canonical_investment_sectors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canonical_investment_subsectors (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.canonical_investment_sectors(id) on delete cascade,
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sector_id, name_ar)
);

create table if not exists public.investment_project_sizes (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.investment_business_forms (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.investment_opportunity_types (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.canonical_activity_investment_sectors (
  canonical_activity_id uuid not null references public.canonical_activities(id) on delete cascade,
  sector_id uuid not null references public.canonical_investment_sectors(id) on delete cascade,
  is_primary boolean not null default false,
  source text not null default 'Bonds V3 canonical taxonomy',
  confidence integer check (confidence between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (canonical_activity_id, sector_id)
);

create unique index if not exists canonical_activity_one_primary_sector
on public.canonical_activity_investment_sectors(canonical_activity_id)
where is_primary;

create table if not exists public.legacy_sector_investment_map (
  economic_sector_id uuid not null references public.economic_sectors(id) on delete cascade,
  investment_sector_id uuid not null references public.canonical_investment_sectors(id) on delete cascade,
  is_primary boolean not null default true,
  confidence integer check (confidence between 0 and 100),
  mapping_method text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (economic_sector_id, investment_sector_id)
);

alter table public.canonical_investment_sectors enable row level security;
alter table public.canonical_investment_subsectors enable row level security;
alter table public.investment_project_sizes enable row level security;
alter table public.investment_business_forms enable row level security;
alter table public.investment_opportunity_types enable row level security;
alter table public.canonical_activity_investment_sectors enable row level security;
alter table public.legacy_sector_investment_map enable row level security;

drop policy if exists "Public read canonical investment sectors" on public.canonical_investment_sectors;
create policy "Public read canonical investment sectors"
on public.canonical_investment_sectors for select to public using (is_active = true);

drop policy if exists "Public read canonical investment subsectors" on public.canonical_investment_subsectors;
create policy "Public read canonical investment subsectors"
on public.canonical_investment_subsectors for select to public using (is_active = true);

drop policy if exists "Public read investment project sizes" on public.investment_project_sizes;
create policy "Public read investment project sizes"
on public.investment_project_sizes for select to public using (true);

drop policy if exists "Public read investment business forms" on public.investment_business_forms;
create policy "Public read investment business forms"
on public.investment_business_forms for select to public using (true);

drop policy if exists "Public read investment opportunity types" on public.investment_opportunity_types;
create policy "Public read investment opportunity types"
on public.investment_opportunity_types for select to public using (true);

drop policy if exists "Public read canonical activity investment sectors" on public.canonical_activity_investment_sectors;
create policy "Public read canonical activity investment sectors"
on public.canonical_activity_investment_sectors for select to public using (true);

drop policy if exists "Public read legacy sector investment map" on public.legacy_sector_investment_map;
create policy "Public read legacy sector investment map"
on public.legacy_sector_investment_map for select to public using (true);

insert into public.canonical_investment_sectors(code,name_ar,name_en,sort_order)
values
('health','الصحة','Health',1),
('education','التعليم','Education',2),
('industry','الصناعة','Industry',3),
('food_manufacturing','الغذاء والتصنيع الغذائي','Food & Food Manufacturing',4),
('pharma_biotech','الأدوية والتقنيات الحيوية','Pharmaceuticals & Biotechnology',5),
('agriculture','الزراعة','Agriculture',6),
('livestock','الثروة الحيوانية','Livestock',7),
('fisheries_blue_economy','الثروة السمكية والاقتصاد الأزرق','Fisheries & Blue Economy',8),
('conventional_energy','الطاقة التقليدية','Conventional Energy',9),
('renewable_energy','الطاقة المتجددة','Renewable Energy',10),
('mining','التعدين','Mining',11),
('real_estate','العقار','Real Estate',12),
('construction','التشييد والبناء','Construction',13),
('land_transport','النقل البري','Land Transport',14),
('maritime_transport','النقل البحري','Maritime Transport',15),
('aviation','الطيران','Aviation',16),
('logistics','الخدمات اللوجستية','Logistics',17),
('water','المياه','Water',18),
('environment','البيئة','Environment',19),
('waste_circular','النفايات والاقتصاد الدائري','Waste & Circular Economy',20),
('telecommunications','الاتصالات','Telecommunications',21),
('technology','التقنية','Technology',22),
('cybersecurity','الأمن السيبراني','Cybersecurity',23),
('data_centers_digital_infra','مراكز البيانات والبنية الرقمية','Data Centers & Digital Infrastructure',24),
('banking_finance','البنوك والتمويل','Banking & Finance',25),
('insurance','التأمين','Insurance',26),
('capital_markets','أسواق المال','Capital Markets',27),
('asset_management_alternatives','إدارة الأصول والاستثمار البديل','Asset Management & Alternative Investments',28),
('tourism','السياحة','Tourism',29),
('hospitality','الضيافة','Hospitality',30),
('entertainment_sports','الترفيه والرياضة','Entertainment & Sports',31),
('trade','التجارة','Trade',32),
('ecommerce','التجارة الإلكترونية','E-Commerce',33),
('media_content','الإعلام والمحتوى','Media & Content',34),
('creative_economy','الاقتصاد الإبداعي','Creative Economy',35),
('professional_services','الخدمات المهنية','Professional Services',36),
('social_care','الخدمات الاجتماعية والرعاية','Social Care & Services',37),
('space_advanced_industries','الفضاء والصناعات المتقدمة','Space & Advanced Industries',38),
('economic_zones','المناطق الاقتصادية والمناطق الحرة','Economic & Free Zones',39),
('defense_security','الدفاع والأمن','Defense & Security',40)
on conflict (code) do update
set name_ar=excluded.name_ar,name_en=excluded.name_en,sort_order=excluded.sort_order,is_active=true,updated_at=now();

insert into public.investment_project_sizes(code,name_ar,name_en,sort_order)
values
('household','منزلي','Household',1),
('micro','متناهي الصغر','Micro',2),
('small','صغير','Small',3),
('medium','متوسط','Medium',4),
('large','كبير','Large',5),
('mega','ضخم / استراتيجي','Mega / Strategic',6)
on conflict (code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,sort_order=excluded.sort_order;

insert into public.investment_business_forms(code,name_ar,name_en,sort_order)
values
('productive_family','أسرة منتجة','Productive Family',1),
('freelancer','عمل حر','Freelancer',2),
('sole_proprietorship','مؤسسة فردية','Sole Proprietorship',3),
('micro_establishment','منشأة متناهية الصغر','Micro Establishment',4),
('company','شركة','Company',5),
('partnership','شراكة','Partnership',6),
('cooperative','تعاونية','Cooperative',7),
('nonprofit','غير ربحي','Nonprofit',8),
('franchise','امتياز تجاري','Franchise',9),
('startup','شركة ناشئة','Startup',10),
('spv','شركة غرض خاص','SPV',11),
('fund','صندوق استثماري','Investment Fund',12)
on conflict (code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,sort_order=excluded.sort_order;

insert into public.investment_opportunity_types(code,name_ar,name_en,sort_order)
values
('operational','تشغيلية','Operational',1),
('expansion','توسعية','Expansion',2),
('manufacturing','تصنيع','Manufacturing',3),
('infrastructure','بنية تحتية','Infrastructure',4),
('concession','امتياز','Concession',5),
('technology','تقنية','Technology',6),
('export','تصدير','Export',7),
('import_substitution','إحلال واردات','Import Substitution',8),
('franchise','امتياز تجاري','Franchise',9),
('acquisition','استحواذ','Acquisition',10),
('turnaround','إعادة هيكلة','Turnaround',11),
('greenfield','مشروع جديد','Greenfield',12),
('brownfield','تطوير أصل قائم','Brownfield',13),
('ppp','شراكة بين القطاعين العام والخاص','PPP',14),
('privatization','تخصيص','Privatization',15),
('real_estate_development','تطوير عقاري','Real Estate Development',16),
('financial_investment','استثمار مالي','Financial Investment',17),
('strategic','استراتيجي','Strategic',18)
on conflict (code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,sort_order=excluded.sort_order;

commit;
