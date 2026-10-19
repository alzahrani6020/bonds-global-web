
begin;

insert into public.canonical_investment_subsectors(sector_id,code,name_ar,name_en,sort_order)
select s.id,v.code,v.name_ar,v.name_en,v.sort_order
from (
  values
    ('health','pharmacy_services','خدمات الصيدلة','Pharmacy Services',4),
    ('insurance','insurance_services','خدمات التأمين','Insurance Services',4)
) v(sector_code,code,name_ar,name_en,sort_order)
join public.canonical_investment_sectors s on s.code=v.sector_code
on conflict (code) do update
set sector_id=excluded.sector_id,name_ar=excluded.name_ar,name_en=excluded.name_en,sort_order=excluded.sort_order,is_active=true,updated_at=now();

with mappings(activity_code,subsector_code,confidence) as (
values
('assembly','general_manufacturing',95),
('bakery','bakery_catering',100),
('banking_services','banking',100),
('beauty','arts_creative_services',80),
('boutique_hotel','hotels_resorts',100),
('burger_restaurant','restaurants_cafes',100),
('cafe','restaurants_cafes',100),
('cafes','restaurants_cafes',100),
('catering','bakery_catering',95),
('cleaning_services','business_support',90),
('clothing_store','retail',100),
('coffee_shop','restaurants_cafes',100),
('cold_storage_warehouse','warehousing',100),
('commercial','commercial',90),
('consulting','consulting',100),
('crowdfunding_platform','fintech_payments',90),
('dental_clinic','clinics',100),
('dental_clinics','clinics',100),
('dermatology_clinics','clinics',100),
('digital_transformation','it_services',95),
('distribution','supply_chain',100),
('e_commerce','marketplaces',100),
('e_learning','training_edtech',95),
('energy_efficiency','storage_efficiency',100),
('events','events',100),
('facilities_management','business_support',90),
('factories','general_manufacturing',100),
('farming','crop_farming',100),
('fast_food','restaurants_cafes',100),
('fintech','fintech_payments',100),
('food_truck','restaurants_cafes',100),
('government_consulting','consulting',100),
('gym','sports',100),
('hajj_umrah_agency','religious_tourism',100),
('hardware','advanced_electronics',85),
('import_export','import_export',100),
('industrial','general_manufacturing',90),
('insurance','insurance_services',100),
('investment','asset_management',90),
('it_services','it_services',100),
('kindergarten','schools',95),
('last_mile_delivery_26ea5b16','last_mile',100),
('last_mile_delivery_ac58d00b','last_mile',100),
('livestock','feed_meat',80),
('maintenance','business_support',85),
('media','digital_content',95),
('medical_lab','diagnostics',100),
('mobile_shop','retail',100),
('oil_gas','oil_gas',100),
('ophthalmology_clinics','clinics',100),
('packaging','packaging_processing',100),
('packaging_factory','packaging_processing',100),
('payment_gateway','fintech_payments',100),
('pediatric_clinics','clinics',100),
('pharmacy','pharmacy_services',100),
('plastic_products_factory','general_manufacturing',95),
('processing','packaging_processing',80),
('real_estate_brokerage','brokerage_funds',100),
('renewable_energy','solar_wind',85),
('residential','residential',100),
('residential_contracting','contracting',100),
('restaurant','restaurants_cafes',100),
('restaurants','restaurants_cafes',100),
('retail_31301cbc','retail',100),
('retail_de6eadad','retail',100),
('schools','schools',100),
('security_services','facility_security',95),
('shipping','shipping',100),
('small_supermarket','retail',100),
('software','software',100),
('sports','sports',100),
('telecommunications','telecom_services',100),
('tourism','destinations',90),
('training_center','training_edtech',100),
('training_centers','training_edtech',100),
('transport','freight_transport',75),
('universities','higher_education',100),
('utilities','water_networks',70),
('vegetable_greenhouse','greenhouses',100),
('warehousing','warehousing',100),
('water_bottling_plant','beverages',95),
('wholesale','wholesale',100),
('workshops','general_manufacturing',85)
)
insert into public.canonical_activity_investment_subsectors(
  canonical_activity_id,subsector_id,is_primary,source,confidence,metadata
)
select ca.id,ss.id,true,'Bonds V3 canonical investment taxonomy',m.confidence,
       jsonb_build_object('mapping_scope','taxonomy_only','activity_code',m.activity_code)
