const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

const LEGACY_DUPLICATES = {
  '20260730000000': [
    '20260730000000_profile_completeness.sql',
    '20260730000000_security_hardening_indexes_and_search_path.sql'
  ],
  '20260731000000': [
    '20260731000000_admin_audit_log.sql',
    '20260731000000_soft_lead_contact_validation.sql'
  ]
};

describe('Supabase migration integrity', () => {
  test('no new duplicate migration timestamps are introduced', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(name => /^\d{14}_.+\.sql$/.test(name));

    const byTimestamp = new Map();

    for (const file of files) {
      const timestamp = file.slice(0, 14);

      if (!byTimestamp.has(timestamp)) {
        byTimestamp.set(timestamp, []);
      }

      byTimestamp.get(timestamp).push(file);
    }

    const unexpected = [];

    for (const [timestamp, names] of byTimestamp.entries()) {
      if (names.length <= 1) continue;

      const actual = [...names].sort();
      const allowed = LEGACY_DUPLICATES[timestamp]
        ? [...LEGACY_DUPLICATES[timestamp]].sort()
        : null;

      if (
        !allowed ||
        JSON.stringify(actual) !== JSON.stringify(allowed)
      ) {
        unexpected.push({
          timestamp,
          files: actual
        });
      }
    }

    expect(unexpected).toEqual([]);
  });

  test('known legacy duplicate timestamps remain unchanged', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);

    for (const [timestamp, expectedFiles] of Object.entries(LEGACY_DUPLICATES)) {
      const actual = files
        .filter(name => name.startsWith(`${timestamp}_`) && name.endsWith('.sql'))
        .sort();

      expect(actual).toEqual([...expectedFiles].sort());
    }
  });

  test('rollback SQL files are not stored in migrations directory', () => {
    const rollbackFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(name => /rollback/i.test(name));

    expect(rollbackFiles).toEqual([]);
  });
});
