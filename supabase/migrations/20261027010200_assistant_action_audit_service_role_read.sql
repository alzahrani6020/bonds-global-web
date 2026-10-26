-- Grant SELECT on the immutable assistant audit trail to the server-side service role only.
-- Forward-only corrective grant; historical migrations are not modified.
--
-- Root cause: assistant_action_audit is written exclusively through the
-- SECURITY DEFINER append RPC, while the admin read surfaces (audit-search,
-- operational-replay, anomaly-detection, operational-dashboard) query the
-- table directly with the service role. The original migrations revoked ALL
-- privileges (including SELECT) from service_role without re-granting reads,
-- so every read path failed at runtime with Postgres 42501.
--
-- Scope: read access for the server-side service role only. PUBLIC, anon and
-- authenticated stay fully revoked. RLS, the immutability trigger, the append
-- RPC, and all authorization policies are untouched.

GRANT SELECT ON public.assistant_action_audit TO service_role;
