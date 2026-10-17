CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.recovery_can_access(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM user_uuid THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.recovery_roles r
    WHERE r.user_id = user_uuid
      AND r.role IN ('admin', 'manager', 'viewer')
  )
  OR EXISTS (
    SELECT 1
    FROM public.admin_roles a
    WHERE a.user_id = user_uuid
      AND a.role IN ('super_admin', 'admin')
  );
END;
$$;

REVOKE ALL ON FUNCTION private.recovery_can_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.recovery_can_access(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "recovery_assets_select" ON public.recovery_assets;
CREATE POLICY "recovery_assets_select" ON public.recovery_assets FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_valuations_select" ON public.recovery_asset_valuations;
CREATE POLICY "recovery_valuations_select" ON public.recovery_asset_valuations FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_reasons_select" ON public.recovery_distress_reasons;
CREATE POLICY "recovery_reasons_select" ON public.recovery_distress_reasons FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_plans_select" ON public.recovery_plans;
CREATE POLICY "recovery_plans_select" ON public.recovery_plans FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_stages_select" ON public.recovery_plan_stages;
CREATE POLICY "recovery_stages_select" ON public.recovery_plan_stages FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_costs_select" ON public.recovery_costs;
CREATE POLICY "recovery_costs_select" ON public.recovery_costs FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_investors_select" ON public.recovery_investors;
CREATE POLICY "recovery_investors_select" ON public.recovery_investors FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_offers_select" ON public.recovery_investor_offers;
CREATE POLICY "recovery_offers_select" ON public.recovery_investor_offers FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_documents_select" ON public.recovery_documents;
CREATE POLICY "recovery_documents_select" ON public.recovery_documents FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_notes_select" ON public.recovery_notes;
CREATE POLICY "recovery_notes_select" ON public.recovery_notes FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_logs_select" ON public.recovery_activity_logs;
CREATE POLICY "recovery_logs_select" ON public.recovery_activity_logs FOR SELECT TO authenticated
USING (private.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_documents_storage_select" ON storage.objects;
CREATE POLICY "recovery_documents_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'recovery-documents'
  AND private.recovery_can_access(auth.uid())
);

DROP FUNCTION IF EXISTS public.recovery_can_access(uuid);
