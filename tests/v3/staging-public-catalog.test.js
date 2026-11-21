'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

describe('Staging public catalog access without privileged credentials', () => {
  const api = read('v3/api/index.js');
  const client = read('v3/lib/supabase.js');
  test('public country activity and city catalogs use an RLS-constrained publishable client', () => {
    for (const handler of ['handleCatalogCountries', 'handleCatalogActivities', 'handleCatalogCities']) {
      const begin = api.indexOf('async function ' + handler + '(');
      expect(begin).toBeGreaterThan(-1);
      const next = api.indexOf('\nasync function ', begin + 12);
      const body = api.slice(begin, next < 0 ? api.length : next);
      expect(body).toContain('getPublicCatalogClient()');
      expect(body).not.toContain('getSupabaseClient()');
    }
  });
  test('public catalog client never reads a service-role credential', () => {
    const begin = client.indexOf('function getPublicCatalogClient()');
    expect(begin).toBeGreaterThan(-1);
    const body = client.slice(begin, client.indexOf('\nmodule.exports', begin));
    expect(body).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(body).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(body).toContain('persistSession: false');
    expect(client).toContain('getSupabaseClient, getPublicCatalogClient');
  });
  test('other privileged API handlers remain on their original access path', () => {
    expect(client).toContain('function getSupabaseClient()');
    expect(api).toContain('const supabase = getSupabaseClient()');
  });
});
