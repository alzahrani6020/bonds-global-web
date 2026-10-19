-- Saudi activity classification batch 01.
-- Source: GASTAT National Classification of Economic Activities (ISIC Rev.4).
-- This updates statistical classification provenance only.
-- It deliberately does NOT assert licensing availability or regulatory verification.

with mappings(code, classification_code, classification_label, source_page) as (
  values
    ('restaurant', '5610', 'Restaurants and mobile food service activities', 200),
    ('restaurants', '5610', 'Restaurants and mobile food service activities', 200),
    ('pharmacy', '477211', 'Pharmacies activities', 183),
    ('kindergarten', '851010', 'Preschool education - kindergarten with national curriculum', 248),
    ('real_estate_brokerage', '682010', 'Activities of real estate agents and brokers', 218)
)
update public.canonical_activity_country cac
set
  classification_system = 'Saudi National Classification of Economic Activities (ISIC Rev.4)',
  classification_code = m.classification_code,
  classification_label = m.classification_label,
  source = 'GASTAT National Classification of Economic Activities (ISIC Rev.4)',
  source_url = 'https://www.stats.gov.sa/sites/default/files/the_national_classification_of_economic_activities_aug-2019_isic4.pdf',
  confidence = 100,
  metadata = coalesce(cac.metadata, '{}'::jsonb) || jsonb_build_object(
    'classification_evidence', 'direct_name_match',
    'classification_scope', 'statistical_only',
    'source_page', m.source_page,
    'does_not_assert_license_availability', true
  ),
  updated_at = now()
from public.canonical_activities ca
join mappings m on m.code = ca.code
where cac.canonical_activity_id = ca.id
  and cac.country_code = 'SA';
