-- Saudi regulatory batch 03: Hajj & Umrah agency.
-- Official source: Ministry of Hajj and Umrah executive regulations.
-- Conservative: records only the licensing requirement and published license term.

with activity as (
  select id from public.canonical_activities where code='hajj_umrah_agency'
),
ins as (
  insert into public.country_regulatory_requirements (
    country_code,canonical_activity_id,requirement_name_ar,requirement_name_en,
    issuing_authority,requirement_type,mandatory,verification_status,
    source,source_url,confidence,metadata
  )
  select
    'SA',activity.id,
    'ترخيص مزاولة نشاط خدمات المعتمرين',
    'License to Provide Umrah Services',
    'Saudi Ministry of Hajj and Umrah',
    'license',true,'verified',
    'Ministry of Hajj and Umrah - Executive Regulations for Organizing Umrah Services',
    'https://haj.gov.sa/s-core/-/media/Project/HAJJ/PDF/Document-Library/Executive-Regulations-for-Regulating-Umrah-Services.pdf',
    100,
    jsonb_build_object('entity_scope','saudi_establishment','license_term_years',5)
  from activity
  where not exists (
    select 1 from public.country_regulatory_requirements e
    where e.country_code='SA'
      and e.canonical_activity_id=activity.id
      and e.requirement_name_en='License to Provide Umrah Services'
  )
  returning id
)
update public.canonical_activity_country cac
set availability_status='restricted',
    regulatory_status='verified',
    updated_at=now(),
    metadata=coalesce(cac.metadata,'{}'::jsonb) || jsonb_build_object(
      'regulatory_evidence','Saudi Ministry of Hajj and Umrah',
      'license_required',true
    )
from activity
where cac.country_code='SA' and cac.canonical_activity_id=activity.id;
