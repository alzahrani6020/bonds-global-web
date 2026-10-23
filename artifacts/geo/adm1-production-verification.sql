-- GeoNames ADM1 final production verification — read only
select
  count(*)::int as geonames_links,
  count(distinct admin_area_id)::int as linked_admin_areas,
  count(distinct source_admin_code)::int as distinct_source_admin_codes,
  count(distinct source_id)::int as distinct_source_ids
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
  (select metadata->'adm1_reconciliation' from public.geo_data_sources where code='geonames') as reconciliation_metadata;
