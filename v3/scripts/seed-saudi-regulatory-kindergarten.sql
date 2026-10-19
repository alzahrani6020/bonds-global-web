-- Saudi regulatory batch 05: kindergarten.
-- Official source: Saudi Ministry of Education.
-- Conservative: records the operating license and core prerequisite approvals only.

with activity as (
  select id from public.canonical_activities where code='kindergarten'
),
ins as (
  insert into public.country_regulatory_requirements (
    country_code,canonical_activity_id,requirement_name_ar,requirement_name_en,
    issuing_authority,requirement_type,mandatory,verification_status,
    source,source_url,confidence,metadata
  )
  select
    'SA',activity.id,
    v.requirement_name_ar,v.requirement_name_en,v.issuing_authority,
    v.requirement_type,true,'verified',
    v.source,v.source_url,100,v.metadata
  from activity
  cross join (
    values
      (
        'ترخيص تشغيلي لمنشأة تعليم عام أهلي / رياض أطفال',
        'Operating License for Private General Education / Kindergarten',
        'Saudi Ministry of Education',
        'license',
        'Saudi Ministry of Education - Operating License for Private General Education Establishments',
        'https://www.moe.gov.sa/ar/knowledgecenter/eservices/Pages/tarakhees.aspx',
        '{"entity_scope":"kindergarten","license_scope":"operating"}'::jsonb
      ),
      (
        'ترخيص سلامة من الدفاع المدني',
        'Civil Defense Safety License',
        'Saudi Civil Defense / prerequisite published by Ministry of Education',
        'safety_license',
        'Saudi Ministry of Education - Operating License for Private General Education Establishments',
        'https://www.moe.gov.sa/ar/knowledgecenter/eservices/Pages/tarakhees.aspx',
        '{"entity_scope":"kindergarten","prerequisite":true}'::jsonb
      )
  ) as v(requirement_name_ar,requirement_name_en,issuing_authority,requirement_type,source,source_url,metadata)
  where not exists (
    select 1 from public.country_regulatory_requirements e
    where e.country_code='SA'
      and e.canonical_activity_id=activity.id
      and e.requirement_name_en=v.requirement_name_en
  )
  returning id
)
update public.canonical_activity_country cac
set availability_status='restricted',
    regulatory_status='verified',
    updated_at=now(),
    metadata=coalesce(cac.metadata,'{}'::jsonb) || jsonb_build_object(
      'regulatory_evidence','Saudi Ministry of Education',
      'license_required',true
    )
from activity
where cac.country_code='SA' and cac.canonical_activity_id=activity.id;
