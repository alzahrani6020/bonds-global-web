-- Saudi regulatory batch 04: dental clinics and medical laboratories.
-- Official source: Saudi Ministry of Health health licensing services.
-- Conservative: records only the requirement for a health facility license.

with activities as (
  select id,code
  from public.canonical_activities
  where code in ('dental_clinic','dental_clinics','medical_lab')
),
ins as (
  insert into public.country_regulatory_requirements (
    country_code,canonical_activity_id,requirement_name_ar,requirement_name_en,
    issuing_authority,requirement_type,mandatory,verification_status,
    source,source_url,confidence,metadata
  )
  select
    'SA',a.id,
    'ترخيص منشأة صحية',
    'Health Facility License',
    'Saudi Ministry of Health',
    'license',true,'verified',
    'Saudi Ministry of Health - Health Licensing Services',
    'https://www.moh.gov.sa/eservices/licences/pages/default.aspx',
    100,
    jsonb_build_object('entity_scope','private_health_facility','activity_code',a.code)
  from activities a
  where not exists (
    select 1 from public.country_regulatory_requirements e
    where e.country_code='SA'
      and e.canonical_activity_id=a.id
      and e.requirement_name_en='Health Facility License'
  )
  returning id
)
update public.canonical_activity_country cac
set availability_status='restricted',
    regulatory_status='verified',
    updated_at=now(),
    metadata=coalesce(cac.metadata,'{}'::jsonb) || jsonb_build_object(
      'regulatory_evidence','Saudi Ministry of Health',
      'license_required',true
    )
from activities a
where cac.country_code='SA' and cac.canonical_activity_id=a.id;
