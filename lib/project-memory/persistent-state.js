'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_SCHEMA_VERSION = 1;
const VALID_STATUS = new Set([
  'not_started',
  'in_progress',
  'validating',
  'blocked',
  'paused',
  'waiting_for_capacity',
  'completed',
  'superseded'
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function checksum(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function validateCheckpoint(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('PROJECT_MEMORY_CHECKPOINT_OBJECT_REQUIRED');
  }
  if (input.schema_version !== STATE_SCHEMA_VERSION) {
    throw new Error('PROJECT_MEMORY_SCHEMA_UNSUPPORTED');
  }
  if (!input.task_id || !String(input.task_id).trim()) {
    throw new Error('PROJECT_MEMORY_TASK_ID_REQUIRED');
  }
  if (!VALID_STATUS.has(input.status)) {
    throw new Error('PROJECT_MEMORY_STATUS_INVALID');
  }
  if (!input.base_sha || !/^[0-9a-f]{40}$/.test(input.base_sha)) {
    throw new Error('PROJECT_MEMORY_BASE_SHA_INVALID');
  }
  if (input.candidate_sha != null && !/^[0-9a-f]{40}$/.test(input.candidate_sha)) {
    throw new Error('PROJECT_MEMORY_CANDIDATE_SHA_INVALID');
  }
  if (!input.current_stage || !String(input.current_stage).trim()) {
    throw new Error('PROJECT_MEMORY_STAGE_REQUIRED');
  }
  return true;
}

function withIntegrity(checkpoint) {
  validateCheckpoint(checkpoint);
  const payload = {
    ...checkpoint,
    schema_version: STATE_SCHEMA_VERSION,
    updated_at: checkpoint.updated_at || new Date().toISOString()
  };
  return {
    ...payload,
    integrity: {
      algorithm: 'sha256',
      checksum: checksum(payload)
    }
  };
}

function verifyIntegrity(record) {
  if (!record?.integrity?.checksum || record.integrity.algorithm !== 'sha256') {
    throw new Error('PROJECT_MEMORY_INTEGRITY_MISSING');
  }
  const { integrity, ...payload } = record;
  validateCheckpoint(payload);
  const observed = checksum(payload);
  if (observed !== integrity.checksum) {
    throw new Error('PROJECT_MEMORY_INTEGRITY_FAILED');
  }
  return payload;
}

function atomicWriteJson(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(tmp, filePath);
}

function saveCheckpoint(filePath, checkpoint) {
  const record = withIntegrity(checkpoint);
  atomicWriteJson(filePath, record);
  return record;
}

function loadCheckpoint(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const record = JSON.parse(raw);
  return verifyIntegrity(record);
}

function determineResumeAction({ checkpoint, currentMainSha }) {
  validateCheckpoint(checkpoint);
  if (!/^[0-9a-f]{40}$/.test(String(currentMainSha || ''))) {
    throw new Error('PROJECT_MEMORY_CURRENT_MAIN_SHA_INVALID');
  }
  if (checkpoint.status === 'completed') {
    return { action: 'do_not_repeat', reason: 'TASK_ALREADY_COMPLETED' };
  }
  if (checkpoint.base_sha !== currentMainSha) {
    return { action: 'rebase_and_revalidate', reason: 'BASELINE_CHANGED' };
  }
  if (checkpoint.status === 'blocked') {
    return { action: 'remain_blocked', reason: checkpoint.blocked_reason || 'BLOCKED' };
  }
  if (checkpoint.status === 'waiting_for_capacity') {
    return { action: 'reevaluate_capacity', reason: 'CAPACITY_REQUIRED' };
  }
  return { action: 'resume', reason: 'CHECKPOINT_VALID' };
}

module.exports = {
  STATE_SCHEMA_VERSION,
  VALID_STATUS,
  validateCheckpoint,
  withIntegrity,
  verifyIntegrity,
  saveCheckpoint,
  loadCheckpoint,
  determineResumeAction
};
