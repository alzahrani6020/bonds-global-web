-- Security containment closure: storage, recovery/city RLS, and atomic one-off fulfillment.
-- Designed to be safe on current production state and idempotent where practical.

-- ---------------------------------------------------------------------------
-- Storage: avatars must be owner-scoped for authenticated mutations.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads 1oj01fe_1" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_delete" ON storage.objects;

CREATE POLICY "avatars_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
  );

CREATE POLICY "avatars_authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
  );

CREATE POLICY "avatars_authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Storage: social media uploads must traverse the verified server API.
-- The service-role upload path bypasses RLS; authenticated browser users do not.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Social media authenticated upload" ON storage.objects;

-- ---------------------------------------------------------------------------
-- Storage: advisory reports are private. Authenticated reads are authorized
-- through RLS; public object URLs must not bypass that model.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'advisory-reports';

DROP POLICY IF EXISTS "advisory_reports_storage_select" ON storage.objects;
CREATE POLICY "advisory_reports_storage_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'advisory-reports'
    AND (
      public.is_advisory_user()
      OR EXISTS (
        SELECT 1
        FROM public.ai_advisor_reports r
        JOIN public.advisory_clients c ON c.id = r.client_id
        WHERE r.pdf_url LIKE '%' || storage.objects.name || '%'
          AND c.auth_user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Recovery authorization helper.
-- Prevent argument spoofing for SECURITY DEFINER callers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recovery_can_access(user_uuid uuid)
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

REVOKE ALL ON FUNCTION public.recovery_can_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recovery_can_access(uuid) TO authenticated, service_role;

-- Restrict all Recovery module reads to Recovery users / site admins.
DROP POLICY IF EXISTS "recovery_assets_select" ON public.recovery_assets;
CREATE POLICY "recovery_assets_select" ON public.recovery_assets
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_valuations_select" ON public.recovery_asset_valuations;
CREATE POLICY "recovery_valuations_select" ON public.recovery_asset_valuations
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_reasons_select" ON public.recovery_distress_reasons;
CREATE POLICY "recovery_reasons_select" ON public.recovery_distress_reasons
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_plans_select" ON public.recovery_plans;
CREATE POLICY "recovery_plans_select" ON public.recovery_plans
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_stages_select" ON public.recovery_plan_stages;
CREATE POLICY "recovery_stages_select" ON public.recovery_plan_stages
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_costs_select" ON public.recovery_costs;
CREATE POLICY "recovery_costs_select" ON public.recovery_costs
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_investors_select" ON public.recovery_investors;
CREATE POLICY "recovery_investors_select" ON public.recovery_investors
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_offers_select" ON public.recovery_investor_offers;
CREATE POLICY "recovery_offers_select" ON public.recovery_investor_offers
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_documents_select" ON public.recovery_documents;
CREATE POLICY "recovery_documents_select" ON public.recovery_documents
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_notes_select" ON public.recovery_notes;
CREATE POLICY "recovery_notes_select" ON public.recovery_notes
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

DROP POLICY IF EXISTS "recovery_logs_select" ON public.recovery_activity_logs;
CREATE POLICY "recovery_logs_select" ON public.recovery_activity_logs
  FOR SELECT TO authenticated
  USING (public.recovery_can_access(auth.uid()));

-- Audit log writes follow the same authority as state-changing Recovery actions.
DROP POLICY IF EXISTS "recovery_logs_write" ON public.recovery_activity_logs;
CREATE POLICY "recovery_logs_write" ON public.recovery_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.recovery_is_manager_or_admin(auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "recovery_documents_storage_select" ON storage.objects;
CREATE POLICY "recovery_documents_storage_select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'recovery-documents'
    AND public.recovery_can_access(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- City activity logs: prevent arbitrary authenticated audit-log poisoning.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "city_logs_write" ON public.city_activity_logs;
CREATE POLICY "city_logs_write" ON public.city_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.city_is_manager_or_admin(auth.uid())
    AND created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Atomic one-off fulfillment.
-- Locks the purchase and profile rows in one transaction and increments JSONB
-- credits without a read/modify/write race in application code.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_oneoff_purchase_atomic(
  p_stripe_session_id text,
  p_user_id uuid,
  p_product text,
  p_payment_intent_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_purchase public.oneoff_purchases%ROWTYPE;
  v_credits jsonb;
  v_current integer;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;

  IF p_product NOT IN ('ai_report', 'expert_review', 'approved_report') THEN
    RAISE EXCEPTION 'invalid product' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_purchase
  FROM public.oneoff_purchases
  WHERE stripe_session_id = p_stripe_session_id
    AND user_id = p_user_id
    AND product = p_product
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_purchase.status = 'paid' THEN
    RETURN false;
  END IF;

  IF v_purchase.status <> 'pending' THEN
    RETURN false;
  END IF;

  SELECT coalesce(oneoff_credits, '{}'::jsonb)
  INTO v_credits
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_current := coalesce((v_credits ->> p_product)::integer, 0);

  UPDATE public.profiles
  SET oneoff_credits = jsonb_set(
        v_credits,
        ARRAY[p_product],
        to_jsonb(v_current + 1),
        true
      ),
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.oneoff_purchases
  SET status = 'paid',
      stripe_payment_intent_id = p_payment_intent_id,
      paid_at = now()
  WHERE id = v_purchase.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_oneoff_purchase_atomic(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_oneoff_purchase_atomic(text, uuid, text, text)
  TO service_role;
