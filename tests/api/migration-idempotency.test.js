const {
  parseMigrationIdentity,
  normalizeMigrationSql,
  findEquivalentMigration,
} = require('../../lib/db/migration-idempotency');

describe('migration idempotency', () => {
  test('parses timestamped migration identity', () => {
    expect(parseMigrationIdentity('supabase/migrations/20261111233000_correspondence_command_center.sql'))
      .toEqual({ version: '20261111233000', name: 'correspondence_command_center' });
  });

  test('treats same-name migration as already applied only when SQL is identical', () => {
    const sql = 'create table if not exists public.example(id uuid);';
    const result = findEquivalentMigration([
      {
        version: '20261111214104',
        name: 'correspondence_command_center',
        statements: [sql],
      },
    ], 'supabase/migrations/20261111233000_correspondence_command_center.sql', sql);

    expect(result).toEqual({
      version: '20261111214104',
      name: 'correspondence_command_center',
    });
  });

  test('fails closed on same-version SQL collision', () => {
    expect(() => findEquivalentMigration([
      {
        version: '20261111233000',
        name: 'different_name',
        statements: ['select 1;'],
      },
    ], 'supabase/migrations/20261111233000_correspondence_command_center.sql', 'select 2;'))
      .toThrow('Migration version collision');
  });

  test('returns null for genuinely new migration', () => {
    expect(findEquivalentMigration([], 'supabase/migrations/20261111233000_correspondence_command_center.sql', 'select 1;'))
      .toBeNull();
  });

  test('normalizes CRLF and surrounding whitespace only', () => {
    expect(normalizeMigrationSql('select 1;\r\n')).toBe('select 1;');
  });
});
