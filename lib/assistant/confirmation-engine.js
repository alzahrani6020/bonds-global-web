'use strict';

const crypto = require('crypto');
const { normalizeAction } = require('./protocol');

const CONFIRMATION_VERSION = 1;
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
}

function actionSnapshot(action) {
  const normalized = normalizeAction(action);
  return {
    id: normalized.id,
    type: normalized.type,
    capability: normalized.capability,
    target: normalized.target,
    input: stableValue(normalized.input),
    risk: normalized.risk,
    requires_confirmation: normalized.requires_confirmation
  };
}

function actionFingerprint(action) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(actionSnapshot(action)))
    .digest('hex');
}

function confirmationPrompt(action, language = 'ar') {
  const normalized = normalizeAction(action);
  const target = normalized.target || normalized.capability || normalized.type;
  if (language === 'en') {
    return 'Confirm ' + normalized.type + ' for ' + target + '. Review the action details before confirming.';
  }
  return 'أكد إجراء ' + normalized.type + ' على ' + target + '. راجع تفاصيل الإجراء قبل التأكيد.';
}

function prepareConfirmation(action, { language = 'ar' } = {}) {
  const normalized = normalizeAction(action);
  if (!normalized.requires_confirmation) {
    return {
      version: CONFIRMATION_VERSION,
      required: false,
      status: 'not_required',
      action_id: normalized.id,
      action_fingerprint: actionFingerprint(normalized),
      execution_authorized: false
    };
  }

  return {
    version: CONFIRMATION_VERSION,
    required: true,
    status: 'pending',
    action_id: normalized.id,
    action_fingerprint: actionFingerprint(normalized),
    risk: normalized.risk,
    prompt: confirmationPrompt(normalized, language),
    preview: actionSnapshot(normalized),
    execution_authorized: false
  };
}

function resolveConfirmation(action, confirmation, decision) {
  const normalized = normalizeAction(action);
  if (!confirmation || typeof confirmation !== 'object') {
    throw new Error('CONFIRMATION_REQUIRED');
  }
  if (confirmation.action_id !== normalized.id) {
    throw new Error('CONFIRMATION_ACTION_MISMATCH');
  }

  const fingerprint = actionFingerprint(normalized);
  if (confirmation.action_fingerprint !== fingerprint) {
    throw new Error('CONFIRMATION_PAYLOAD_CHANGED');
  }

  const normalizedDecision = String(decision || '').trim().toLowerCase();
  if (!['confirm', 'cancel'].includes(normalizedDecision)) {
    throw new Error('INVALID_CONFIRMATION_DECISION');
  }

  return {
    ...confirmation,
    status: normalizedDecision === 'confirm' ? 'confirmed' : 'cancelled',
    decision: normalizedDecision,
    resolved_at: new Date().toISOString(),
    // Phase 1 confirmation records user intent only. Authorization remains
    // the responsibility of governance/service-token layers.
    execution_authorized: false
  };
}

module.exports = {
  CONFIRMATION_VERSION,
  actionSnapshot,
  actionFingerprint,
  prepareConfirmation,
  resolveConfirmation
};
