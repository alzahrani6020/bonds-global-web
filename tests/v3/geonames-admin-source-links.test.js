const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('GeoNames ADM1 provider source links', () => {
  test('admin provider identities are separated from canonical admin identity', () => {
    const sql = read('supabase/migrations/20261020042000_geo_admin_source_links.sql');
    expect(sql).toContain('public.geo_admin_area_source_links');
    expect(sql).toContain('admin_area_id uuid not null references public.geo_admin_areas(id)');
    expect(sql).toContain('unique(source_code,country_code,admin_level,source_admin_code)');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on public.geo_admin_area_source_links from anon,authenticated');
  });

  test('local linker requires dump files and never calls a provider API', () => {
    const script = read('scripts/link-local-geonames-admin1.js');
    expect(script).toContain('.tmp-geo');
    expect(script).toContain('admin1CodesASCII.txt');
    expect(script).toContain('alternateNames.txt');
    expect(script).toContain('runtime_api_required: false');
    expect(script).toContain('api_key_required: false');
    expect(script).not.toMatch(/fetch\s*\(/);
    expect(script).not.toMatch(/axios|https?:\/\//i);
  });

  test('local linker inserts only deterministic one-to-one matches and emits review output', () => {
    const script = read('scripts/link-local-geonames-admin1.js');
    expect(script).toContain("matches.length === 1");
    expect(script).toContain("status: matches.length ? 'ambiguous' : 'unresolved'");
    expect(script).toContain('geonames-admin1-review.json');
    expect(script).toContain('if (review.length) process.exitCode = 3');
  });

  test('promotion resolves ADM1 by provider link instead of assuming internal indexes equal provider codes', () => {
    const promote = read('scripts/promote-local-geo-run.js');
    expect(promote).toContain('public.geo_admin_area_source_links');
    expect(promote).toContain("row.source_code + ':' + row.country_code + ':' + row.admin1_code");
    expect(promote).toContain('Promotion blocked: unresolved provider ADM1 source mapping for');
    expect(promote).not.toContain("area.country_code + ':' + area.source_code + ':' + area.source_id");
  });

  test('package exposes an explicit local ADM1 link step', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['geo:link-admin1']).toBe('node scripts/link-local-geonames-admin1.js');
  });
});
