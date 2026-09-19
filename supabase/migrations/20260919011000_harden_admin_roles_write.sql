-- Security hardening for admin_roles write access.
-- Preserve existing read behaviour.
-- Only the currently authenticated super_admin may change role assignments.
-- Idempotent and safe to re-run.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
$$;

-- SECURITY DEFINER functions must not remain executable by PUBLIC.
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

-- Remove the historical broad FOR ALL policy.
DROP POLICY IF EXISTS "admin_roles_write" ON public.admin_roles;

-- Remove any previous corrective policies before recreating them.
DROP POLICY IF EXISTS "admin_roles_insert_super_admin" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_update_super_admin" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_delete_super_admin" ON public.admin_roles;

CREATE POLICY "admin_roles_insert_super_admin"
ON public.admin_roles
FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_roles_update_super_admin"
ON public.admin_roles
FOR UPDATE TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_roles_delete_super_admin"
ON public.admin_roles
FOR DELETE TO authenticated
USING (public.is_super_admin());
