-- Tighten least-privilege grants for native reliability history.
-- Existing project default privileges can grant broad service_role table rights
-- at CREATE TABLE time. Revoke them explicitly, then grant only the operations
-- used by the telemetry store.

REVOKE ALL ON TABLE public.ai_native_reliability_history FROM service_role;
GRANT SELECT, INSERT ON TABLE public.ai_native_reliability_history TO service_role;

-- Keep client-facing roles explicitly denied.
REVOKE ALL ON TABLE public.ai_native_reliability_history
  FROM PUBLIC, anon, authenticated;
