-- HR platform-owner billing exception (workspace scoped).
-- Executed on Production 2026-11-25; retain regular user entitlements and all existing RLS.
-- Platform-owner access is derived from public.admin_roles via public.is_super_admin().
-- Neither this migration nor the policies grant access to another company's HR rows.
-- Rollback (if needed): DROP POLICY hr_platform_owner_select/insert/update ON each hr_saas_* table.
DO $hr_owner$
DECLARE
  t text;
  op text;
  predicate text;
  pname text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'hr_saas_%'
  LOOP
    IF t = 'hr_saas_workspaces' THEN
      predicate := '(owner_user_id = (select auth.uid()) and crm_workspace_id is not null and exists (select 1 from public.crm_app_workspaces c where c.id = crm_workspace_id and c.owner_user_id = (select auth.uid())) and (select public.is_super_admin()))';
    ELSE
      predicate := '(exists (select 1 from public.hr_saas_workspaces w where w.id = workspace_id and w.owner_user_id = (select auth.uid())) and (select public.is_super_admin()))';
    END IF;
    FOR op IN
      SELECT DISTINCT p.cmd FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t
        AND p.cmd IN ('SELECT', 'INSERT', 'UPDATE')
    LOOP
      pname := 'hr_platform_owner_' || lower(op);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t AND policyname = pname
      ) THEN
        IF op = 'INSERT' THEN
          EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (%s)', pname, t, predicate);
        ELSIF op = 'UPDATE' THEN
          EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', pname, t, predicate, predicate);
        ELSE
          EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (%s)', pname, t, predicate);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END
$hr_owner$;
