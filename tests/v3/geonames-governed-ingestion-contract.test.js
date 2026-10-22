const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('GeoNames governed ingestion contract', () => {
  test('locality source identity matches canonical ADM1 provider identity', () => {
    const build = read('scripts/build-local-geo-dataset.js');
    const stage = read('scripts/stage-local-geo-dataset.js');
    const admin = read('scripts/link-local-geonames-admin1.js');

    expect(build).toContain("source_code: 'geonames'");
    expect(stage).toContain("const SOURCE_CODE = process.env.GEO_SOURCE_CODE || 'geonames'");
    expect(admin).toContain("const SOURCE_CODE = 'geonames'");
  });

  test('production ingestion separates stage/reconcile from promotion', () => {
    const workflow = read('.github/workflows/geonames-governed-ingestion.yml');

    expect(workflow).toContain('stage_reconcile');
    expect(workflow).toContain('Promotion is intentionally NOT automatic.');
    expect(workflow).toContain('confirmation must be PROMOTE');
    expect(workflow).toContain('confirmation must be ROLLBACK');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('GEO_DATABASE_URL');
  });

  test('database connection can fall back to masked Vercel Production env without logging secrets', () => {
    const workflow = read('.github/workflows/geonames-governed-ingestion.yml');

    expect(workflow).toContain('VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}');
    expect(workflow).toContain('VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}');
    expect(workflow).toContain('VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}');
    expect(workflow).toContain('vercel pull --yes --environment=production');
    expect(workflow).not.toContain('--scope "$VERCEL_ORG_ID"');
    expect(workflow).toContain('SUPABASE_DB_URL');
    expect(workflow).toContain('::add-mask::');
    expect(workflow).toContain('DATABASE_URL<<__GEO_DB_URL__');
    expect(workflow).toContain('rm -rf .vercel');
    expect(workflow).not.toContain('cat .vercel/.env.production.local');
  });

  test('promotion and rollback remain guarded by explicit apply flags', () => {
    const workflow = read('.github/workflows/geonames-governed-ingestion.yml');

    expect(workflow).toContain("GEO_PROMOTE_APPLY: '1'");
    expect(workflow).toContain("GEO_ROLLBACK_APPLY: '1'");
    expect(workflow).toContain("GEO_STAGE_APPLY: '1'");
    expect(workflow).toContain("GEO_RECONCILE_APPLY: '1'");
  });

  test('safe candidate subset is mandatory before staging', () => {
    const workflow = read('.github/workflows/geonames-governed-ingestion.yml');
    const filter = read('scripts/filter-geonames-safe-candidates.js');

    expect(workflow).toContain('export-production-cities-for-geonames.js');
    expect(workflow).toContain('--output .tmp-geo/current-cities.json');
    expect(workflow).not.toContain('/api/v3/cities?limit=2000');
    expect(workflow).toContain('filter-geonames-safe-candidates.js');
    expect(workflow).toContain('--max-rows 5000');
    expect(workflow).toContain('test "$SAFE_ROWS" -gt 0');
    expect(workflow).toContain('test "$SAFE_ROWS" -le 5000');
    expect(workflow).toContain('test "$SAFE_ROWS" -lt "$SOURCE_ROWS"');
    expect(workflow).toContain('sha256sum .tmp-geo/geonames-safe-candidates.ndjson > .tmp-geo/geonames-safe-candidates.sha256');
    expect(workflow).toContain('stage-local-geo-dataset.js .tmp-geo/geonames-safe-candidates.ndjson');
    expect(workflow).not.toContain('node scripts/stage-local-geo-dataset.js | tee .tmp-geo/stage.log');
    expect(filter).toContain('direct canonical names only; unique source key; unique production city');
    expect(filter).not.toContain('row.aliases');
  });

  test('production city export is read-only and uncapped by the public API', () => {
    const exporter = read('scripts/export-production-cities-for-geonames.js');

    expect(exporter).toContain("await client.query('begin read only')");
    expect(exporter).toContain('from public.cities');
    expect(exporter).toContain('where is_active = true');
    expect(exporter).not.toContain('.limit(');
    expect(exporter).not.toContain('insert into');
    expect(exporter).not.toContain('update ');
    expect(exporter).not.toContain('delete from');
  });

  test('reconcile consumes the safe candidate city code and revalidates normalized names', () => {
    const reconcile = read('scripts/reconcile-local-geo-run.js');

    expect(reconcile).toContain("raw.raw_payload?._candidate_city_code || raw.raw_payload?.candidate_city_code");
    expect(reconcile).toContain('join public.geo_places p on p.id=c.geo_place_id');
    expect(reconcile).toContain('c.code=$1 and c.country_code=$2');
    expect(reconcile).toContain('rawKeys.some(key => targetKeys.includes(key))');
    expect(reconcile).toContain("matchType = 'safe_candidate_city_code'");
    expect(reconcile).toContain("reason: 'safe_candidate_city_code'");
  });
});
