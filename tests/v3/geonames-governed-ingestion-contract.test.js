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
});
