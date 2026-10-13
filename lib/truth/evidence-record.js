'use strict';

const TRUTH_CONTRACT_VERSION = 'BONDS_TRUTH_V2';
const DAY_MS = 86400000;

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

function parseObservationTimestamp(value) {
  if (value === null || value === undefined || value === '') return NaN;

  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? ts : NaN;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 3000) {
    return Date.UTC(value, 11, 31, 23, 59, 59, 999);
  }

  const raw = String(value).trim();
  if (!raw) return NaN;

  let match = raw.match(/^(\d{4})$/);
  if (match) return Date.UTC(Number(match[1]), 11, 31, 23, 59, 59, 999);

  match = raw.match(/^(\d{4})-(\d{2})$/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]), 0, 23, 59, 59, 999);

  match = raw.match(/^(\d{4})\s+Q([1-4])$/i);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) * 3, 0, 23, 59, 59, 999);

  match = raw.match(/^(\d{4})\s+(?:Census|Annual|FY)$/i);
  if (match) return Date.UTC(Number(match[1]), 11, 31, 23, 59, 59, 999);

  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : NaN;
}

function deriveEvidenceAges(record = {}, nowMs = Date.now()) {
  const metadata = record.metadata && typeof record.metadata === 'object' ? record.metadata : {};
  const observationCandidate =
    record.observation_at ??
    record.observed_at ??
    record.observation_date ??
    record.period ??
    metadata.sourcePeriod ??
    record.data_year ??
    record.observation_year ??
    record.year ??
    null;

  const retrievalCandidate =
    record.retrieved_at ??
    record.fetched_at ??
    record.updated_at ??
    record.created_at ??
    null;

  const observationTs = parseObservationTimestamp(observationCandidate);
  const retrievalTs = retrievalCandidate ? Date.parse(retrievalCandidate) : NaN;

  const observationAgeDays = Number.isFinite(observationTs)
    ? Math.max(0, Math.floor((nowMs - observationTs) / DAY_MS))
    : null;
  const retrievalAgeDays = Number.isFinite(retrievalTs)
    ? Math.max(0, Math.floor((nowMs - retrievalTs) / DAY_MS))
    : null;

  return {
    observation_at: Number.isFinite(observationTs) ? new Date(observationTs).toISOString() : null,
    observation_age_days: observationAgeDays,
    retrieval_age_days: retrievalAgeDays,
    freshness_days: observationAgeDays,
    freshness_basis: observationAgeDays === null ? 'unknown' : 'observation'
  };
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
  const ages = deriveEvidenceAges({
    period,
    retrieved_at: retrievedAt,
    metadata
  });
  const effectiveFreshnessDays = freshnessDays === null || freshnessDays === undefined
    ? ages.freshness_days
    : Math.max(0, Number(freshnessDays));

  return {
    truth_contract_version: TRUTH_CONTRACT_VERSION,
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
    observation_at: ages.observation_at,
    observation_age_days: ages.observation_age_days,
    retrieval_age_days: ages.retrieval_age_days,
    freshness_days: effectiveFreshnessDays,
    freshness_basis: freshnessDays === null || freshnessDays === undefined ? ages.freshness_basis : 'explicit',
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
  TRUTH_CONTRACT_VERSION,
  SOURCE_TYPES,
  SOURCE_WEIGHTS,
  clamp,
  normalizeSourceType,
  parseObservationTimestamp,
  deriveEvidenceAges,
  freshnessScore,
  reliabilityBand,
  createEvidenceRecord
};
