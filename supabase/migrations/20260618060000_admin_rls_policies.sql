-- Migration: Admin RLS policies for API fallback (when service_role key is not available)
-- Allows verified admins to read/manage core tables using the anon key + JWT.

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE admin_roles.user_id = user_uuid
      AND admin_roles.role IN ('super_admin','admin','support')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_roles: read own row or all if admin; write only for super_admin/admin
DROP POLICY IF EXISTS "admin_roles_select" ON public.admin_roles;
CREATE POLICY "admin_roles_select" ON public.admin_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_roles_write" ON public.admin_roles;
CREATE POLICY "admin_roles_write" ON public.admin_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;
CREATE POLICY "admin_delete_profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- subscriptions
DROP POLICY IF EXISTS "admin_read_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_read_subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- scenarios
DROP POLICY IF EXISTS "admin_read_scenarios" ON public.scenarios;
CREATE POLICY "admin_read_scenarios" ON public.scenarios
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- contact_messages
DROP POLICY IF EXISTS "admin_read_messages" ON public.contact_messages;
CREATE POLICY "admin_read_messages" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_write_messages" ON public.contact_messages;
CREATE POLICY "admin_write_messages" ON public.contact_messages
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- bank_transfer_requests
DROP POLICY IF EXISTS "admin_read_transfers" ON public.bank_transfer_requests;
CREATE POLICY "admin_read_transfers" ON public.bank_transfer_requests
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_write_transfers" ON public.bank_transfer_requests;
CREATE POLICY "admin_write_transfers" ON public.bank_transfer_requests
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- site_settings
DROP POLICY IF EXISTS "admin_read_settings" ON public.site_settings;
CREATE POLICY "admin_read_settings" ON public.site_settings
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_write_settings" ON public.site_settings;
CREATE POLICY "admin_write_settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- usage_exceptions
DROP POLICY IF EXISTS "admin_read_exceptions" ON public.usage_exceptions;
CREATE POLICY "admin_read_exceptions" ON public.usage_exceptions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_write_exceptions" ON public.usage_exceptions;
CREATE POLICY "admin_write_exceptions" ON public.usage_exceptions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
