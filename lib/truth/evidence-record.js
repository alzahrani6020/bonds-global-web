'use strict';

const SOURCE_TYPES = Object.freeze({
  OFFICIAL_OBSERVED: 'OFFICIAL_OBSERVED',
  VERIFIED_EXTERNAL: 'VERIFIED_EXTERNAL',
  FIRST_PARTY_OBSERVED: 'FIRST_PARTY_OBSERVED',
  HISTORICAL_DATABASE: 'HISTORICAL_DATABASE',
  MODELLED: 'MODELLED',
  BENCHMARK: 'BENCHMARK',
  INFERRED: 'INFERRED',
  USER_PROVIDED: 'USER_PROVIDED',
  DEFAULT: 'DEFAULT',
  UNKNOWN: 'UNKNOWN'
});

const SOURCE_WEIGHTS = Object.freeze({
  [SOURCE_TYPES.OFFICIAL_OBSERVED]: 1.00,
  [SOURCE_TYPES.VERIFIED_EXTERNAL]: 0.90,
  [SOURCE_TYPES.FIRST_PARTY_OBSERVED]: 0.85,
  [SOURCE_TYPES.HISTORICAL_DATABASE]: 0.80,
  [SOURCE_TYPES.USER_PROVIDED]: 0.75,
  [SOURCE_TYPES.MODELLED]: 0.65,
  [SOURCE_TYPES.BENCHMARK]: 0.55,
  [SOURCE_TYPES.INFERRED]: 0.40,
  [SOURCE_TYPES.DEFAULT]: 0.20,
  [SOURCE_TYPES.UNKNOWN]: 0.35
});

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function normalizeSourceType(value, { estimated = false, sourceMethod = '', sourceId = '' } = {}) {
  const raw = String(value || sourceMethod || sourceId || '').trim().toLowerCase();
  if (Object.values(SOURCE_TYPES).includes(value)) return value;
  if (/official|government|gastat|sama|ministry|registry/.test(raw)) return SOURCE_TYPES.OFFICIAL_OBSERVED;
  if (/verified|external|market_api|provider/.test(raw)) return SOURCE_TYPES.VERIFIED_EXTERNAL;
  if (/first_party|internal_observed|transaction/.test(raw)) return SOURCE_TYPES.FIRST_PARTY_OBSERVED;
  if (/historical|database|normalized_metric/.test(raw)) return SOURCE_TYPES.HISTORICAL_DATABASE;
  if (/benchmark|country_average|sector_average/.test(raw)) return SOURCE_TYPES.BENCHMARK;
  if (/infer|heuristic|llm|algorithmic/.test(raw)) return SOURCE_TYPES.INFERRED;
  if (/model|regression|forecast/.test(raw)) return SOURCE_TYPES.MODELLED;
  if (/manual|user/.test(raw)) return SOURCE_TYPES.USER_PROVIDED;
  if (/default|preset|fallback/.test(raw)) return SOURCE_TYPES.DEFAULT;
  if (estimated) return SOURCE_TYPES.INFERRED;
  return SOURCE_TYPES.UNKNOWN;
}

function freshnessScore(freshnessDays) {
  if (freshnessDays === null || freshnessDays === undefined || Number.isNaN(Number(freshnessDays))) return 50;
  const days = Math.max(0, Number(freshnessDays));
  if (days <= 7) return 100;
  if (days <= 30) return 90;
  if (days <= 90) return 75;
  if (days <= 180) return 60;
  if (days <= 365) return 45;
  return 25;
}

function reliabilityBand(score) {
  const s = clamp(score);
  if (s >= 80) return 'verified';
  if (s >= 65) return 'supported';
  if (s >= 45) return 'indicative';
  if (s >= 25) return 'exploratory';
  return 'insufficient';
}

function createEvidenceRecord({
  value,
  unit = null,
  source = null,
  sourceType = SOURCE_TYPES.UNKNOWN,
  country = null,
  city = null,
  activity = null,
  period = null,
  sampleSize = null,
  retrievedAt = null,
  freshnessDays = null,
  method = null,
  confidence = null,
  uncertainty = null,
  isEstimated = false,
  isFallback = false,
  validationStatus = 'unverified',
  metadata = {}
} = {}) {
  const normalizedType = normalizeSourceType(sourceType, {
    estimated: isEstimated,
    sourceMethod: method,
    sourceId: source
  });
  return {
    value,
    unit,
    source,
    source_type: normalizedType,
    country,
    city,
    activity,
    period,
    sample_size: sampleSize,
    retrieved_at: retrievedAt,
    freshness_days: freshnessDays,
    method,
    confidence: confidence === null || confidence === undefined ? null : clamp(confidence),
    uncertainty,
    is_estimated: Boolean(isEstimated),
    is_fallback: Boolean(isFallback),
    validation_status: validationStatus,
    metadata
  };
}

module.exports = {
  SOURCE_TYPES,
  SOURCE_WEIGHTS,
  clamp,
  normalizeSourceType,
  freshnessScore,
  reliabilityBand,
  createEvidenceRecord
};
