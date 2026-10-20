-- ADM1 production verification — read only
select
  count(*)::int as total_links,
  count(distinct admin_area_id)::int as linked_admin_areas,
  count(distinct source_admin_code)::int as distinct_admin_codes,
  count(distinct source_id)::int as distinct_source_ids,
  count(*) filter (where metadata->>'rollout'='adm1-strict-2026-10-20')::int as strict_batch,
  count(*) filter (where metadata->>'rollout'='adm1-alias-safe-2026-10-20')::int as safe_alias_batch,
  count(*) filter (where metadata->>'rollout'='adm1-external-alias-2026-10-20')::int as externally_verified_alias_batch
from public.geo_admin_area_source_links
where source_code='geonames';

select
  count(*) filter (where a.id is null)::int as orphan_links,
  count(*) filter (
    where a.id is not null
      and (l.country_code<>a.country_code or l.admin_level<>a.admin_level)
  )::int as scope_mismatches
from public.geo_admin_area_source_links l
left join public.geo_admin_areas a on a.id=l.admin_area_id
where l.source_code='geonames';

select count(*)::int as duplicate_admin_area_links
from (
  select admin_area_id
  from public.geo_admin_area_source_links
  where source_code='geonames'
  group by admin_area_id
  having count(*)>1
) d;

select
  (select count(*) from public.geo_admin_areas where admin_level=1)::int as adm1_rows,
  (select count(*) from public.geo_places)::int as geo_places,
  (select count(*) from public.geo_data_sources where code='geonames')::int as canonical_provider,
  (select count(*) from public.geo_data_sources where code='geonames_dump')::int as legacy_provider;
