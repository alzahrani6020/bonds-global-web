'use strict';

const crypto = require('crypto');

const IDEMPOTENCY_VERSION = 1;
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
}

function idempotencyFingerprint({
  boundary,
  actionType,
  target,
  revision = 0,
  input = {}
} = {}) {
  const normalized = {
    version: IDEMPOTENCY_VERSION,
    boundary: String(boundary || ''),
    action_type: String(actionType || ''),
    target: String(target || ''),
    revision: Number.isFinite(Number(revision)) ? Number(revision) : 0,
    input: stable(input && typeof input === 'object' ? input : {})
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

function createIdempotencyRecord({
  key,
  boundary,
  actionType,
  target,
  revision = 0,
  status = 'in_flight',
  result = null,
  createdAt = null,
  updatedAt = null
} = {}) {
  const now = new Date().toISOString();
  return {
    version: IDEMPOTENCY_VERSION,
    key: String(key || ''),
    boundary: String(boundary || ''),
    action_type: String(actionType || ''),
    target: String(target || ''),
    revision: Number.isFinite(Number(revision)) ? Number(revision) : 0,
    status: String(status || 'in_flight'),
    result: result && typeof result === 'object' && !Array.isArray(result) ? result : null,
    created_at: createdAt || now,
    updated_at: updatedAt || now
  };
}

function beginIdempotentAction(existing, request) {
  const key = idempotencyFingerprint(request);

  if (existing && existing.key === key) {
    if (existing.status === 'completed') {
      return { decision: 'replay', key, record: existing };
    }
    if (existing.status === 'in_flight') {
      return { decision: 'in_flight', key, record: existing };
    }
  }

  return {
    decision: 'execute',
    key,
    record: createIdempotencyRecord({
      key,
      boundary: request.boundary,
      actionType: request.actionType,
      target: request.target,
      revision: request.revision,
      status: 'in_flight'
    })
  };
}

function completeIdempotentAction(record, result) {
  if (!record || !record.key) throw new Error('INVALID_IDEMPOTENCY_RECORD');
  return {
    ...record,
    status: 'completed',
    result: result && typeof result === 'object' && !Array.isArray(result) ? result : null,
    updated_at: new Date().toISOString()
  };
}

function failIdempotentAction(record, result = null) {
  if (!record || !record.key) throw new Error('INVALID_IDEMPOTENCY_RECORD');
  return {
    ...record,
    status: 'failed',
    result: result && typeof result === 'object' && !Array.isArray(result) ? result : null,
    updated_at: new Date().toISOString()
  };
}

function isTerminalIdempotencyRecord(record) {
  return !!record && TERMINAL_STATUSES.has(record.status);
}

module.exports = {
  IDEMPOTENCY_VERSION,
  stable,
  idempotencyFingerprint,
  createIdempotencyRecord,
  beginIdempotentAction,
  completeIdempotentAction,
  failIdempotentAction,
  isTerminalIdempotencyRecord
};
