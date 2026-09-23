const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

describe('Moyasar invoices RLS hardening', () => {
  test('removes broad PUBLIC full-access policy', () => {
    const file = fs.readFileSync(
      path.join(
        ROOT,
        'supabase/migrations/20260923030000_harden_moyasar_invoices_rls.sql'
      ),
      'utf8'
    );

    expect(file).toContain(
      'DROP POLICY IF EXISTS "Service role can manage all moyasar invoices"'
    );

    expect(file).toContain('TO authenticated');
    expect(file).toContain('USING (auth.uid() = user_id)');

    expect(file).not.toMatch(
      /CREATE POLICY[\s\S]*FOR ALL[\s\S]*TO PUBLIC[\s\S]*USING\s*\(\s*true\s*\)/i
    );

    expect(file).toContain(
      'REVOKE ALL ON TABLE public.moyasar_invoices FROM anon'
    );
  });
});
