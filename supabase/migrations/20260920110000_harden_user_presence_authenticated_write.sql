-- Complete user_presence write hardening.
-- Presence writes are server-side only via service_role.

REVOKE INSERT, UPDATE
ON TABLE public.user_presence
FROM authenticated;
