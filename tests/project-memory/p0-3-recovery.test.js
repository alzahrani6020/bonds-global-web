'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SqliteCheckpointStore } = require('../../lib/project-memory/sqlite-checkpoint-store');
const { withIntegrity } = require('../../lib/project-memory/persistent-state');
const { selectRecoveryCheckpoint } = require('../../lib/project-memory/recovery');

const SHA = 'a'.repeat(40);

function cp(overrides={}) {
  return {
    schema_version:1,
    task_id:'task-1',
    status:'in_progress',
    base_sha:SHA,
    candidate_sha:null,
    current_stage:'p0.3',
    ...overrides
  };
}

describe('P0.3 durable recovery', () => {
  test('persists and reloads SQLite checkpoint', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'bonds-p03-'));
    const store = new SqliteCheckpointStore(path.join(dir,'evolution.db'));
    const saved = store.save(cp());
    const loaded = store.load('task-1');
    expect(loaded.generation).toBe(1);
    expect(loaded.current_stage).toBe('p0.3');
    expect(saved.integrity.checksum).toHaveLength(64);
    store.close();
  });

  test('increments generations monotonically', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'bonds-p03-'));
    const store = new SqliteCheckpointStore(path.join(dir,'evolution.db'));
    store.save(cp());
    store.save(cp({current_stage:'p0.3-next'}));
    expect(store.load('task-1').generation).toBe(2);
    store.close();
  });

  test('prefers newer local checkpoint and requests remote sync', () => {
    const local = withIntegrity({...cp(),generation:3,updated_at:'2026-10-23T00:00:03Z'});
    const remote = withIntegrity({...cp(),generation:2,updated_at:'2026-10-23T00:00:02Z'});
    const result = selectRecoveryCheckpoint({local,remote});
    expect(result.selected.source).toBe('local');
    expect(result.sync).toBe('remote');
  });

  test('prefers newer remote checkpoint and requests local sync', () => {
    const local = withIntegrity({...cp(),generation:2,updated_at:'2026-10-23T00:00:02Z'});
    const remote = withIntegrity({...cp(),generation:3,updated_at:'2026-10-23T00:00:03Z'});
    const result = selectRecoveryCheckpoint({local,remote});
    expect(result.selected.source).toBe('remote');
    expect(result.sync).toBe('local');
  });

  test('detects split brain at same generation', () => {
    const local = withIntegrity({...cp(),generation:3,updated_at:'2026-10-23T00:00:03Z',current_step:'A'});
    const remote = withIntegrity({...cp(),generation:3,updated_at:'2026-10-23T00:00:03Z',current_step:'B'});
    expect(() => selectRecoveryCheckpoint({local,remote}))
      .toThrow('PROJECT_MEMORY_SPLIT_BRAIN');
  });
});
