-- ============================================
-- Emergency RLS Lockdown
-- Date: 2026-08-19
-- Purpose: Close all public-table data exposure by enabling RLS
--          and ensuring every table has at least service_role + admin
--          policies.  Also fixes the social_* tables created without RLS.
--          Safe to re-run (idempotent).
-- ============================================

-- ---------------------------------------------------------------------------
-- 1. Admin helper (kept if it already exists from 20260722000001).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_bonds_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.advisory_roles
    WHERE user_id = auth.uid() AND role = 'manager'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Ensure every public table has RLS enabled and has at least
--    service_role (ALL) and admin_select policies.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_policy_base TEXT;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname NOT LIKE '_%'
    ORDER BY c.relname
  LOOP
    v_policy_base := replace(r.tablename, '.', '_');

    -- Enable and force RLS.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', r.tablename);

    -- Ensure service_role can do everything (serverless APIs).
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = r.tablename
        AND p.policyname = format('%s_service_all', v_policy_base)
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%I_service_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        v_policy_base, r.tablename
      );
    END IF;

    -- Ensure admins can read everything for dashboards.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = r.tablename
        AND p.policyname = format('%s_admin_select', v_policy_base)
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%I_admin_select" ON public.%I FOR SELECT TO authenticated USING (public.is_bonds_admin());',
        v_policy_base, r.tablename
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Social media tables: lock down public access.
--    These were created without RLS and are the likely source of the alert.
-- ---------------------------------------------------------------------------

-- social_accounts: admin read/write only; service_role full access already added above.
DROP POLICY IF EXISTS social_accounts_public_select ON public.social_accounts;
DROP POLICY IF EXISTS social_accounts_anon_select ON public.social_accounts;
DROP POLICY IF EXISTS social_accounts_authenticated_select ON public.social_accounts;

DROP POLICY IF EXISTS social_accounts_admin_all ON public.social_accounts;
CREATE POLICY social_accounts_admin_all ON public.social_accounts
  FOR ALL TO authenticated
  USING (public.is_bonds_admin())
  WITH CHECK (public.is_bonds_admin());

-- social_posts: admin read/write only.
DROP POLICY IF EXISTS social_posts_public_select ON public.social_posts;
DROP POLICY IF EXISTS social_posts_anon_select ON public.social_posts;
DROP POLICY IF EXISTS social_posts_authenticated_select ON public.social_posts;

DROP POLICY IF EXISTS social_posts_admin_all ON public.social_posts;
CREATE POLICY social_posts_admin_all ON public.social_posts
  FOR ALL TO authenticated
  USING (public.is_bonds_admin())
  WITH CHECK (public.is_bonds_admin());

-- social_scheduled_posts: admins + creator can manage their own posts.
DROP POLICY IF EXISTS social_scheduled_posts_public_select ON public.social_scheduled_posts;
DROP POLICY IF EXISTS social_scheduled_posts_anon_select ON public.social_scheduled_posts;

DROP POLICY IF EXISTS social_scheduled_posts_own_all ON public.social_scheduled_posts;
CREATE POLICY social_scheduled_posts_own_all ON public.social_scheduled_posts
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS social_scheduled_posts_admin_all ON public.social_scheduled_posts;
CREATE POLICY social_scheduled_posts_admin_all ON public.social_scheduled_posts
  FOR ALL TO authenticated
  USING (public.is_bonds_admin())
  WITH CHECK (public.is_bonds_admin());

-- ---------------------------------------------------------------------------
-- 4. Rate-limit bucket: keep public write for anon rate limiting,
--    but block public reads.  Service role can read/admin.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS rate_limit_buckets_public_select ON public.rate_limit_buckets;
DROP POLICY IF EXISTS rate_limit_buckets_anon_select ON public.rate_limit_buckets;
DROP POLICY IF EXISTS rate_limit_buckets_authenticated_select ON public.rate_limit_buckets;

DROP POLICY IF EXISTS rate_limit_buckets_anon_write ON public.rate_limit_buckets;
CREATE POLICY rate_limit_buckets_anon_write ON public.rate_limit_buckets
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS rate_limit_buckets_authenticated_write ON public.rate_limit_buckets;
CREATE POLICY rate_limit_buckets_authenticated_write ON public.rate_limit_buckets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. Public-read / anon-insert tables: re-affirm safe known behaviours.
-- ---------------------------------------------------------------------------

-- contact_messages: public insert only, admin everything else.
DROP POLICY IF EXISTS contact_messages_public_select ON public.contact_messages;
DROP POLICY IF EXISTS contact_messages_anon_select ON public.contact_messages;

