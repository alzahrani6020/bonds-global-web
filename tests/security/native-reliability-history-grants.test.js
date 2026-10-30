'use strict';

const fs = require('fs');
const path = require('path');

describe('native reliability history least privilege migration', () => {
  test('service_role is explicitly reduced to SELECT and INSERT only', () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        '../../supabase/migrations/20261030152000_ai_native_reliability_history_least_privilege.sql'
      ),
      'utf8'
    );

    expect(migration).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.ai_native_reliability_history\s+FROM\s+service_role/i
    );
    expect(migration).toMatch(
      /GRANT\s+SELECT\s*,\s*INSERT\s+ON\s+TABLE\s+public\.ai_native_reliability_history\s+TO\s+service_role/i
    );
    expect(migration).toMatch(
      /REVOKE\s+ALL[\s\S]*FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i
    );
    expect(migration).not.toMatch(
      /GRANT\s+[^;]*(UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*service_role/i
    );
  });
});
