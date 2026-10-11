'use strict';

const {
  SOURCE_WEIGHTS,
  SOURCE_TYPES,
  normalizeSourceType,
  freshnessScore,
  reliabilityBand,
  clamp
} = require('../truth/evidence-record');

function daysSince(timestamp) {
  if (!timestamp) return null;
  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function inferSourceType(item = {}) {
  const detail = item.sourceDetail || item.source || '';
  const evidence = item.evidence || {};
  return normalizeSourceType(evidence.source_type || evidence.sourceType || detail, {
    estimated: Boolean(evidence.is_estimated || evidence.isEstimated),
    sourceMethod: evidence.method || '',
    sourceId: detail
  });
}

function assessAutoPopulation(autoPopulate = {}, formFields = []) {
  const populated = Array.isArray(autoPopulate.populated) ? autoPopulate.populated : [];
  const eligibleFields = (formFields || []).filter(f => !f.calculated && !f.hidden);
  const coverage = eligibleFields.length ? populated.length / eligibleFields.length : (populated.length ? 1 : 0);

  if (!populated.length) {
    return {
      score: 0,
      band: 'insufficient',
      coverage: Math.round(coverage * 100),
      sourceQuality: 0,
      freshness: 0,
      agreement: 0,
      items: []
    };
  }

  const items = populated.map(item => {
    const sourceType = inferSourceType(item);
    const sourceQuality = (SOURCE_WEIGHTS[sourceType] ?? SOURCE_WEIGHTS[SOURCE_TYPES.UNKNOWN]) * 100;
    const fresh = freshnessScore(daysSince(item.timestamp));
    const confidence = clamp(item.confidence);
    const alternatives = Array.isArray(item.alternatives) ? item.alternatives : [];
    const agreement = alternatives.length ? 70 : 55;
    const score = clamp(confidence * 0.35 + sourceQuality * 0.35 + fresh * 0.20 + agreement * 0.10);
    return {
      field: item.field,
      sourceType,
      confidence,
      sourceQuality: Math.round(sourceQuality),
      freshness: fresh,
      agreement,
      score: Math.round(score)
    };
  });

  const avg = key => items.reduce((sum, item) => sum + item[key], 0) / items.length;
  const sourceQuality = avg('sourceQuality');
  const freshness = avg('freshness');
  const agreement = avg('agreement');
  const itemReliability = avg('score');
  const score = Math.round(clamp(itemReliability * 0.75 + coverage * 100 * 0.25));

  return {
    score,
    band: reliabilityBand(score),
    coverage: Math.round(coverage * 100),
    sourceQuality: Math.round(sourceQuality),
    freshness: Math.round(freshness),
    agreement: Math.round(agreement),
    items
  };
}

module.exports = {
  assessAutoPopulation,
  inferSourceType
};
