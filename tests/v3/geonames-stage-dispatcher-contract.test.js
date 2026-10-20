const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('GeoNames one-shot stage dispatcher contract', () => {
  test('dispatcher can only request governed stage_reconcile from a fixed marker', () => {
    const workflow = read('.github/workflows/geonames-stage-reconcile-dispatcher.yml');

    expect(workflow).toContain('.github/geonames-stage-reconcile.trigger');
    expect(workflow).toContain('actions: write');
    expect(workflow).toContain("expected='STAGE_RECONCILE_ONCE_2026-10-21'");
    expect(workflow).toContain('geonames-governed-ingestion.yml/dispatches');
    expect(workflow).toContain('"action":"stage_reconcile"');
    expect(workflow).toContain('"run_id":""');
    expect(workflow).toContain('"confirmation":""');
    expect(workflow).not.toContain('"action":"promote"');
    expect(workflow).not.toContain('"action":"rollback"');
  });
});
