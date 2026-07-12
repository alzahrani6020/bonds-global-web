-- ============================================
-- Allow unified admin_roles users to manage valuation tables
-- Previously these tables only recognized legacy user_roles (admin/editor).
-- Dashboard admins are stored in admin_roles (super_admin/admin/support).
-- ============================================

-- Helper: any user that is an admin in either role system
CREATE OR REPLACE FUNCTION public.is_valuation_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
  )
  OR EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin', 'support')
  );
$$;

-- ── condition_assessment_standards ─────────────────────────
DROP POLICY IF EXISTS "Condition assessment standards editable by admins" ON public.condition_assessment_standards;
CREATE POLICY "Condition assessment standards editable by admins"
  ON public.condition_assessment_standards FOR ALL
  USING (public.is_valuation_admin())
  WITH CHECK (public.is_valuation_admin());

-- ── asset_condition_assessments ────────────────────────────
DROP POLICY IF EXISTS "Asset condition assessments readable by owner or admin" ON public.asset_condition_assessments;
CREATE POLICY "Asset condition assessments readable by owner or admin"
  ON public.asset_condition_assessments FOR SELECT
  USING (
    auth.uid() = client_id
    OR auth.uid() = assessed_by
    OR public.is_valuation_admin()
  );

DROP POLICY IF EXISTS "Asset condition assessments updatable by owner or admin" ON public.asset_condition_assessments;
CREATE POLICY "Asset condition assessments updatable by owner or admin"
  ON public.asset_condition_assessments FOR UPDATE
  USING (
    auth.uid() = assessed_by
    OR public.is_valuation_admin()
  );

DROP POLICY IF EXISTS "Asset condition assessments deletable by admin" ON public.asset_condition_assessments;
CREATE POLICY "Asset condition assessments deletable by admin"
  ON public.asset_condition_assessments FOR DELETE
  USING (public.is_valuation_admin());

-- ── risk_assessments ───────────────────────────────────────
DROP POLICY IF EXISTS "Risk assessments readable by owner or admin" ON public.risk_assessments;
CREATE POLICY "Risk assessments readable by owner or admin"
  ON public.risk_assessments FOR SELECT
  USING (
    auth.uid() = client_id
    OR auth.uid() = assessed_by
    OR public.is_valuation_admin()
  );

DROP POLICY IF EXISTS "Risk assessments updatable by owner or admin" ON public.risk_assessments;
CREATE POLICY "Risk assessments updatable by owner or admin"
  ON public.risk_assessments FOR UPDATE
  USING (
    auth.uid() = assessed_by
    OR public.is_valuation_admin()
  );

DROP POLICY IF EXISTS "Risk assessments deletable by admin" ON public.risk_assessments;
CREATE POLICY "Risk assessments deletable by admin"
  ON public.risk_assessments FOR DELETE
  USING (public.is_valuation_admin());

-- ── market_data ────────────────────────────────────────────
DROP POLICY IF EXISTS "Market data is editable by admins" ON public.market_data;
CREATE POLICY "Market data is editable by admins"
  ON public.market_data FOR ALL
  USING (public.is_valuation_admin())
  WITH CHECK (public.is_valuation_admin());

-- ── market_data_history ────────────────────────────────────
DROP POLICY IF EXISTS "Market data history is editable by admins" ON public.market_data_history;
CREATE POLICY "Market data history is editable by admins"
  ON public.market_data_history FOR ALL
  USING (public.is_valuation_admin())
  WITH CHECK (public.is_valuation_admin());

-- ── market_data_sources ────────────────────────────────────
DROP POLICY IF EXISTS "Market data sources are readable by admins" ON public.market_data_sources;
CREATE POLICY "Market data sources are readable by admins"
  ON public.market_data_sources FOR SELECT
  USING (public.is_valuation_admin());

DROP POLICY IF EXISTS "Market data sources are editable by admins" ON public.market_data_sources;
CREATE POLICY "Market data sources are editable by admins"
  ON public.market_data_sources FOR ALL
  USING (public.is_valuation_admin())
  WITH CHECK (public.is_valuation_admin());