DROP POLICY IF EXISTS contact_messages_anon_insert ON public.contact_messages;
CREATE POLICY contact_messages_anon_insert ON public.contact_messages
  FOR INSERT TO anon WITH CHECK (true);

-- bank_partner_requests: public insert only.
DROP POLICY IF EXISTS bank_partner_requests_public_select ON public.bank_partner_requests;
DROP POLICY IF EXISTS bank_partner_requests_anon_select ON public.bank_partner_requests;

DROP POLICY IF EXISTS bank_partner_requests_anon_insert ON public.bank_partner_requests;
CREATE POLICY bank_partner_requests_anon_insert ON public.bank_partner_requests
  FOR INSERT TO anon WITH CHECK (true);

-- funding_readiness_leads: public insert only.
DROP POLICY IF EXISTS funding_readiness_leads_public_select ON public.funding_readiness_leads;
DROP POLICY IF EXISTS funding_readiness_leads_anon_select ON public.funding_readiness_leads;

DROP POLICY IF EXISTS funding_readiness_leads_anon_insert ON public.funding_readiness_leads;
CREATE POLICY funding_readiness_leads_anon_insert ON public.funding_readiness_leads
  FOR INSERT TO anon WITH CHECK (true);

-- calculator_leads: public insert only.
DROP POLICY IF EXISTS calculator_leads_public_select ON public.calculator_leads;
DROP POLICY IF EXISTS calculator_leads_anon_select ON public.calculator_leads;

DROP POLICY IF EXISTS calculator_leads_anon_insert ON public.calculator_leads;
CREATE POLICY calculator_leads_anon_insert ON public.calculator_leads
  FOR INSERT TO anon WITH CHECK (true);

-- water_factory_market_data: public read active data only.
DROP POLICY IF EXISTS water_factory_market_data_public_all ON public.water_factory_market_data;

DROP POLICY IF EXISTS water_factory_market_data_public_read ON public.water_factory_market_data;
CREATE POLICY water_factory_market_data_public_read ON public.water_factory_market_data
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS water_factory_market_data_service_write ON public.water_factory_market_data;
CREATE POLICY water_factory_market_data_service_write ON public.water_factory_market_data
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- sector_market_data: public read active data only.
DROP POLICY IF EXISTS sector_market_data_public_all ON public.sector_market_data;

DROP POLICY IF EXISTS sector_market_data_public_read ON public.sector_market_data;
CREATE POLICY sector_market_data_public_read ON public.sector_market_data
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS sector_market_data_service_write ON public.sector_market_data;
CREATE POLICY sector_market_data_service_write ON public.sector_market_data
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- page_views / user_presence: public insert/update but no public read.
DROP POLICY IF EXISTS page_views_public_select ON public.page_views;
DROP POLICY IF EXISTS page_views_anon_select ON public.page_views;

DROP POLICY IF EXISTS "Allow anonymous page view inserts" ON public.page_views;
CREATE POLICY "Allow anonymous page view inserts" ON public.page_views
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS user_presence_public_select ON public.user_presence;
DROP POLICY IF EXISTS user_presence_anon_select ON public.user_presence;

DROP POLICY IF EXISTS "Allow anonymous presence inserts" ON public.user_presence;
CREATE POLICY "Allow anonymous presence inserts" ON public.user_presence
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous presence updates" ON public.user_presence;
CREATE POLICY "Allow anonymous presence updates" ON public.user_presence
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. Storage bucket: ensure social-media bucket is private + service-role only.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'social-media') THEN
    UPDATE storage.buckets SET public = false WHERE id = 'social-media';

    DROP POLICY IF EXISTS social_media_public_select ON storage.objects;
    DROP POLICY IF EXISTS social_media_anon_select ON storage.objects;

    DROP POLICY IF EXISTS social_media_service_all ON storage.objects;
    CREATE POLICY social_media_service_all ON storage.objects
      FOR ALL TO service_role USING (bucket_id = 'social-media') WITH CHECK (bucket_id = 'social-media');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Verification: list any table that still has RLS enabled but no policies.
--    This should return zero rows after the migration runs.
-- ---------------------------------------------------------------------------
SELECT c.relname AS tablename,
       NOT c.relrowsecurity AS rls_disabled,
       (SELECT COUNT(*) FROM pg_policies p
        WHERE p.schemaname = n.nspname AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE '_%'
  AND (
    NOT c.relrowsecurity
    OR NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = n.nspname AND p.tablename = c.relname
    )
  )
ORDER BY c.relname;