from mappings m
join public.canonical_activities ca on ca.code=m.activity_code
join public.canonical_investment_subsectors ss on ss.code=m.subsector_code
on conflict (canonical_activity_id,subsector_id) do update
set is_primary=excluded.is_primary,source=excluded.source,confidence=excluded.confidence,metadata=excluded.metadata;

with mappings(legacy_code,sector_code,confidence,is_primary) as (
values
('advertising','media_content',95,true),
('agricultural_inputs','agriculture',95,true),
('agriculture','agriculture',100,true),
('artificial_intelligence','technology',100,true),
('automotive','industry',95,true),
('aviation','aviation',100,true),
('awqaf','asset_management_alternatives',75,true),
('beauty','creative_economy',80,true),
('chemical_industries','industry',100,true),
('cold_warehouses','logistics',100,true),
('commerce','trade',100,true),
('commercial_brokerage','trade',95,true),
('construction','construction',100,true),
('consulting','professional_services',100,true),
('contracting','construction',100,true),
('creative_economy','creative_economy',100,true),
('culture','creative_economy',95,true),
('cybersecurity','cybersecurity',100,true),
('desertification_control','environment',100,true),
('dry_warehouses','logistics',100,true),
('ecommerce','ecommerce',100,true),
('education','education',100,true),
('energy','conventional_energy',70,true),
('energy','renewable_energy',70,false),
('entertainment','entertainment_sports',100,true),
('environment_sustainability','environment',100,true),
('facilities_management','professional_services',90,true),
('financial_banking','banking_finance',100,true),
('fintech','banking_finance',100,true),
('fisheries','fisheries_blue_economy',100,true),
('food_beverage','food_manufacturing',100,true),
('food_industries','food_manufacturing',100,true),
('food_services','hospitality',100,true),
('furniture','industry',95,true),
('geology','mining',90,true),
('hajj_umrah','tourism',100,true),
('healthcare','health',100,true),
('heavy_equipment','industry',95,true),
('hospitality','hospitality',100,true),
('human_resources','professional_services',95,true),
('industrial','industry',100,true),
('industrial_cities','economic_zones',95,true),
('insurance','insurance',100,true),
('insurance_agent','insurance',100,true),
('insurance_broker','insurance',100,true),
('laboratories','health',95,true),
('light_manufacturing','industry',100,true),
('livestock','livestock',100,true),
('logistics','logistics',100,true),
('logistics_services','logistics',100,true),
('media','media_content',100,true),
('metal_refineries','mining',95,true),
('mining','mining',100,true),
('oil_gas','conventional_energy',100,true),
('oil_refineries','conventional_energy',100,true),
('pharmaceutical_industries','pharma_biotech',100,true),
('ports','maritime_transport',100,true),
('poultry','livestock',100,true),
('private_aviation','aviation',100,true),
('public_services','professional_services',65,true),
('real_estate','real_estate',100,true),
('research_development','technology',85,true),
('retail_trade','trade',100,true),
('security_safety','defense_security',90,true),
('sports_economy','entertainment_sports',100,true),
('technology','technology',100,true),
('tourism','tourism',100,true),
('transport','land_transport',75,true),
('water','water',100,true),
('well_drilling','water',80,true)
)
insert into public.legacy_sector_investment_map(
  economic_sector_id,investment_sector_id,is_primary,confidence,mapping_method,metadata
)
select es.id,cis.id,m.is_primary,m.confidence,'manual',
       jsonb_build_object('legacy_code',m.legacy_code,'scope','taxonomy_mapping')
from mappings m
join public.economic_sectors es on es.code=m.legacy_code
join public.canonical_investment_sectors cis on cis.code=m.sector_code
on conflict (economic_sector_id,investment_sector_id) do update
set is_primary=excluded.is_primary,confidence=excluded.confidence,mapping_method=excluded.mapping_method,metadata=excluded.metadata;

commit;
