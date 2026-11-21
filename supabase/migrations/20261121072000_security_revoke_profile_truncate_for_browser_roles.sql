-- Production security hardening: public.profiles has RLS, but TRUNCATE bypasses RLS.
-- Preserve SELECT/INSERT/UPDATE/DELETE and privileged service-role access.
DO $security$
BEGIN
 IF to_regclass('public.profiles') IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
  REVOKE TRUNCATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
 END IF;
END
$security$;
