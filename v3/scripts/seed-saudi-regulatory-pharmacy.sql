-- Saudi regulatory batch 02: pharmacy.
-- Official source: Saudi Ministry of Health.
-- Scope: retail pharmacy establishment licensing.
-- Conservative: records only the licensing requirement and published fee.

with activity as (
  select id
  from public.canonical_activities
  where code='pharmacy'
),
inserted as (
  insert into public.country_regulatory_requirements (
    country_code,
    canonical_activity_id,
    requirement_name_ar,
    requirement_name_en,
    issuing_authority,
    requirement_type,
    mandatory,
    estimated_cost,
    currency_code,
    verification_status,
    source,
    source_url,
    confidence,
    metadata
  )
  select
    'SA',
    activity.id,
    'ترخيص منشأة صيدلية',
    'Pharmacy Establishment License',
    'Saudi Ministry of Health',
    'license',
    true,
    1000::numeric,
    'SAR',
    'verified',
    'Saudi Ministry of Health - Pharmaceutical Establishments and Products Regulations',
    'https://www.moh.gov.sa/Ministry/Rules/Documents/051.pdf',
    100,
    jsonb_build_object(
      'entity_scope','pharmacy_establishment',
      'published_license_fee_sar',1000,
      'license_term_years',5,
      'requirements_reference_url','https://www.moh.gov.sa/eservices/licences/pages/licences.aspx'
    )
  from activity
  where not exists (
    select 1
    from public.country_regulatory_requirements existing
    where existing.country_code='SA'
      and existing.canonical_activity_id=activity.id
      and existing.requirement_name_en='Pharmacy Establishment License'
  )
  returning id
)
update public.canonical_activity_country cac
set
  availability_status='restricted',
  regulatory_status='verified',
  updated_at=now(),
  metadata=coalesce(cac.metadata,'{}'::jsonb) || jsonb_build_object(
    'regulatory_evidence','Saudi Ministry of Health',
    'license_required',true
  )
from activity
where cac.country_code='SA'
  and cac.canonical_activity_id=activity.id;
