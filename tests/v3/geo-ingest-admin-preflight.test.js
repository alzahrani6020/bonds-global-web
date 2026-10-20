const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Local geo ingestion ADM1 preflight', () => {
  test('one-command ingestion links provider ADM1 before staging places', () => {
    const script = read('scripts/ingest-local-geo-dataset.js');
    const linkAt = script.indexOf("run('link-local-geonames-admin1.js')");
    const stageAt = script.indexOf("run('stage-local-geo-dataset.js'");
    expect(linkAt).toBeGreaterThanOrEqual(0);
    expect(stageAt).toBeGreaterThan(linkAt);
  });

  test('data-quality aggregate includes provider ADM1 readiness', () => {
    const sql = read('supabase/migrations/20261020042500_geo_admin_source_quality_integration.sql');
    expect(sql).toContain('public.dq_find_geo_admin_source_links()');
    expect(sql).toContain("'geo_admin_source_links',v_geo_admin_sources");
    expect(sql).toContain("'geo_integrity',v_geo + v_geo_admin + v_geo_admin_sources");
  });
});
