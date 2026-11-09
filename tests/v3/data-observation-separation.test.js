/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('data observation/model separation', () => {
  test('inference and modeled Gold persistence are explicit opt-ins', () => {
    const pipeline = read('v3/engine/data-acquisition/DataPipeline.js');
    expect(pipeline).toContain('inferMissing: options.inferMissing === true');
    expect(pipeline).toContain('persistModeledGold: options.persistModeledGold === true');
  });

  test('normalized metrics carry explicit observation kind', () => {
    const pipeline = read('v3/engine/data-acquisition/DataPipeline.js');
    expect(pipeline).toContain("observationKind:");
    expect(pipeline).toContain("? 'modeled' : 'observed'");
    expect(pipeline).toContain("sourceId === 'inference_engine'");
  });

  test('modeled results do not enter Gold indicator tables by default', () => {
    const pipeline = read('v3/engine/data-acquisition/DataPipeline.js');
    const occurrences = pipeline.match(/result\.isEstimated === true && !this\.options\.persistModeledGold/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  test('city Gold fusion skips region and national silver observations', () => {
    const pipeline = read('v3/engine/data-acquisition/DataPipeline.js');
    expect(pipeline).toContain("require('./source-capability-registry')");
    expect(pipeline).toContain('if (!isCityGrainObservation(m)) continue;');
  });

  test('live run type is a first-class data_source_runs value', () => {
    const sql = read('supabase/migrations/20261110013000_data_source_runs_live_type.sql');
    expect(sql).toContain("CHECK (run_type IN ('full', 'incremental', 'manual', 'live'))");
  });

  test('Gold market source explicitly identifies observed versus mixed provenance', () => {
    const pipeline = read('v3/engine/data-acquisition/DataPipeline.js');
    expect(pipeline).toContain("Bonds Data Engine (observed)");
    expect(pipeline).toContain("Bonds Data Engine (mixed)");
  });
});
