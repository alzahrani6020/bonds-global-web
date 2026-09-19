-- Security hardening for user_presence.
-- Presence writes are performed by server-side APIs using service_role.
-- Anonymous clients must not be able to directly insert or update presence rows.

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Remove historical anonymous write policies.
DROP POLICY IF EXISTS "Allow anonymous presence inserts"
ON public.user_presence;

DROP POLICY IF EXISTS "Allow anonymous presence updates"
ON public.user_presence;

-- Remove direct anonymous table write privileges.
REVOKE INSERT, UPDATE
ON TABLE public.user_presence
FROM anon;

-- Explicit service-role policy for server-side presence management.
DROP POLICY IF EXISTS user_presence_service_all
ON public.user_presence;

CREATE POLICY user_presence_service_all
ON public.user_presence
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
