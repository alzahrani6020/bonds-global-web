'use strict';

const fs = require('fs');
const path = require('path');

describe('F.2 access-log privilege hardening', () => {
  const sql = fs.readFileSync(
    path.join(__dirname,'..','..','supabase','migrations','20261112121500_deal_data_room_access_log_hardening.sql'),
    'utf8'
  );

  test('removes destructive service-role privileges while retaining append/read access', () => {
    expect(sql).toMatch(/revoke\s+update\s*,\s*delete\s*,\s*truncate\s+on\s+table\s+public\.bonds_deal_document_access_log\s+from\s+service_role/i);
    expect(sql).toMatch(/grant\s+select\s*,\s*insert\s+on\s+table\s+public\.bonds_deal_document_access_log\s+to\s+service_role/i);
    expect(sql).not.toMatch(/grant[^;]*\b(update|delete|truncate)\b/i);
  });
});
