const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Geo write safety contract', () => {
  const guardedWriters = [
    ['scripts/link-local-geonames-admin1.js', 'GEO_ADMIN1_APPLY'],
    ['scripts/stage-local-geo-dataset.js', 'GEO_STAGE_APPLY'],
    ['scripts/reconcile-local-geo-run.js', 'GEO_RECONCILE_APPLY'],
    ['scripts/promote-local-geo-run.js', 'GEO_PROMOTE_APPLY'],
    ['scripts/rollback-local-geo-run.js', 'GEO_ROLLBACK_APPLY']
  ];

  test.each(guardedWriters)('%s requires explicit %s=1 opt-in', (scriptPath, flag) => {
    const script = read(scriptPath);
    expect(script).toContain(`process.env.${flag} === '1'`);
  });

  test('full ingestion requires every forward-write opt-in', () => {
    const ingest = read('scripts/ingest-local-geo-dataset.js');
    for (const flag of [
      'GEO_ADMIN1_APPLY',
      'GEO_STAGE_APPLY',
      'GEO_RECONCILE_APPLY',
      'GEO_PROMOTE_APPLY'
    ]) {
      expect(ingest).toContain(`process.env.${flag} !== '1'`);
    }
  });

  test('legacy load entrypoint delegates to the guarded ingestion pipeline', () => {
    const legacy = read('scripts/load-local-geo-dataset.js');
    expect(legacy).toContain("'ingest-local-geo-dataset.js'");
    expect(legacy).not.toMatch(/\b(insert into|update|delete from)\s+(?:public\.geo_|geo_ingest\.)/i);
  });

  test('known database-writing geo scripts are all explicitly guarded', () => {
    for (const [scriptPath, flag] of guardedWriters) {
      const script = read(scriptPath);
      const hasWrite = /\b(insert into|update|delete from)\s+(?:public\.geo_|geo_ingest\.)/i.test(script);
      expect(hasWrite).toBe(true);
      expect(script).toContain(`process.env.${flag} === '1'`);
    }
  });

  test('build-local remains filesystem-only', () => {
    const build = read('scripts/build-local-geo-dataset.js');
    expect(build).not.toMatch(/\b(insert into|update|delete from)\s+(?:public\.geo_|geo_ingest\.)/i);
    expect(build).not.toContain('DATABASE_URL');
  });
});
