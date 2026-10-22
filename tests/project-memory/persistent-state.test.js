'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  validateCheckpoint,
  saveCheckpoint,
  loadCheckpoint,
  determineResumeAction
} = require('../../lib/project-memory/persistent-state');

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

function checkpoint(overrides = {}) {
  return {
    schema_version: 1,
    task_id: 'phase0-memory',
    status: 'in_progress',
    base_sha: SHA_A,
    candidate_sha: null,
    current_stage: 'checkpoint-foundation',
    current_step: 'unit-tests',
    ...overrides
  };
}

describe('persistent project memory', () => {
  test('validates a well-formed checkpoint', () => {
    expect(validateCheckpoint(checkpoint())).toBe(true);
  });

  test('writes atomically and verifies integrity on load', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonds-memory-'));
    const file = path.join(dir, 'state.json');
    saveCheckpoint(file, checkpoint());
    const loaded = loadCheckpoint(file);
    expect(loaded.task_id).toBe('phase0-memory');
    expect(loaded.base_sha).toBe(SHA_A);
  });

  test('detects checkpoint corruption', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonds-memory-'));
    const file = path.join(dir, 'state.json');
    const record = saveCheckpoint(file, checkpoint());
    record.current_stage = 'tampered';
    fs.writeFileSync(file, JSON.stringify(record));
    expect(() => loadCheckpoint(file)).toThrow('PROJECT_MEMORY_INTEGRITY_FAILED');
  });

  test('never repeats completed work', () => {
    expect(determineResumeAction({
      checkpoint: checkpoint({ status: 'completed' }),
      currentMainSha: SHA_A
    })).toEqual({ action: 'do_not_repeat', reason: 'TASK_ALREADY_COMPLETED' });
  });

  test('requires rebase and revalidation when main changed', () => {
    expect(determineResumeAction({
      checkpoint: checkpoint(),
      currentMainSha: SHA_B
    })).toEqual({ action: 'rebase_and_revalidate', reason: 'BASELINE_CHANGED' });
  });

  test('reevaluates capacity instead of losing deferred work', () => {
    expect(determineResumeAction({
      checkpoint: checkpoint({ status: 'waiting_for_capacity' }),
      currentMainSha: SHA_A
    })).toEqual({ action: 'reevaluate_capacity', reason: 'CAPACITY_REQUIRED' });
  });
});
