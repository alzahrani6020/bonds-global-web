/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'supabase', 'migrations');
const NEW_MIGRATION = '20261027010300_assistant_rollout_readiness_access_policy.sql';
const HISTORICAL_MIGRATION = '20261022120521_assistant_audit_rollout_recovery.sql';

const REQUIRED_CONTRACT_CHECKS = [
  'audit_table',
  'audit_rls',
  'audit_events',
  'audit_append_service_only',
  'audit_no_direct_access',
  'audit_immutable',
  'idempotency_table',
  'idempotency_rls',
  'idempotency_service_only'
];

describe('assistant_rollout_readiness access-policy update', () => {
  const source = fs.readFileSync(path.join(MIGRATIONS_DIR, NEW_MIGRATION), 'utf8');

  test('redefines the same readiness RPC forward-only with schema_version 1 kept', () => {
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.assistant_rollout_readiness()');
    expect(source).toContain("'schema_version', 1");
    expect(source).toContain('SECURITY INVOKER');
  });

  test('service_role read-only policy: SELECT required, direct mutations forbidden', () => {
    expect(source).toContain("has_table_privilege('service_role', r.audit_table, 'SELECT')");
    for (const priv of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      expect(source).toContain(`'${priv}'`);
    }
    // The old blanket ban on service_role direct access is gone from the new policy
    expect(source).not.toContain("unnest(ARRAY['anon', 'authenticated', 'service_role'])");
  });

  test('client roles and PUBLIC keep zero direct access', () => {
    expect(source).toContain("unnest(ARRAY['anon', 'authenticated', 'public'])");
    expect(source).toContain('audit_no_direct_access');
    expect(source).toContain('audit_access_policy');
  });

  test('app contract keys stay satisfied so ready=true remains reachable', () => {
    for (const key of REQUIRED_CONTRACT_CHECKS) {
      expect(source).toContain(`'${key}'`);
    }
  });

  test('append RPC SECURITY DEFINER check and immutability trigger check are preserved', () => {
    expect(source).toContain('audit_append_service_only');
    expect(source).toContain('prosecdef');
    expect(source).toContain('audit_immutable');
    expect(source).toContain('trg_assistant_action_audit_immutable');
  });

  test('historical readiness migration is not rewritten', () => {
    const historical = fs.readFileSync(path.join(MIGRATIONS_DIR, HISTORICAL_MIGRATION), 'utf8');
    // The original blanket invariant (including service_role) must remain in history.
    expect(historical).toContain("unnest(ARRAY['anon', 'authenticated', 'service_role'])");
    expect(historical).toContain('audit_no_direct_access');
  });

  test('no DDL side effects beyond the function definition', () => {
    expect(source).not.toMatch(/\b(ALTER|DROP)\s+(TABLE|TRIGGER|POLICY|INDEX)/i);
    expect(source).not.toMatch(/CREATE\s+(TABLE|TRIGGER|POLICY|INDEX)/i);
  });
});
