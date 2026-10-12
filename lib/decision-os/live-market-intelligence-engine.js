'use strict';

const {
  SOURCE_TYPES,
  SOURCE_WEIGHTS,
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

function metricRecord(code, item = {}, context = {}) {
  const value = item.value ?? item.metricValue ?? item.amount ?? null;
  if (value === null || value === undefined || value === '') return null;
  const source = item.source || item.sourceDetail || item.provider || 'unknown';
  const sourceType = normalizeSourceType(
    item.sourceType || item.source_type || item.evidence?.source_type || source,
    {
      estimated: Boolean(item.isEstimated || item.is_estimated || item.evidence?.is_estimated),
      sourceMethod: item.method || item.evidence?.method || '',
      sourceId: source
    }
  );
  const freshnessDays = item.freshnessDays ?? item.freshness_days ?? daysSince(item.timestamp || item.observedAt || item.retrievedAt);
  const sourceQuality = (SOURCE_WEIGHTS[sourceType] ?? SOURCE_WEIGHTS[SOURCE_TYPES.UNKNOWN]) * 100;
  const freshness = freshnessScore(freshnessDays);
  const statedConfidence = Number.isFinite(Number(item.confidence)) ? clamp(item.confidence) : null;
  const reliability = Math.round(clamp(
    sourceQuality * 0.55 +
    freshness * 0.30 +
    (statedConfidence ?? sourceQuality) * 0.15
  ));

  return {
    code,
    value,
    unit: item.unit || null,
    country: item.country || context.country || null,
    city: item.city || context.city || null,
    activity: item.activity || context.activity || null,
    source,
    sourceType,
    observedAt: item.observedAt || item.timestamp || item.retrievedAt || null,
    freshnessDays,
    freshness,
    reliability,
    reliabilityBand: reliabilityBand(reliability),
    isEstimated: Boolean(
      item.isEstimated ||
      item.is_estimated ||
      [SOURCE_TYPES.MODELLED, SOURCE_TYPES.BENCHMARK, SOURCE_TYPES.INFERRED, SOURCE_TYPES.DEFAULT].includes(sourceType)
    ),
    metadata: item.metadata || item.evidence || null
  };
}

class LiveMarketIntelligenceEngine {
  constructor(options = {}) {
    this.maxLiveAgeDays = Number.isFinite(Number(options.maxLiveAgeDays))
      ? Number(options.maxLiveAgeDays)
      : 90;
  }

  analyze(context = {}) {
    const records = [];
    const providerErrors = [];

    for (const item of context.liveDataRecords || []) {
      if (!item || !item.code) continue;
      if (String(item.code).startsWith('_') && item.metadata?.error) {
        providerErrors.push({ provider: item.source || item.code, error: item.metadata.error });
        continue;
      }
      const record = metricRecord(item.code, item, context);
      if (record) records.push(record);
    }

    for (const item of context.autoPopulate?.populated || []) {
      if (!item || !item.field) continue;
      const record = metricRecord(item.field, {
        value: item.value,
        source: item.source,
        sourceType: item.evidence?.source_type || item.evidence?.sourceType,
        timestamp: item.timestamp,
        confidence: item.confidence,
        unit: item.unit,
        evidence: item.evidence || item.verification
      }, context);
      if (record) records.push(record);
    }

    const deduped = new Map();
    for (const record of records) {
      const current = deduped.get(record.code);
      if (!current || record.reliability > current.reliability) deduped.set(record.code, record);
    }

    const metrics = [...deduped.values()];
    const liveMetrics = metrics.filter(metric =>
      metric.freshnessDays !== null &&
      metric.freshnessDays <= this.maxLiveAgeDays &&
      [
        SOURCE_TYPES.OFFICIAL_OBSERVED,
        SOURCE_TYPES.VERIFIED_EXTERNAL,
        SOURCE_TYPES.FIRST_PARTY_OBSERVED
      ].includes(metric.sourceType)
    );

    const reliability = metrics.length
      ? Math.round(metrics.reduce((sum, metric) => sum + metric.reliability, 0) / metrics.length)
      : 0;

    const coverage = Array.isArray(context.requiredMarketMetrics) && context.requiredMarketMetrics.length
      ? Math.round(
          context.requiredMarketMetrics.filter(code => deduped.has(code)).length /
          context.requiredMarketMetrics.length * 100
        )
      : (metrics.length ? 100 : 0);

    const warnings = [];
    if (!metrics.length) warnings.push('no_market_evidence');
    if (metrics.length && !liveMetrics.length) warnings.push('no_fresh_observed_market_metrics');
    if (coverage < 60) warnings.push('low_market_metric_coverage');
    if (providerErrors.length) warnings.push('market_provider_errors');

    return {
      output: {
        metrics,
        metricMap: Object.fromEntries(metrics.map(metric => [metric.code, metric])),
        liveMetricCount: liveMetrics.length,
        totalMetricCount: metrics.length,
        coverage,
        live: liveMetrics.length > 0,
        providerErrors
      },
      confidence: reliability,
      evidence: metrics.map(metric => ({
        source: metric.source,
        evidence_type: 'market_metric',
        evidence_code: metric.code,
        value: metric.value,
        confidence: metric.reliability,
        timestamp: metric.observedAt,
        metadata: {
          sourceType: metric.sourceType,
          freshnessDays: metric.freshnessDays,
          isEstimated: metric.isEstimated
        }
      })),
      engine: 'live_market',
      status: metrics.length ? (liveMetrics.length ? 'live' : 'historical_or_estimated') : 'insufficient_inputs',
      executed: metrics.length > 0,
      decisionEligible: metrics.length > 0 && reliability >= 45,
      warnings
    };
  }
}

module.exports = { LiveMarketIntelligenceEngine, metricRecord, daysSince };
