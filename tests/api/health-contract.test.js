const fs = require('fs');
const path = require('path');

const health = fs.readFileSync(path.join(__dirname, '../../api/health.js'), 'utf8');
const supabase = fs.readFileSync(path.join(__dirname, '../../lib/api/supabase.js'), 'utf8');

describe('production health contract', () => {
  test('health endpoint uses the repository Supabase factory correctly', () => {
    expect(supabase).toContain('module.exports = function getSupabase()');
    expect(health).toContain("const getSupabase = require('../lib/api/supabase')");
    expect(health).toContain('const supabase = getSupabase()');
    expect(health).not.toContain("const { createClient } = require('../lib/api/supabase')");
  });

  test('health endpoint cannot report OK when Supabase is unavailable', () => {
    expect(health).toContain("const healthy = supabaseStatus === 'ok'");
    expect(health).toContain("status: healthy ? 'ok' : 'degraded'");
    expect(health).toContain('res.status(healthy ? 200 : 503)');
  });
});
