
begin;

create table if not exists public.canonical_activity_investment_subsectors (
  canonical_activity_id uuid not null references public.canonical_activities(id) on delete cascade,
  subsector_id uuid not null references public.canonical_investment_subsectors(id) on delete cascade,
  is_primary boolean not null default false,
  source text not null default 'Bonds V3 canonical taxonomy',
  confidence integer check (confidence between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (canonical_activity_id,subsector_id)
);

create unique index if not exists canonical_activity_one_primary_subsector
on public.canonical_activity_investment_subsectors(canonical_activity_id)
where is_primary;

alter table public.canonical_activity_investment_subsectors enable row level security;
drop policy if exists "Public read canonical activity investment subsectors" on public.canonical_activity_investment_subsectors;
create policy "Public read canonical activity investment subsectors"
on public.canonical_activity_investment_subsectors for select to public using (true);

with s(sector_code,code,name_ar,name_en,sort_order) as (
values
('health','hospitals','المستشفيات','Hospitals',1),
('health','clinics','العيادات','Clinics',2),
('health','diagnostics','المختبرات والتشخيص','Diagnostics & Laboratories',3),
('education','schools','المدارس','Schools',1),
('education','higher_education','التعليم العالي','Higher Education',2),
('education','training_edtech','التدريب والتعليم الرقمي','Training & EdTech',3),
('industry','general_manufacturing','الصناعات التحويلية','General Manufacturing',1),
('industry','materials_equipment','المواد والمعدات','Materials & Equipment',2),
('industry','packaging_processing','التعبئة والمعالجة','Packaging & Processing',3),
('food_manufacturing','food_processing','تصنيع الأغذية','Food Processing',1),
('food_manufacturing','bakery_catering','المخابز والتموين','Bakery & Catering',2),
('food_manufacturing','beverages','المشروبات','Beverages',3),
('pharma_biotech','pharmaceuticals','الأدوية','Pharmaceuticals',1),
('pharma_biotech','biotechnology','التقنيات الحيوية','Biotechnology',2),
('pharma_biotech','medical_products','المنتجات الطبية','Medical Products',3),
('agriculture','crop_farming','المحاصيل والزراعة','Crop Farming',1),
('agriculture','greenhouses','البيوت المحمية','Greenhouses',2),
('agriculture','agritech','التقنيات الزراعية','AgriTech',3),
('livestock','poultry','الدواجن','Poultry',1),
('livestock','dairy','الألبان','Dairy',2),
('livestock','feed_meat','الأعلاف واللحوم','Feed & Meat',3),
('fisheries_blue_economy','fishing','الصيد','Fishing',1),
('fisheries_blue_economy','aquaculture','الاستزراع السمكي','Aquaculture',2),
('fisheries_blue_economy','marine_processing','التجهيز والخدمات البحرية','Marine Processing & Services',3),
('conventional_energy','oil_gas','النفط والغاز','Oil & Gas',1),
('conventional_energy','refining','التكرير','Refining',2),
('conventional_energy','oilfield_services','الخدمات البترولية','Oilfield Services',3),
('renewable_energy','solar_wind','الطاقة الشمسية والرياح','Solar & Wind',1),
('renewable_energy','hydrogen','الهيدروجين','Hydrogen',2),
('renewable_energy','storage_efficiency','التخزين وكفاءة الطاقة','Storage & Energy Efficiency',3),
('mining','mineral_extraction','استخراج المعادن','Mineral Extraction',1),
('mining','mineral_processing','معالجة المعادن','Mineral Processing',2),
('mining','mining_services','خدمات التعدين','Mining Services',3),
('real_estate','residential','السكني','Residential',1),
('real_estate','commercial','التجاري والإداري','Commercial & Office',2),
('real_estate','brokerage_funds','الوساطة والاستثمار العقاري','Brokerage & Real Estate Investment',3),
('construction','contracting','المقاولات','Contracting',1),
('construction','engineering','الهندسة','Engineering',2),
('construction','building_materials','مواد البناء','Building Materials',3),
('land_transport','passenger_transport','نقل الركاب','Passenger Transport',1),
('land_transport','freight_transport','نقل البضائع','Freight Transport',2),
('land_transport','public_transport','النقل العام','Public Transport',3),
('maritime_transport','ports','الموانئ','Ports',1),
('maritime_transport','shipping','الشحن البحري','Shipping',2),
('maritime_transport','marine_services','الخدمات البحرية','Marine Services',3),
('aviation','airports','المطارات','Airports',1),
('aviation','air_cargo','الشحن الجوي','Air Cargo',2),
('aviation','ground_services','الخدمات الأرضية','Ground Services',3),
('logistics','warehousing','المستودعات','Warehousing',1),
('logistics','supply_chain','سلاسل الإمداد','Supply Chain',2),
('logistics','last_mile','التوصيل الأخير','Last Mile',3),
('water','desalination','التحلية','Desalination',1),
('water','water_networks','شبكات المياه','Water Networks',2),
('water','water_treatment','المعالجة وإعادة الاستخدام','Treatment & Reuse',3),
('environment','environmental_services','الخدمات البيئية','Environmental Services',1),
('environment','monitoring_compliance','الرصد والامتثال','Monitoring & Compliance',2),
('environment','remediation','المعالجة البيئية','Remediation',3),
('waste_circular','recycling','إعادة التدوير','Recycling',1),
('waste_circular','waste_management','إدارة النفايات','Waste Management',2),
('waste_circular','resource_recovery','استرداد الموارد','Resource Recovery',3),
('telecommunications','networks_fiber','الشبكات والألياف','Networks & Fiber',1),
('telecommunications','towers_satellite','الأبراج والأقمار الصناعية','Towers & Satellite',2),
('telecommunications','telecom_services','خدمات الاتصالات','Telecom Services',3),
('technology','software','البرمجيات','Software',1),
('technology','cloud_ai','السحابة والذكاء الاصطناعي','Cloud & AI',2),
('technology','it_services','خدمات تقنية المعلومات','IT Services',3),
('cybersecurity','security_services','الخدمات الأمنية الرقمية','Cybersecurity Services',1),
('cybersecurity','soc','مراكز العمليات الأمنية','Security Operations Centers',2),
('cybersecurity','security_products','منتجات الأمن السيبراني','Cybersecurity Products',3),
('data_centers_digital_infra','data_centers','مراكز البيانات','Data Centers',1),
('data_centers_digital_infra','cloud_infrastructure','البنية السحابية','Cloud Infrastructure',2),
('data_centers_digital_infra','digital_connectivity','الربط والبنية الرقمية','Digital Connectivity',3),
('banking_finance','banking','الخدمات المصرفية','Banking',1),
('banking_finance','financing_leasing','التمويل والتأجير','Financing & Leasing',2),
('banking_finance','fintech_payments','التقنية المالية والمدفوعات','FinTech & Payments',3),
('insurance','health_insurance','التأمين الصحي','Health Insurance',1),
('insurance','motor_property','المركبات والممتلكات','Motor & Property Insurance',2),
('insurance','life_specialty','الحياة والتأمينات المتخصصة','Life & Specialty Insurance',3),
('capital_markets','brokerage','الوساطة المالية','Brokerage',1),
('capital_markets','funds','الصناديق','Funds',2),
('capital_markets','securities_services','خدمات الأوراق المالية','Securities Services',3),
('asset_management_alternatives','asset_management','إدارة الأصول','Asset Management',1),
('asset_management_alternatives','private_equity_vc','الملكية الخاصة ورأس المال الجريء','Private Equity & Venture Capital',2),
('asset_management_alternatives','private_credit_alternatives','الائتمان الخاص والاستثمارات البديلة','Private Credit & Alternatives',3),
('tourism','destinations','الوجهات السياحية','Tourism Destinations',1),
('tourism','religious_tourism','السياحة الدينية','Religious Tourism',2),
('tourism','medical_cultural_tourism','السياحة العلاجية والثقافية','Medical & Cultural Tourism',3),
('hospitality','hotels_resorts','الفنادق والمنتجعات','Hotels & Resorts',1),
('hospitality','restaurants_cafes','المطاعم والمقاهي','Restaurants & Cafes',2),
('hospitality','hospitality_services','خدمات الضيافة','Hospitality Services',3),
('entertainment_sports','sports','الرياضة','Sports',1),
('entertainment_sports','events','الفعاليات','Events',2),
('entertainment_sports','entertainment_venues','مرافق الترفيه','Entertainment Venues',3),
('trade','retail','التجزئة','Retail',1),
('trade','wholesale','الجملة','Wholesale',2),
('trade','import_export','الاستيراد والتصدير','Import & Export',3),
('ecommerce','marketplaces','المنصات والأسواق الرقمية','Marketplaces',1),
('ecommerce','digital_retail','التجزئة الرقمية','Digital Retail',2),
('ecommerce','commerce_enablement','تمكين التجارة الإلكترونية','Commerce Enablement',3),
('media_content','production','الإنتاج الإعلامي','Media Production',1),
('media_content','publishing_broadcast','النشر والبث','Publishing & Broadcast',2),
('media_content','digital_content','المحتوى الرقمي','Digital Content',3),
('creative_economy','crafts_fashion','الحرف والأزياء','Crafts & Fashion',1),
('creative_economy','gaming_design','الألعاب والتصميم','Gaming & Design',2),
('creative_economy','arts_creative_services','الفنون والخدمات الإبداعية','Arts & Creative Services',3),
('professional_services','consulting','الاستشارات','Consulting',1),
('professional_services','legal_accounting','القانون والمحاسبة','Legal & Accounting',2),
('professional_services','business_support','خدمات الأعمال','Business Support',3),
('social_care','elderly_care','رعاية كبار السن','Elderly Care',1),
('social_care','child_family_care','رعاية الطفل والأسرة','Child & Family Care',2),
('social_care','rehabilitation_social','التأهيل والخدمات الاجتماعية','Rehabilitation & Social Services',3),
('space_advanced_industries','space','الفضاء','Space',1),
('space_advanced_industries','advanced_electronics','الإلكترونيات المتقدمة','Advanced Electronics',2),
('space_advanced_industries','advanced_materials_robotics','المواد المتقدمة والروبوتات','Advanced Materials & Robotics',3),
('economic_zones','free_zones','المناطق الحرة','Free Zones',1),
('economic_zones','special_economic_zones','المناطق الاقتصادية الخاصة','Special Economic Zones',2),
('economic_zones','industrial_business_parks','المجمعات الصناعية ومناطق الأعمال','Industrial & Business Parks',3),
('defense_security','defense_manufacturing','التصنيع الدفاعي','Defense Manufacturing',1),
('defense_security','security_systems','الأنظمة الأمنية','Security Systems',2),
('defense_security','facility_security','أمن المنشآت','Facility Security',3)
)
insert into public.canonical_investment_subsectors(sector_id,code,name_ar,name_en,sort_order)
select cis.id,s.code,s.name_ar,s.name_en,s.sort_order
from s
join public.canonical_investment_sectors cis on cis.code=s.sector_code
on conflict (code) do update
set sector_id=excluded.sector_id,
    name_ar=excluded.name_ar,
    name_en=excluded.name_en,
    sort_order=excluded.sort_order,
    is_active=true,
    updated_at=now();

grant select on public.canonical_investment_sectors to anon, authenticated;
grant select on public.canonical_investment_subsectors to anon, authenticated;
grant select on public.investment_project_sizes to anon, authenticated;
grant select on public.investment_business_forms to anon, authenticated;
grant select on public.investment_opportunity_types to anon, authenticated;
grant select on public.canonical_activity_investment_sectors to anon, authenticated;
grant select on public.canonical_activity_investment_subsectors to anon, authenticated;
grant select on public.canonical_activity_business_forms to anon, authenticated;
grant select on public.project_model_investment_dimensions to anon, authenticated;
grant select on public.project_model_opportunity_types to anon, authenticated;
grant select on public.legacy_sector_investment_map to anon, authenticated;

commit;
