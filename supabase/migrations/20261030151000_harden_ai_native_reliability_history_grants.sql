-- Stage 13 recovery: enforce least-privilege ACLs for native reliability history.
-- The public schema's default privileges grant service_role broader table privileges
-- at CREATE TABLE time. Revoke them explicitly before granting the intended access.

REVOKE ALL ON TABLE public.ai_native_reliability_history
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT ON TABLE public.ai_native_reliability_history
  TO service_role;
