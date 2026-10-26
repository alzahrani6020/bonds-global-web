/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'supabase', 'migrations');
const PREVIOUS_MIGRATION = '20261027010300_assistant_rollout_readiness_access_policy.sql';
const NEW_MIGRATION = '20261027010400_assistant_rollout_readiness_resolve_signature.sql';
const WRONG_SIGNATURE = 'public.assistant_resolve_idempotency(uuid,text,text,jsonb)';
const CORRECT_SIGNATURE = 'public.assistant_resolve_idempotency(uuid,text,text,text,jsonb)';

function functionBody(source) {
  const start = source.indexOf('AS $readiness$');
  const end = source.indexOf('$readiness$;', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end).split('\n').map((line) => line.trim());
}

describe('assistant_rollout_readiness resolve_rpc signature fix', () => {
  const newSource = fs.readFileSync(path.join(MIGRATIONS_DIR, NEW_MIGRATION), 'utf8');
  const prevSource = fs.readFileSync(path.join(MIGRATIONS_DIR, PREVIOUS_MIGRATION), 'utf8');

  test('new migration resolves the correct 5-argument signature, never the wrong 4-argument one', () => {
    expect(newSource).toContain(CORRECT_SIGNATURE);
    expect(newSource).not.toContain(WRONG_SIGNATURE);
  });

  test('the only functional change versus the previous definition is the signature line', () => {
    const previousBody = functionBody(prevSource);
    const newBody = functionBody(newSource);

    expect(newBody.length).toBe(previousBody.length);
    const differing = newBody.filter((line, index) => line !== previousBody[index]);
    expect(differing).toHaveLength(1);
    expect(differing[0]).toContain(CORRECT_SIGNATURE);
    expect(differing[0]).toContain('AS resolve_rpc');
  });

  test('idempotency_service_only still gates on claim and resolve EXECUTE with client-role denial', () => {
    expect(newSource).toContain('idempotency_service_only');
    expect(newSource).toContain("has_function_privilege('service_role', r.claim_rpc, 'EXECUTE')");
    expect(newSource).toContain("has_function_privilege('service_role', r.resolve_rpc, 'EXECUTE')");
    expect(newSource).toContain("NOT has_function_privilege('anon', r.resolve_rpc, 'EXECUTE')");
    expect(newSource).toContain("NOT has_function_privilege('authenticated', r.resolve_rpc, 'EXECUTE')");
    expect(newSource).toContain("NOT has_table_privilege('anon', r.idempotency_table");
    expect(newSource).toContain("NOT has_table_privilege('authenticated', r.idempotency_table");
  });

  test('readiness contract and access-policy checks are unchanged', () => {
    for (const key of [
      'audit_access_policy',
      'audit_no_direct_access',
      'audit_append_service_only',
      'audit_rls',
      'audit_immutable',
      'audit_events'
    ]) {
      expect(newSource).toContain(`'${key}'`);
    }
    expect(newSource).toContain("'schema_version', 1");
    expect(newSource).toContain('SECURITY INVOKER');
  });

  test('readiness RPC stays executable by service_role only', () => {
    expect(newSource).toContain(
      'REVOKE ALL ON FUNCTION public.assistant_rollout_readiness() FROM PUBLIC, anon, authenticated;'
    );
    expect(newSource).toContain(
      'GRANT EXECUTE ON FUNCTION public.assistant_rollout_readiness() TO service_role;'
    );
  });

  test('historical migrations keep their content (no rewrite)', () => {
    const historical = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261022120521_assistant_audit_rollout_recovery.sql'),
      'utf8'
    );
    expect(historical).toContain(CORRECT_SIGNATURE);
  });
});
