-- Tighten least-privilege grants for persistent AI model lifecycle state.
-- Runtime state persistence needs only SELECT, INSERT and UPDATE.
-- Keep client-facing roles explicitly denied.

REVOKE ALL ON TABLE public.ai_model_lifecycle_state FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_model_lifecycle_state TO service_role;

REVOKE ALL ON TABLE public.ai_model_lifecycle_state
  FROM PUBLIC, anon, authenticated;
