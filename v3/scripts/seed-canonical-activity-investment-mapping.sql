
begin;

with mappings(activity_code,sector_code,confidence) as (
  values
    ('assembly','industry',95),
    ('bakery','food_manufacturing',100),
    ('banking_services','banking_finance',100),
    ('beauty','creative_economy',80),
    ('boutique_hotel','hospitality',100),
    ('burger_restaurant','hospitality',100),
    ('cafe','hospitality',100),
    ('cafes','hospitality',100),
    ('catering','food_manufacturing',95),
    ('cleaning_services','professional_services',90),
    ('clothing_store','trade',100),
    ('coffee_shop','hospitality',100),
    ('cold_storage_warehouse','logistics',100),
    ('commercial','real_estate',90),
    ('consulting','professional_services',100),
    ('crowdfunding_platform','banking_finance',90),
    ('dental_clinic','health',100),
    ('dental_clinics','health',100),
    ('dermatology_clinics','health',100),
    ('digital_transformation','technology',100),
    ('distribution','logistics',100),
    ('e_commerce','ecommerce',100),
    ('e_learning','education',95),
    ('energy_efficiency','renewable_energy',90),
    ('events','entertainment_sports',95),
    ('facilities_management','professional_services',90),
    ('factories','industry',100),
    ('farming','agriculture',100),
    ('fast_food','hospitality',100),
    ('fintech','banking_finance',100),
    ('food_truck','hospitality',100),
    ('government_consulting','professional_services',100),
    ('gym','entertainment_sports',100),
    ('hajj_umrah_agency','tourism',100),
    ('hardware','technology',90),
    ('import_export','trade',100),
    ('industrial','industry',90),
    ('insurance','insurance',100),
    ('investment','asset_management_alternatives',90),
    ('it_services','technology',100),
    ('kindergarten','education',100),
    ('last_mile_delivery_26ea5b16','logistics',100),
    ('last_mile_delivery_ac58d00b','logistics',100),
    ('livestock','livestock',100),
    ('maintenance','professional_services',85),
    ('media','media_content',100),
    ('medical_lab','health',100),
    ('mobile_shop','trade',100),
    ('oil_gas','conventional_energy',100),
    ('ophthalmology_clinics','health',100),
    ('packaging','industry',95),
    ('packaging_factory','industry',100),
    ('payment_gateway','banking_finance',100),
    ('pediatric_clinics','health',100),
    ('pharmacy','health',100),
    ('plastic_products_factory','industry',100),
    ('processing','industry',85),
    ('real_estate_brokerage','real_estate',100),
    ('renewable_energy','renewable_energy',100),
    ('residential','real_estate',100),
    ('residential_contracting','construction',100),
    ('restaurant','hospitality',100),
    ('restaurants','hospitality',100),
    ('retail_31301cbc','trade',100),
    ('retail_de6eadad','trade',100),
    ('schools','education',100),
    ('security_services','defense_security',95),
    ('shipping','maritime_transport',95),
    ('small_supermarket','trade',100),
    ('software','technology',100),
    ('sports','entertainment_sports',100),
    ('telecommunications','telecommunications',100),
    ('tourism','tourism',100),
    ('training_center','education',100),
    ('training_centers','education',100),
    ('transport','land_transport',90),
    ('universities','education',100),
    ('utilities','water',75),
    ('vegetable_greenhouse','agriculture',100),
    ('warehousing','logistics',100),
    ('water_bottling_plant','food_manufacturing',95),
    ('wholesale','trade',100),
    ('workshops','industry',85)
)
insert into public.canonical_activity_investment_sectors(
  canonical_activity_id,sector_id,is_primary,source,confidence,metadata
)
select
  ca.id,
  cis.id,
  true,
  'Bonds V3 canonical investment taxonomy',
  m.confidence,
  jsonb_build_object('mapping_scope','taxonomy_only','activity_code',m.activity_code)
from mappings m
join public.canonical_activities ca on ca.code=m.activity_code
join public.canonical_investment_sectors cis on cis.code=m.sector_code
on conflict (canonical_activity_id,sector_id) do update
set is_primary=excluded.is_primary,
    source=excluded.source,
    confidence=excluded.confidence,
    metadata=excluded.metadata;

with productive_family_candidates(activity_code) as (
  values
    ('bakery'),
    ('beauty'),
    ('catering'),
    ('clothing_store'),
    ('e_commerce'),
    ('farming'),
    ('food_truck'),
    ('media'),
    ('packaging'),
    ('retail_31301cbc'),
    ('retail_de6eadad'),
    ('software'),
    ('vegetable_greenhouse')
)
insert into public.canonical_activity_business_forms(
  canonical_activity_id,business_form_code,country_code,
  verification_status,source,confidence,metadata
)
select
  ca.id,
  'productive_family',
  'SA',
  'unverified',
  'Bonds V3 Saudi taxonomy candidate',
  70,
  jsonb_build_object(
    'scope','saudi_candidate',
    'requires_country_regulatory_verification',true
  )
from productive_family_candidates p
join public.canonical_activities ca on ca.code=p.activity_code
on conflict (canonical_activity_id,business_form_code,country_code) do update
set verification_status=excluded.verification_status,
    source=excluded.source,
    confidence=excluded.confidence,
    metadata=excluded.metadata;

commit;
