'use strict';

const crypto = require('crypto');
const { EVENT_TYPES } = require('./event-taxonomy');

const THRESHOLDS = Object.freeze({
  [EVENT_TYPES.PRODUCTION_REGRESSION]: 1,
  [EVENT_TYPES.CALCULATION_MISMATCH]: 1,
  [EVENT_TYPES.CAPABILITY_FAILED]: 2,
  [EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED]: 2,
  [EVENT_TYPES.CAPABILITY_MISSING]: 3,
  [EVENT_TYPES.ASSISTANT_INTENT_FAILED]: 3,
  [EVENT_TYPES.WORKFLOW_ABANDONED]: 3,
  [EVENT_TYPES.WORKFLOW_BLOCKED]: 3,
  [EVENT_TYPES.USER_CORRECTED]: 3,
  [EVENT_TYPES.ASSISTANT_LOW_CONFIDENCE]: 5
});

function thresholdFor(type) {
  return THRESHOLDS[type] || 5;
}

function proposalSeverity(type) {
  if ([EVENT_TYPES.PRODUCTION_REGRESSION, EVENT_TYPES.CALCULATION_MISMATCH].includes(type)) return 'critical';
  if ([EVENT_TYPES.CAPABILITY_FAILED, EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED].includes(type)) return 'high';
  if ([EVENT_TYPES.CAPABILITY_MISSING, EVENT_TYPES.ASSISTANT_INTENT_FAILED, EVENT_TYPES.WORKFLOW_ABANDONED, EVENT_TYPES.WORKFLOW_BLOCKED, EVENT_TYPES.USER_CORRECTED].includes(type)) return 'medium';
  return 'low';
}

function normalizeFingerprintParts(event) {
  const metadata = event?.metadata || {};
  return [
    event?.type || '',
    metadata.service_code || '',
    metadata.workflow_key || '',
    metadata.error_code || '',
    metadata.event_type || ''
  ].map(v => String(v).trim().toLowerCase());
}

function fingerprintEvent(event) {
  return crypto
    .createHash('sha256')
    .update(normalizeFingerprintParts(event).join('|'))
    .digest('hex');
}

async function aggregateEvolutionSignal({ supabase, event }) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('EVOLUTION_PROPOSAL_STORE_UNAVAILABLE');
  }
  if (!event?.type) throw new Error('EVOLUTION_PROPOSAL_EVENT_REQUIRED');

  const threshold = thresholdFor(event.type);
  const severity = proposalSeverity(event.type);
  const fingerprint = fingerprintEvent(event);

  const { data, error } = await supabase.rpc('evolution_aggregate_signal', {
    p_fingerprint:fingerprint,
    p_event_type:event.type,
    p_severity:severity,
    p_threshold:threshold,
    p_metadata:event.metadata || {},
    p_occurred_at:event.occurred_at
  });
  if (error) throw new Error('EVOLUTION_PROPOSAL_AGGREGATION_FAILED');
  return data;
}

module.exports = {
  THRESHOLDS,
  thresholdFor,
  proposalSeverity,
  fingerprintEvent,
  aggregateEvolutionSignal
};
