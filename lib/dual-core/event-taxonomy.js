'use strict';

const CORE_A = 'operational';
const CORE_B = 'self_evolving';

const EVENT_TYPES = Object.freeze({
  ASSISTANT_INTENT_FAILED: 'assistant.intent.failed',
  ASSISTANT_LOW_CONFIDENCE: 'assistant.low_confidence',
  CAPABILITY_MISSING: 'capability.missing',
  CAPABILITY_FAILED: 'capability.failed',
  USER_CORRECTED: 'user.corrected',
  WORKFLOW_ABANDONED: 'workflow.abandoned',
  WORKFLOW_BLOCKED: 'workflow.blocked',
  CALCULATION_MISMATCH: 'calculation.mismatch',
  DOCUMENT_EXTRACTION_FAILED: 'document.extraction.failed',
  CANDIDATE_VALIDATED: 'candidate.validated',
  RELEASE_PROMOTED: 'release.promoted',
  PRODUCTION_REGRESSION: 'production.regression',
  CAPACITY_CHANGED: 'runtime.capacity.changed',
  EVOLUTION_STATE_CHANGED: 'evolution.state.changed'
});

const EVENT_DEFINITIONS = Object.freeze({
  [EVENT_TYPES.ASSISTANT_INTENT_FAILED]: { source: CORE_A, target: CORE_B, severity: 'medium' },
  [EVENT_TYPES.ASSISTANT_LOW_CONFIDENCE]: { source: CORE_A, target: CORE_B, severity: 'low' },
  [EVENT_TYPES.CAPABILITY_MISSING]: { source: CORE_A, target: CORE_B, severity: 'medium' },
  [EVENT_TYPES.CAPABILITY_FAILED]: { source: CORE_A, target: CORE_B, severity: 'high' },
  [EVENT_TYPES.USER_CORRECTED]: { source: CORE_A, target: CORE_B, severity: 'medium' },
  [EVENT_TYPES.WORKFLOW_ABANDONED]: { source: CORE_A, target: CORE_B, severity: 'medium' },
  [EVENT_TYPES.WORKFLOW_BLOCKED]: { source: CORE_A, target: CORE_B, severity: 'medium' },
  [EVENT_TYPES.CALCULATION_MISMATCH]: { source: CORE_A, target: CORE_B, severity: 'critical' },
  [EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED]: { source: CORE_A, target: CORE_B, severity: 'medium' },
  [EVENT_TYPES.CANDIDATE_VALIDATED]: { source: CORE_B, target: CORE_A, severity: 'info' },
  [EVENT_TYPES.RELEASE_PROMOTED]: { source: CORE_B, target: CORE_A, severity: 'info' },
  [EVENT_TYPES.PRODUCTION_REGRESSION]: { source: CORE_A, target: CORE_B, severity: 'critical' },
  [EVENT_TYPES.CAPACITY_CHANGED]: { source: 'system', target: CORE_B, severity: 'info' },
  [EVENT_TYPES.EVOLUTION_STATE_CHANGED]: { source: CORE_B, target: 'system', severity: 'info' }
});

function getEventDefinition(type) {
  return EVENT_DEFINITIONS[type] || null;
}

function validateEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('DUAL_CORE_EVENT_OBJECT_REQUIRED');
  }
  const def = getEventDefinition(input.type);
  if (!def) throw new Error('DUAL_CORE_EVENT_TYPE_UNKNOWN');
  if (!input.id || typeof input.id !== 'string') throw new Error('DUAL_CORE_EVENT_ID_REQUIRED');
  if (!input.occurred_at || Number.isNaN(Date.parse(input.occurred_at))) {
    throw new Error('DUAL_CORE_EVENT_TIMESTAMP_INVALID');
  }
  if (input.payload != null && (typeof input.payload !== 'object' || Array.isArray(input.payload))) {
    throw new Error('DUAL_CORE_EVENT_PAYLOAD_INVALID');
  }
  return true;
}

module.exports = { CORE_A, CORE_B, EVENT_TYPES, EVENT_DEFINITIONS, getEventDefinition, validateEvent };
