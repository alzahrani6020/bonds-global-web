-- Saudi regulatory batch 01: real estate brokerage.
-- Official source: Real Estate General Authority (REGA).
-- Scope: establishments conducting real estate brokerage and marketing.

with activity as (
  select id
  from public.canonical_activities
  where code='real_estate_brokerage'
),
upsert_requirements as (
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
    v.requirement_name_ar,
    v.requirement_name_en,
    v.issuing_authority,
    v.requirement_type,
    true,
    v.estimated_cost,
    v.currency_code,
    'verified',
    v.source,
    v.source_url,
    100,
    v.metadata
  from activity
  cross join (
    values
      (
        'رخصة فال للوساطة والتسويق العقاري للمنشآت',
        'FAL License for Real Estate Brokerage and Marketing for Establishments',
        'Real Estate General Authority (REGA)',
        'license',
        1000::numeric,
        'SAR',
        'REGA - Issuing FAL License for Brokerage and Marketing for Establishments',
        'https://rega.gov.sa/en/rega-services/eservices/issuing-fal-license-for-brokerage-and-marketing-for-establishments/',
        '{"entity_scope":"establishment","fee_period":"annual","official_activity_code":"682010"}'::jsonb
      ),
      (
        'سجل تجاري ساري يتضمن نشاط الوساطة العقارية 682010',
        'Valid commercial registration including real estate brokerage activity 682010',
        'Ministry of Commerce / verified by REGA licensing service',
        'commercial_registration',
        null::numeric,
        null::text,
        'REGA - Issuing FAL License for Brokerage and Marketing for Establishments',
        'https://rega.gov.sa/en/rega-services/eservices/issuing-fal-license-for-brokerage-and-marketing-for-establishments/',
        '{"entity_scope":"establishment","official_activity_code":"682010"}'::jsonb
      )
  ) as v(
    requirement_name_ar,
    requirement_name_en,
    issuing_authority,
    requirement_type,
    estimated_cost,
    currency_code,
    source,
    source_url,
    metadata
  )
  where not exists (
    select 1
    from public.country_regulatory_requirements existing
    where existing.country_code='SA'
      and existing.canonical_activity_id=activity.id
      and existing.requirement_name_en=v.requirement_name_en
  )
  returning id
)
update public.canonical_activity_country cac
set
  availability_status='restricted',
  regulatory_status='verified',
  updated_at=now(),
  metadata=coalesce(cac.metadata,'{}'::jsonb) || jsonb_build_object(
    'regulatory_evidence','REGA',
    'license_required',true,
    'official_activity_code','682010'
  )
from activity
where cac.country_code='SA'
  and cac.canonical_activity_id=activity.id;
