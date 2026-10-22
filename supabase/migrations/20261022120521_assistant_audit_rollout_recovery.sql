-- Forward recovery for the audit schema originally applied by PR #369.
-- PR #371 changed an existing migration, so the immutable-migration guard
-- correctly refused to apply it. Do not rerun or modify that historical file.
-- Apply this file to the existing production schema via Apply Supabase Migrations.
-- No audit rows are rewritten/deleted and no authorization/AI/API policy changes.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.assistant_action_audit
  DROP CONSTRAINT assistant_action_audit_event_type_check;
ALTER TABLE public.assistant_action_audit
  ADD CONSTRAINT assistant_action_audit_event_type_check CHECK (
    event_type IN (
      'planned', 'confirmation_prepared', 'confirmation_resolved',
      'idempotency_claimed', 'replayed', 'write_succeeded', 'write_uncertain',
      'denied', 'failed', 'execution_started', 'execution_succeeded',
      'execution_failed', 'execution_denied'
    )
  );

ALTER TABLE public.assistant_action_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_action_audit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assistant_append_action_audit(
  uuid,text,text,text,text,text,text,text,text,boolean,text,text,jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_append_action_audit(
  uuid,text,text,text,text,text,text,text,text,boolean,text,text,jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_assistant_action_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $immutable$
BEGIN
  RAISE EXCEPTION 'ASSISTANT_AUDIT_IMMUTABLE';
END;
$immutable$;

REVOKE ALL ON FUNCTION public.reject_assistant_action_audit_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_assistant_action_audit_immutable
BEFORE UPDATE OR DELETE ON public.assistant_action_audit
FOR EACH ROW EXECUTE FUNCTION public.reject_assistant_action_audit_mutation();

-- Read-only catalog inspection for the strict deployment-readiness gate.
-- SECURITY INVOKER is sufficient: this reads no application/customer records.
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
        SELECT 1 FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS role_name
        WHERE has_table_privilege(role_name, r.audit_table,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
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

NOTIFY pgrst, 'reload schema';
