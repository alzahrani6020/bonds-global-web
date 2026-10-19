-- Saudi activity classification batch 04.
-- Source: GASTAT National Classification of Economic Activities (ISIC Rev.4).
-- Statistical classification provenance only; licensing and regulatory status remain unknown.

with mappings(code, classification_code, classification_label, source_page, evidence) as (
  values
    ('security_services', '8010', 'Private security activities', 241, 'direct_category_match'),
    ('hajj_umrah_agency', '79121', 'Arranging and assembling religious tours such as Hajj and Umrah', 239, 'direct_activity_match'),
    ('telecommunications', '61', 'Telecommunications', 209, 'direct_division_match'),
    ('cleaning_services', '812', 'Cleaning activities', 242, 'direct_group_match'),
    ('warehousing', '5210', 'Storage', 195, 'direct_class_match'),
    ('boutique_hotel', '551011', 'Hotels', 200, 'direct_parent_activity_match')
)
update public.canonical_activity_country cac
set
  classification_system = 'Saudi National Classification of Economic Activities (ISIC Rev.4)',
  classification_code = m.classification_code,
  classification_label = m.classification_label,
  source = 'GASTAT National Classification of Economic Activities (ISIC Rev.4)',
  source_url = 'https://www.stats.gov.sa/sites/default/files/the_national_classification_of_economic_activities_aug-2019_isic4.pdf',
  confidence = case when m.evidence='direct_activity_match' then 100 else 95 end,
  metadata = coalesce(cac.metadata, '{}'::jsonb) || jsonb_build_object(
    'classification_evidence', m.evidence,
    'classification_scope', 'statistical_only',
    'source_page', m.source_page,
    'does_not_assert_license_availability', true
  ),
  updated_at = now()
from public.canonical_activities ca
join mappings m on m.code = ca.code
where cac.canonical_activity_id = ca.id
  and cac.country_code = 'SA';
