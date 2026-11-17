'use strict';

const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.resolve(__dirname, '../lib/api/correspondence.js'), 'utf8');

describe('secure correspondence backend in previews', () => {
  test('missing server-only service key fails closed before any DB request', () => {
    const start = source.indexOf('async function handler(req, res) {');
    const end = source.indexOf("const url = new URL(req.url", start);
    expect(start).toBeGreaterThan(-1);
    const gate = source.slice(start, end);
    expect(gate).toContain("if (!process.env.SUPABASE_SERVICE_ROLE_KEY)");
    expect(gate).toContain("res.status(503)");
    expect(gate).toContain("CORRESPONDENCE_BACKEND_NOT_CONFIGURED");
    expect(gate.indexOf("if (!process.env.SUPABASE_SERVICE_ROLE_KEY)"))
      .toBeLessThan(gate.indexOf("getSupabase()"));
  });

  test('permissions lookup is still enforced for authenticated users', () => {
    expect(source).toContain("sb.from('correspondence_user_permissions')");
    expect(source).toContain("if (error) throw error;");
    expect(source).toContain("return new Set((data || []).map(row => row.permission)");
  });
});
