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
  test('promotion is fail-closed on unresolved review or incomplete admin hierarchy', () => {
    const promote = read('scripts/promote-local-geo-run.js');
    expect(promote).toContain('Promotion blocked: unresolved review candidates remain');
    expect(promote).toContain('Promotion blocked: canonical admin hierarchy is not ready for');
    expect(promote).toContain('Promotion blocked: unresolved admin1 mapping for');
    expect(promote).toContain('public.geo_admin_areas');
    expect(promote).toContain('admin1For(row)');
    expect(promote).toContain("row.decision === 'new_canonical'");
  });

  test('matched source enrichment fills missing canonical facts without overwriting curated values', () => {
    const promote = read('scripts/promote-local-geo-run.js');
    expect(promote).toContain('population=coalesce(population,$4)');
    expect(promote).toContain('elevation_m=coalesce(elevation_m,$5)');
    expect(promote).toContain('case when lat is null and lng is null');
    expect(promote).toContain('last_enrichment_source');
  });

  test('city administration uses soft disable so canonical identity is not orphaned', () => {
    const service = read('admin/city-intelligence/service.js');
    expect(service).toContain("update({ is_active: false, status: 'inactive'");
    expect(service).not.toContain("from('cities').delete().eq('id', id)");
  });

  test('existing city catalog can surface canonical supplemental places without a second UI stack', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain(".from('geo_places')");
    expect(api).toContain("catalog_source: 'geo_places'");
    expect(api).toContain('linkedGeoIds');
    expect(api).toContain("if (!countryCode) return legacyRows || []");
  });

  test('database boundary rebuilds geo snapshots and rejects inconsistent references', () => {
    const migration = read('supabase/migrations/20261020033500_geo_convergence_bridge.sql');
    expect(migration).toContain('private.enforce_service_request_geo');
    expect(migration).toContain("raise exception 'geo_place_id country mismatch'");
    expect(migration).toContain('private.enforce_project_geo');
    expect(migration).toContain("raise exception 'city_id and geo_place_id mismatch'");
    expect(migration).toContain("new.geo_snapshot := jsonb_strip_nulls");
  });

  test('existing data quality center detects geo integrity failures', () => {
    const migration = read('supabase/migrations/20261020033500_geo_convergence_bridge.sql');
    const app = read('admin/data-quality-center/app.js');
    expect(migration).toContain('public.dq_find_geo_integrity');
    expect(migration).toContain("'geo_integrity','city'");
    expect(migration).toContain("'geo_integrity','service_request'");
    expect(migration).toContain("'geo_integrity','geo_ingest_run'");
    expect(migration).toContain("'geo_integrity',v_geo");
    expect(app).toContain("geo_integrity: 'سلامة الجغرافيا'");
    expect(app).toContain('value="geo_integrity"');
  });

  test('soft-disabled cities are excluded from public catalog APIs', () => {
    const api = read('v3/api/index.js');
    const activeFilters = (api.match(/\.eq\('is_active', true\)/g) || []).length;
    expect(activeFilters).toBeGreaterThanOrEqual(2);
  });

  test('legacy aliases can converge onto one canonical place through provenance links', () => {
    const migration = read('supabase/migrations/20261020033500_geo_convergence_bridge.sql');
    expect(migration).toContain('create index if not exists idx_cities_geo_place_id');
    expect(migration).not.toContain('create unique index if not exists uq_cities_geo_place_id');
    expect(migration).toContain('from public.geo_place_source_links l');
    expect(migration).toContain("l.source_code='bonds_legacy'");
  });

  test('legacy alias updates cannot overwrite canonical place facts', () => {
    const migration = read('supabase/migrations/20261020033500_geo_convergence_bridge.sql');
    expect(migration).toContain('v_is_alias boolean := false');
    expect(migration).toContain('if not coalesce(v_is_alias,false) then');
    expect(migration).toContain("'last_legacy_alias_code',new.code");
  });

  test('new canonical geo identity is provider-independent', () => {
    const promote = read('scripts/promote-local-geo-run.js');
    expect(promote).toContain("const { randomUUID } = require('crypto')");
    expect(promote).toContain("'BG-' + row.country_code");
    expect(promote).not.toContain("'SRC-' + row.source_code + '-' + row.source_id");
    expect(promote).toContain('geo_place_source_links');
  });

  test('geo discoverability is not mislabeled as city evidence availability', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain("data_available: city.catalog_source === 'geo_places' ? false : true");
    expect(api).toContain('geo_available: Boolean(city.geo_place_id)');
  });

});
