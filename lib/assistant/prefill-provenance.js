'use strict';

const { Provenance } = require('../fabric/provenance');

const PREFILL_SOURCES = Object.freeze([
  'profile',
  'project',
  'funding_case',
  'document',
  'calculator',
  'conversation',
  'ai_inference'
]);

const PREFILL_STATUSES = Object.freeze(['suggested', 'confirmed']);

function clampConfidence(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, number));
}

function normalizePrefillCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('INVALID_PREFILL_CANDIDATE');
  }

  const source = String(candidate.source || '').trim();
  if (!PREFILL_SOURCES.includes(source)) {
    throw new Error('INVALID_PREFILL_SOURCE');
  }

  const requestedStatus = PREFILL_STATUSES.includes(candidate.status)
    ? candidate.status
    : 'suggested';
  const explicitlyConfirmed = candidate.confirmed_by_user === true;
  const status = source === 'ai_inference' && requestedStatus === 'confirmed' && !explicitlyConfirmed
    ? 'suggested'
    : requestedStatus;

  return {
    value: candidate.value === undefined ? null : candidate.value,
    source,
    status,
    confidence: clampConfidence(candidate.confidence),
    source_ref: candidate.source_ref == null ? null : String(candidate.source_ref).slice(0, 300),
    confirmed_by_user: status === 'confirmed' ? explicitlyConfirmed || source !== 'ai_inference' : false
  };
}

function buildPrefillMetadata({ field, candidate, entityType = 'form', entityId = null }) {
  const normalized = normalizePrefillCandidate(candidate);
  const provenance = Provenance.build({
    entityType,
    entityId,
    field,
    value: normalized.value,
    sourceId: normalized.source_ref,
    connectorCode: normalized.source,
    confidence: normalized.confidence,
    evidence: {
      prefill: true,
      status: normalized.status,
      confirmed_by_user: normalized.confirmed_by_user
    },
    reason: 'assistant_prefill'
  });

  return {
    ...normalized,
    provenance
  };
}

function applyPrefillProvenance(fields, candidates = {}, options = {}) {
  if (!Array.isArray(fields)) return [];
  const candidateMap = candidates && typeof candidates === 'object' && !Array.isArray(candidates)
    ? candidates
    : {};

  return fields.map(field => {
    if (!field || typeof field !== 'object' || !field.name) return field;
    if (!Object.prototype.hasOwnProperty.call(candidateMap, field.name)) return field;

    return {
      ...field,
      prefill: buildPrefillMetadata({
        field: field.name,
        candidate: candidateMap[field.name],
        entityType: options.entityType || 'form',
        entityId: options.entityId || null
      })
    };
  });
}

module.exports = {
  PREFILL_SOURCES,
  PREFILL_STATUSES,
  normalizePrefillCandidate,
  buildPrefillMetadata,
  applyPrefillProvenance
};
