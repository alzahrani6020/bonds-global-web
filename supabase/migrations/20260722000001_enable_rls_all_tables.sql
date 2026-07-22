-- ============================================
-- Enable Row-Level Security (RLS) on all public tables
-- Applies safe default policies and owner-based access where possible.
-- Service role retains full access; authenticated users see only their own
-- data where a user/owner/profile column exists.
-- ============================================

-- Helper function: check whether the current user is an admin or manager.
-- Looks at admin_roles (super_admin / admin) and advisory_roles (manager).
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

-- Helper function: apply safe default RLS policies to a table based on
-- available ownership columns.
CREATE OR REPLACE FUNCTION public.apply_safe_rls(
  p_table TEXT,
  p_user_columns TEXT[] DEFAULT ARRAY['user_id', 'owner_id', 'created_by', 'profile_id', 'id']
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_col TEXT;
  v_owner_col TEXT := NULL;
  v_policy_base TEXT;
BEGIN
  -- Enable RLS on the table.
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', p_table);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', p_table);

  -- Find a usable ownership column.
  FOREACH v_col IN ARRAY p_user_columns
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table AND column_name = v_col
    ) THEN
      v_owner_col := v_col;
      EXIT;
    END IF;
  END LOOP;

  -- Special case: profiles uses id as the user id.
  IF p_table = 'profiles' THEN
    v_owner_col := 'id';
  END IF;

  v_policy_base := replace(p_table, '.', '_');

  -- Drop existing default policies to make migration idempotent.
  EXECUTE format('DROP POLICY IF EXISTS "%I_select" ON public.%I;', v_policy_base, p_table);
  EXECUTE format('DROP POLICY IF EXISTS "%I_insert" ON public.%I;', v_policy_base, p_table);
  EXECUTE format('DROP POLICY IF EXISTS "%I_update" ON public.%I;', v_policy_base, p_table);
  EXECUTE format('DROP POLICY IF EXISTS "%I_delete" ON public.%I;', v_policy_base, p_table);
  EXECUTE format('DROP POLICY IF EXISTS "%I_admin_select" ON public.%I;', v_policy_base, p_table);
  EXECUTE format('DROP POLICY IF EXISTS "%I_service_all" ON public.%I;', v_policy_base, p_table);

  -- If we found an ownership column, grant authenticated users access to their own rows.
  IF v_owner_col IS NOT NULL THEN
    EXECUTE format(
      'CREATE POLICY "%I_select" ON public.%I FOR SELECT TO authenticated USING (%I = auth.uid());',
      v_policy_base, p_table, v_owner_col
    );
    EXECUTE format(
      'CREATE POLICY "%I_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (%I = auth.uid());',
      v_policy_base, p_table, v_owner_col
    );
    EXECUTE format(
      'CREATE POLICY "%I_update" ON public.%I FOR UPDATE TO authenticated USING (%I = auth.uid()) WITH CHECK (%I = auth.uid());',
      v_policy_base, p_table, v_owner_col, v_owner_col
    );
    EXECUTE format(
      'CREATE POLICY "%I_delete" ON public.%I FOR DELETE TO authenticated USING (%I = auth.uid());',
      v_policy_base, p_table, v_owner_col
    );
  END IF;

  -- Admin/manager read access for dashboards and admin panels.
  EXECUTE format(
    'CREATE POLICY "%I_admin_select" ON public.%I FOR SELECT TO authenticated USING (public.is_bonds_admin());',
    v_policy_base, p_table
  );

  -- Service role can do everything (used by serverless APIs).
  EXECUTE format(
    'CREATE POLICY "%I_service_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
    v_policy_base, p_table
  );
END;
$$;

-- Apply RLS to every table in the public schema.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname NOT LIKE '_%'
  LOOP
    PERFORM public.apply_safe_rls(r.tablename);
  END LOOP;
END $$;

-- Clean up helper functions.
DROP FUNCTION IF EXISTS public.apply_safe_rls(TEXT, TEXT[]);
-- Keep public.is_bonds_admin() for policies to use.

-- Allow anonymous users to submit contact messages / partner requests / leads.
-- These are intentionally public write-only tables.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_messages') THEN
    DROP POLICY IF EXISTS "contact_messages_anon_insert" ON public.contact_messages;
    CREATE POLICY "contact_messages_anon_insert" ON public.contact_messages
    FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_partner_requests') THEN
    DROP POLICY IF EXISTS "bank_partner_requests_anon_insert" ON public.bank_partner_requests;
    CREATE POLICY "bank_partner_requests_anon_insert" ON public.bank_partner_requests
    FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'funding_readiness_leads') THEN
    DROP POLICY IF EXISTS "funding_readiness_leads_anon_insert" ON public.funding_readiness_leads;
    CREATE POLICY "funding_readiness_leads_anon_insert" ON public.funding_readiness_leads
    FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- Storage: ensure avatars bucket remains publicly readable but writable only by authenticated users.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    UPDATE storage.buckets SET public = true WHERE id = 'avatars';

    DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
    DROP POLICY IF EXISTS "avatars_authenticated_insert" ON storage.objects;
    DROP POLICY IF EXISTS "avatars_authenticated_update" ON storage.objects;
    DROP POLICY IF EXISTS "avatars_authenticated_delete" ON storage.objects;
    DROP POLICY IF EXISTS "avatars_service_all" ON storage.objects;

    CREATE POLICY "avatars_public_select" ON storage.objects
    FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

    CREATE POLICY "avatars_authenticated_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

    CREATE POLICY "avatars_authenticated_update" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

    CREATE POLICY "avatars_authenticated_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'avatars');

    CREATE POLICY "avatars_service_all" ON storage.objects
    FOR ALL TO service_role USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;

-- Safety net: ensure every public table that has RLS enabled also has at least
-- the service_role and admin_select policies. Some system-owned tables may not
-- be visible to pg_class/apply_safe_rls ownership checks.
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
      AND c.relrowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname
      )
  LOOP
    v_policy_base := replace(r.tablename, '.', '_');

    EXECUTE format(
      'CREATE POLICY "%I_admin_select" ON public.%I FOR SELECT TO authenticated USING (public.is_bonds_admin());',
      v_policy_base, r.tablename
    );

    EXECUTE format(
      'CREATE POLICY "%I_service_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
      v_policy_base, r.tablename
    );
  END LOOP;
END $$;

-- Verify: show tables that still have no policies (should be none after this runs).
SELECT c.relname AS tablename
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname
  );
