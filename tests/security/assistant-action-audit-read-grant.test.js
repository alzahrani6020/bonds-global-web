/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'supabase', 'migrations');
const NEW_MIGRATION = '20261027010200_assistant_action_audit_service_role_read.sql';

const TABLE_GRANT_RE = /GRANT\s+([A-Z]+(?:\s*,\s*[A-Z]+)*)\s+ON\s+(?:TABLE\s+)?public\.assistant_action_audit\s+TO\s+([^;]+);/gi;

function tableGrants(source) {
  const out = [];
  let match;
  while ((match = TABLE_GRANT_RE.exec(source)) !== null) {
    out.push({
      privileges: match[1].split(',').map((p) => p.trim()),
      roles: match[2].split(',').map((r) => r.trim())
    });
  }
  return out;
}

describe('assistant_action_audit service-role read grant', () => {
  test('new forward-only migration grants SELECT to service_role only', () => {
    const file = path.join(MIGRATIONS_DIR, NEW_MIGRATION);
    expect(fs.existsSync(file)).toBe(true);

    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain(
      'GRANT SELECT ON public.assistant_action_audit TO service_role;'
    );

    const grants = tableGrants(source);
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      for (const role of grant.roles) {
        expect(['service_role']).toContain(role);
      }
    }

    // No DDL side effects: the migration must not touch RLS, triggers,
    // functions, policies or indexes.
    expect(source).not.toMatch(/\b(ALTER|DROP|CREATE)\s+(TABLE|TRIGGER|FUNCTION|POLICY|INDEX)/i);
  });

  test('no migration grants table access to PUBLIC, anon or authenticated', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    for (const file of files) {
      const source = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      if (!source.includes('assistant_action_audit')) continue;
      for (const grant of tableGrants(source)) {
        for (const role of grant.roles) {
          expect(['service_role']).toContain(role);
        }
      }
    }
  });

  test('historical migration keeps its REVOKE intact and is not rewritten', () => {
    const historical = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261022143000_assistant_action_audit.sql'),
      'utf8'
    );
    expect(historical).toContain(
      'REVOKE ALL ON public.assistant_action_audit FROM PUBLIC, anon, authenticated, service_role;'
    );
    expect(historical).not.toContain('GRANT SELECT ON public.assistant_action_audit');
  });
});
