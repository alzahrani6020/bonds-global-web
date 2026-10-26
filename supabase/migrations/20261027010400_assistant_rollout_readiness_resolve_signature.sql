-- Fix the assistant_resolve_idempotency signature inside assistant_rollout_readiness().
-- Forward-only; historical migrations are not modified.
--
-- Root cause: 20261027010300_assistant_rollout_readiness_access_policy.sql resolved
-- the idempotency settle RPC with a wrong 4-argument signature
-- (uuid,text,text,jsonb), so to_regprocedure() returned NULL and
-- idempotency_service_only evaluated to false, keeping
-- assistant_rollout_readiness().ready = false (ASSISTANT_DATABASE_NOT_READY).
-- The canonical 5-argument signature (uuid,text,text,text,jsonb) is defined and
-- granted by 20261022135500_assistant_action_idempotency.sql and was already the
-- form used by 20261022120521_assistant_audit_rollout_recovery.sql.
--
-- Change: exactly one line — resolve_rpc now resolves the correct
-- 5-argument procedure. Everything else in the readiness contract (access
-- policy checks, schema_version = 1, response shape, SECURITY INVOKER,
-- search_path, grants/revokes) is unchanged.

CREATE OR REPLACE FUNCTION public.assistant_rollout_readiness()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $readiness$
  WITH refs AS (
    SELECT
      to_regclass('public.assistant_action_audit') AS audit_table,
      to_regclass('public.assistant_action_idempotency') AS idempotency_table,
      to_regprocedure('public.assistant_append_action_audit(uuid,text,text,text,text,text,text,text,text,boolean,text,text,jsonb)') AS append_rpc,
      to_regprocedure('public.assistant_claim_idempotency(uuid,text,text,text,text)') AS claim_rpc,
      to_regprocedure('public.assistant_resolve_idempotency(uuid,text,text,text,jsonb)') AS resolve_rpc,
      to_regprocedure('public.reject_assistant_action_audit_mutation()') AS immutable_function
  ), invariants AS (
    SELECT jsonb_build_object(
      'audit_table', r.audit_table IS NOT NULL,
      'audit_rls', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = r.audit_table), false),
      'audit_events', EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = r.audit_table
          AND c.conname = 'assistant_action_audit_event_type_check'
          AND c.contype = 'c' AND c.convalidated
          AND ARRAY(
            SELECT match[1]
            FROM regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS match
          ) @> ARRAY[
            'planned', 'confirmation_prepared', 'confirmation_resolved',
            'idempotency_claimed', 'replayed', 'write_succeeded', 'write_uncertain',
            'denied', 'failed', 'execution_started', 'execution_succeeded',
            'execution_failed', 'execution_denied'
          ]::text[]
      ),
      'audit_append_service_only', COALESCE(
        has_function_privilege('service_role', r.append_rpc, 'EXECUTE')
        AND NOT has_function_privilege('anon', r.append_rpc, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', r.append_rpc, 'EXECUTE')
        AND (SELECT prosecdef FROM pg_proc WHERE oid = r.append_rpc), false
      ),
      'audit_no_direct_access', r.audit_table IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM unnest(ARRAY['anon', 'authenticated', 'public']) AS role_name
        WHERE has_table_privilege(role_name, r.audit_table,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      ),
      'audit_access_policy', r.audit_table IS NOT NULL
        AND has_table_privilege('service_role', r.audit_table, 'SELECT')
        AND NOT EXISTS (
          SELECT 1 FROM unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS mutation_privilege
          WHERE has_table_privilege('service_role', r.audit_table, mutation_privilege)
        ),
      'audit_immutable', EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = r.audit_table
          AND t.tgname = 'trg_assistant_action_audit_immutable'
          AND NOT t.tgisinternal AND t.tgenabled IN ('O', 'A')
          AND t.tgtype = 27 AND t.tgfoid = r.immutable_function
      ),
      'idempotency_table', r.idempotency_table IS NOT NULL,
      'idempotency_rls', COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = r.idempotency_table), false),
      'idempotency_service_only', COALESCE(
        has_function_privilege('service_role', r.claim_rpc, 'EXECUTE')
        AND has_function_privilege('service_role', r.resolve_rpc, 'EXECUTE')
        AND NOT has_function_privilege('anon', r.claim_rpc, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', r.claim_rpc, 'EXECUTE')
        AND NOT has_function_privilege('anon', r.resolve_rpc, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', r.resolve_rpc, 'EXECUTE')
        AND NOT has_table_privilege('anon', r.idempotency_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
        AND NOT has_table_privilege('authenticated', r.idempotency_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'), false
      )
    ) AS checks FROM refs r
  )
  SELECT jsonb_build_object(
    'schema_version', 1,
    'ready', (SELECT bool_and(value = 'true'::jsonb) FROM jsonb_each(i.checks)),
    'checks', i.checks
  ) FROM invariants i;
$readiness$;

REVOKE ALL ON FUNCTION public.assistant_rollout_readiness() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_rollout_readiness() TO service_role;
COMMENT ON FUNCTION public.assistant_rollout_readiness() IS
  'Read-only Assistant rollout schema readiness; no customer data or authorization decisions.';
