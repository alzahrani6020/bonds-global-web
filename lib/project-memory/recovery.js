'use strict';

const { verifyIntegrity } = require('./persistent-state');

function normalize(candidate, source) {
  if (!candidate) return null;
  const record = candidate.record || candidate;
  const payload = candidate.payload || verifyIntegrity(record);
  return {
    source,
    record,
    payload,
    generation: Number(payload.generation || 0),
    updated_at: payload.updated_at || null
  };
}

function selectRecoveryCheckpoint({ local, remote }) {
  const l = normalize(local, 'local');
  const r = normalize(remote, 'remote');
  if (!l && !r) return { action: 'start_fresh', selected: null };
  if (l && !r) return { action: 'resume', selected: l, sync: 'remote' };
  if (!l && r) return { action: 'resume', selected: r, sync: 'local' };

  if (l.payload.task_id !== r.payload.task_id) {
    throw new Error('PROJECT_MEMORY_TASK_MISMATCH');
  }

  if (l.generation > r.generation) {
    return { action: 'resume', selected: l, sync: 'remote' };
  }
  if (r.generation > l.generation) {
    return { action: 'resume', selected: r, sync: 'local' };
  }

  if (l.record.integrity.checksum !== r.record.integrity.checksum) {
    throw new Error('PROJECT_MEMORY_SPLIT_BRAIN');
  }
  return { action: 'resume', selected: l, sync: null };
}

module.exports = { selectRecoveryCheckpoint };
