-- Include provider ADM1 readiness in the existing Data Quality Center.

begin;

create or replace function public.dq_run_all_checks()
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $func$
declare
  v_dup bigint;
  v_miss bigint;
  v_broken bigint;
  v_incomp bigint;
  v_geo bigint;
  v_geo_admin bigint;
  v_geo_admin_sources bigint;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role','') <> 'service_role'
     and not public.is_advisory_manager() then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  perform public.clear_data_quality_issues();
  v_dup := public.dq_find_duplicate_clients();
  v_miss := public.dq_find_missing_fields();
  v_broken := public.dq_find_broken_relations();
  v_incomp := public.dq_find_incomplete_projects();
  v_geo := public.dq_find_geo_integrity();
  v_geo_admin := public.dq_find_geo_admin_hierarchy();
  v_geo_admin_sources := public.dq_find_geo_admin_source_links();

  return jsonb_build_object(
    'duplicates',v_dup,
    'missing_fields',v_miss,
    'broken_relations',v_broken,
    'incomplete_projects',v_incomp,
    'geo_integrity',v_geo + v_geo_admin + v_geo_admin_sources,
    'geo_admin_hierarchy',v_geo_admin,
    'geo_admin_source_links',v_geo_admin_sources
  );
end;
$func$;

commit;
