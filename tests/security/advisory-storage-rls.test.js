const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const MIGRATION = path.join(
  ROOT,
  'supabase/migrations/20260923050000_harden_advisory_storage_policies.sql'
);

describe('advisory storage RLS hardening', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');

  test('advisory documents require advisory authorization', () => {
    for (const action of ['select', 'insert', 'delete']) {
      expect(sql).toContain(`CREATE POLICY "advisory_storage_${action}"`);
    }

    expect(sql).toMatch(
      /bucket_id = 'advisory-documents'[\s\S]*public\.is_advisory_user\(\)/i
    );
  });

  test('advisory reports require advisory authorization', () => {
    for (const action of ['select', 'insert', 'delete']) {
      expect(sql).toContain(
        `CREATE POLICY "advisory_reports_storage_${action}"`
      );
    }

    expect(sql).toMatch(
      /bucket_id = 'advisory-reports'[\s\S]*public\.is_advisory_user\(\)/i
    );
  });

  test('migration does not alter shared storage table grants', () => {
    expect(sql).not.toMatch(
      /\b(REVOKE|GRANT)\b[\s\S]*\bstorage\.objects\b/i
    );
  });

  test('authenticated access is never bucket-only', () => {
    expect(sql).not.toMatch(
      /USING\s*\(\s*bucket_id\s*=\s*'advisory-(documents|reports)'\s*\)/i
    );
    expect(sql).not.toMatch(
      /WITH CHECK\s*\(\s*bucket_id\s*=\s*'advisory-(documents|reports)'\s*\)/i
    );
  });
});
