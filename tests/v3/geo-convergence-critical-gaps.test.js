const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Geo convergence critical gaps', () => {
  test('legacy cities are explicitly bridged to canonical geo identity', () => {
    const migration = read('supabase/migrations/20261020033500_geo_convergence_bridge.sql');
    expect(migration).toContain('alter table public.cities add column if not exists geo_place_id uuid');
    expect(migration).toContain('foreign key (geo_place_id) references public.geo_places(id)');
    expect(migration).toContain('trg_cities_sync_geo_place');
    expect(migration).toContain('private.sync_city_to_geo_place');
    expect(migration).toContain('geo_place_source_links');
  });

  test('service requests persist a canonical geo snapshot without replacing legacy location fields', () => {
    const api = read('v3/api/services.js');
    expect(api).toContain("require('../../lib/geo/resolve-context')");
    expect(api).toContain('geo_place_id: geoContext.place?.id || null');
    expect(api).toContain('geo_snapshot: geoContext.snapshot || {}');
    expect(api).toContain('locality_code: body.locality_code || null');
    expect(api).toContain('locality_name: body.locality_name || null');
  });

  test('projects retain city_id compatibility while persisting canonical geo identity', () => {
    const api = read('v3/api/projects.js');
    expect(api).toContain('city_id: cityContext.cityId');
    expect(api).toContain('geo_place_id: cityContext.geoPlaceId');
    expect(api).toContain('geo_snapshot: cityContext.geoSnapshot');
    expect(api).toContain('city_id, geo_place_id, geo_snapshot');
  });

  test('geo resolution fails closed on ambiguous exact-name matches', () => {
    const resolver = read('lib/geo/resolve-context.js');
    expect(resolver).toContain("reason: 'multiple_exact_name_matches'");
    expect(resolver).toContain('ambiguous: true');
    expect(resolver).toContain("resolved_from: 'canonical_code'");
    expect(resolver).toContain("resolved_from: 'cities.geo_place_id'");
  });
  test('new canonical place promotion is blocked until admin hierarchy exists', () => {
    const promote = read('scripts/promote-local-geo-run.js');
    expect(promote).toContain('Promotion blocked: canonical admin hierarchy is not ready for');
    expect(promote).toContain('public.geo_admin_areas');
    expect(promote).toContain("row.decision === 'new_canonical'");
  });

});
