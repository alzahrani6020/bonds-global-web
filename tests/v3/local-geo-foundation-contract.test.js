const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Local geo intelligence foundation contract', () => {
  test('database foundation is spatial, private and provider-key free', () => {
    const migration = read('supabase/migrations/20261020013000_local_geo_intelligence_foundation.sql');
    expect(migration).toContain('create extension if not exists postgis');
    expect(migration).toContain('public.geo_places');
    expect(migration).toContain('public.geo_place_features');
    expect(migration).toContain('public.geo_environment_observations');
    expect(migration).toContain('using gist(location)');
    expect(migration).toContain('runtime_api_required=false');
    expect(migration).toContain('api_key_required=false');
    expect(migration).toContain("('geonames','GeoNames','download'");
    expect(migration).toContain('canonical_provider_code');
    expect(migration).toContain("('geonames_dump','GeoNames downloadable dump (legacy source code)'");
    expect(migration).toContain('revoke all on public.geo_places from anon, authenticated');
  });

  test('site intelligence route uses only local database facts and deterministic engine', () => {
    const api = read('v3/api/index.js');
    const engine = read('lib/geo/local-intelligence.js');
    expect(api).toContain("path === '/geo/site-intelligence'");
    expect(api).toContain("from('geo_places')");
    expect(api).toContain("from('geo_place_features')");
    expect(api).toContain("rpc('geo_nearest_place'");
    expect(engine).toContain("engine: 'bonds-local-geo-v1'");
    expect(engine).not.toMatch(/openai|anthropic|gemini|api[_-]?key|bearer/i);
  });
});
