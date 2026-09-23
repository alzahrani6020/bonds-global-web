const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20260923040000_harden_public_lead_tables_rls.sql'
);

describe('public lead tables RLS hardening', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');

  test('removes broad browser-access policies', () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Service role can manage bank partner requests"'
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Service role can manage funding readiness leads"'
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "bank_partner_requests_anon_insert"'
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "funding_readiness_leads_anon_insert"'
    );
  });

  test('browser roles have no table privileges', () => {
    for (const table of [
      'bank_partner_requests',
      'funding_readiness_leads'
    ]) {
      expect(sql).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM anon`
      );
      expect(sql).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM authenticated`
      );
    }

    expect(sql).not.toMatch(
      /GRANT\s+(SELECT|INSERT|UPDATE|DELETE)[\s\S]*\sTO\s+(anon|authenticated)/i
    );
  });

  test('service role retains server-side CRUD access', () => {
    for (const table of [
      'bank_partner_requests',
      'funding_readiness_leads'
    ]) {
      expect(sql).toContain(
        `ON TABLE public.${table}\n  TO service_role`
      );
    }
  });

  test('RLS is forced on both lead tables', () => {
    expect(sql).toContain(
      'ALTER TABLE public.bank_partner_requests FORCE ROW LEVEL SECURITY'
    );
    expect(sql).toContain(
      'ALTER TABLE public.funding_readiness_leads FORCE ROW LEVEL SECURITY'
    );
  });
});
