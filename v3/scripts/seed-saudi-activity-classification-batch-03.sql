-- Saudi activity classification batch 03.
-- Source: GASTAT National Classification of Economic Activities (ISIC Rev.4).
-- Statistical classification provenance only.

with mappings(code, classification_code, classification_label, source_page) as (
  values
    ('universities', '85303', 'Universities', 253),
    ('gym', '93122', 'Sports halls and centers', 266)
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
