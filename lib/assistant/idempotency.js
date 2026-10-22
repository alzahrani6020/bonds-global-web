'use strict';

const { actionFingerprint } = require('./confirmation-engine');

const IDEMPOTENCY_VERSION = 1;
const KEY_PATTERN = /^[0-9a-f]{64}$/;
const CLAIM_STATES = new Set([
  'claimed',
  'replay_succeeded',
  'in_progress',
  'uncertain',
  'key_conflict'
]);

function normalizeIdempotencyKey(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!KEY_PATTERN.test(key)) {
    throw new Error('INVALID_IDEMPOTENCY_KEY');
  }
  return key;
}

function sanitizeResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    ok: value.ok === true,
    code: value.code == null ? null : String(value.code).slice(0, 100),
    record_id: value.record_id == null ? null : String(value.record_id).slice(0, 100),
    status: value.status == null ? null : String(value.status).slice(0, 50)
  };
}

function normalizeRpcData(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data && typeof data === 'object' ? data : null;
}

function normalizeClaimState(data) {
  const normalized = normalizeRpcData(data);
  const state = String(normalized?.state || '');
  if (!CLAIM_STATES.has(state)) {
    throw new Error('IDEMPOTENCY_LEDGER_RESPONSE_INVALID');
  }
  return {
    state,
    status: normalized?.status == null ? null : String(normalized.status),
    result: sanitizeResult(normalized?.result)
  };
}

async function claimAssistantAction({
  supabase,
  userId,
  action,
  idempotencyKey
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('IDEMPOTENCY_STORE_UNAVAILABLE');
  }

  const user = String(userId || '').trim();
  if (!user) throw new Error('IDEMPOTENCY_USER_REQUIRED');

  const key = normalizeIdempotencyKey(idempotencyKey);
  const fingerprint = actionFingerprint(action);
  const actionType = String(action?.type || '').trim();
  const actionTarget = action?.target == null ? '' : String(action.target);

  if (actionType !== 'form_save_draft') {
    throw new Error('IDEMPOTENCY_ACTION_NOT_SUPPORTED');
  }

  const { data, error } = await supabase.rpc('assistant_claim_idempotency', {
    p_user_id: user,
    p_idempotency_key: key,
    p_action_type: actionType,
    p_action_target: actionTarget,
    p_action_fingerprint: fingerprint
  });

  if (error) throw new Error('IDEMPOTENCY_CLAIM_FAILED');

  return {
    version: IDEMPOTENCY_VERSION,
    key,
    action_fingerprint: fingerprint,
    ...normalizeClaimState(data)
  };
}

async function resolveAssistantAction({
  supabase,
  userId,
  action,
  idempotencyKey,
  status,
  result = null
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('IDEMPOTENCY_STORE_UNAVAILABLE');
  }

  const user = String(userId || '').trim();
  if (!user) throw new Error('IDEMPOTENCY_USER_REQUIRED');

  const key = normalizeIdempotencyKey(idempotencyKey);
  const fingerprint = actionFingerprint(action);
  const normalizedStatus = String(status || '').trim();

  if (!['succeeded', 'uncertain'].includes(normalizedStatus)) {
    throw new Error('INVALID_IDEMPOTENCY_STATUS');
  }

  const { data, error } = await supabase.rpc('assistant_resolve_idempotency', {
    p_user_id: user,
    p_idempotency_key: key,
    p_action_fingerprint: fingerprint,
    p_status: normalizedStatus,
    p_result: normalizedStatus === 'succeeded' ? sanitizeResult(result) : null
  });

  if (error) throw new Error('IDEMPOTENCY_RESOLVE_FAILED');

  const normalized = normalizeRpcData(data);
  const state = String(normalized?.state || '');
  if (!state) throw new Error('IDEMPOTENCY_LEDGER_RESPONSE_INVALID');

  return {
    version: IDEMPOTENCY_VERSION,
    key,
    action_fingerprint: fingerprint,
    state,
    status: normalized?.status == null ? null : String(normalized.status),
    result: sanitizeResult(normalized?.result)
  };
}

module.exports = {
  IDEMPOTENCY_VERSION,
  normalizeIdempotencyKey,
  sanitizeResult,
  normalizeClaimState,
  claimAssistantAction,
  resolveAssistantAction
};
