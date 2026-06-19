-- Public stats for homepage trust indicators
-- Returns aggregated counts without exposing sensitive records.

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clients bigint;
  v_projects bigint;
  v_studies bigint;
  v_reports bigint;
  v_assets bigint;
BEGIN
  SELECT count(*) INTO v_clients FROM public.advisory_clients WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_projects FROM public.advisory_projects WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_studies FROM public.advisory_feasibility_studies;
  SELECT count(*) INTO v_reports FROM public.ai_advisor_reports;
  SELECT count(*) INTO v_assets FROM public.recovery_assets WHERE deleted_at IS NULL;

  RETURN jsonb_build_object(
    'clients', coalesce(v_clients, 0),
    'projects', coalesce(v_projects, 0),
    'studies', coalesce(v_studies, 0),
    'reports', coalesce(v_reports, 0),
    'assets', coalesce(v_assets, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;
