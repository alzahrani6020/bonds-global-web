'use strict';

const {
  SOURCE_TYPES,
  SOURCE_WEIGHTS,
  clamp,
  normalizeSourceType,
  freshnessScore,
  reliabilityBand
} = require('./evidence-record');

const REQUIRED_FIELDS = [
  'market_size',
  'competitors_count',
  'market_saturation_score',
  'annual_growth_rate',
  'avg_salary'
];

function present(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function deriveFreshnessDays(row = {}) {
  const candidate = row.updated_at || row.fetched_at || row.created_at || null;
  if (!candidate) return null;
  const ts = Date.parse(candidate);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function assessOpportunityRow(row = {}) {
  const breakdown = row.opportunity_breakdown || row.breakdown || {};
  const rawPotential = clamp(
    breakdown.rawPotential ??
    breakdown.raw_potential ??
    row.rawScore ??
    row.opportunity_score ??
    row.score ??
    0
  );

  const sourceHint = breakdown.source || row.source_type || row.source || row.data_source || '';
  const estimated = Boolean(
    breakdown.estimated ||
    row.is_estimated ||
    /estimate|benchmark|infer|fallback|country_average/i.test(String(sourceHint))
  );
  const sourceType = normalizeSourceType(sourceHint, {
    estimated,
    sourceMethod: row.source_method || breakdown.method || '',
    sourceId: row.source_id || ''
  });
  const sourceQuality = SOURCE_WEIGHTS[sourceType] ?? SOURCE_WEIGHTS[SOURCE_TYPES.UNKNOWN];

  const presentCount = REQUIRED_FIELDS.filter(k => present(row[k])).length;
  const coverage = REQUIRED_FIELDS.length ? presentCount / REQUIRED_FIELDS.length : 0;

  const rowConfidence = clamp(row.confidence ?? 0);
  const breakdownConfidence = Number.isFinite(Number(breakdown.confidence))
    ? clamp(breakdown.confidence)
    : rowConfidence;

  const freshnessDays = deriveFreshnessDays(row);
  const freshness = freshnessScore(freshnessDays);

  const city = row.cities || row.city || {};
  const population = Number(city.population ?? row.population);
  const validPopulation = Number.isFinite(population) && population > 0;

  const hasBreakdown = breakdown && Object.keys(breakdown).length > 0;
  const reliabilityBase =
    rowConfidence * 0.30 +
    breakdownConfidence * 0.20 +
    coverage * 100 * 0.20 +
    sourceQuality * 100 * 0.20 +
    freshness * 0.10;

  let reliability = clamp(reliabilityBase);
  const warnings = [];

  if (!validPopulation) {
    reliability = Math.min(reliability, 25);
    warnings.push('population_missing_or_zero');
  }
  if (!hasBreakdown) {
    reliability = Math.min(reliability, 45);
    warnings.push('score_breakdown_missing');
  }
  if (estimated) {
    reliability = Math.min(reliability, sourceType === SOURCE_TYPES.BENCHMARK ? 55 : 50);
    warnings.push('estimated_data');
  }
  if (sourceType === SOURCE_TYPES.UNKNOWN) {
    reliability = Math.min(reliability, 50);
    warnings.push('source_unknown');
  }
  if (coverage < 0.6) warnings.push('low_metric_coverage');
  if (rowConfidence <= 0) {
    reliability = Math.min(reliability, 30);
    warnings.push('zero_row_confidence');
  }
  if (breakdownConfidence <= 0) {
    reliability = Math.min(reliability, 35);
    warnings.push('zero_breakdown_confidence');
  }

  reliability = Math.round(reliability);
  const decisionScore = Math.round(clamp(rawPotential * (reliability / 100)) * 10) / 10;
  const uncertaintyMargin = Math.round((100 - reliability) * 0.35 * 10) / 10;
  const uncertainty = {
    low: Math.round(clamp(rawPotential - uncertaintyMargin) * 10) / 10,
    high: Math.round(clamp(rawPotential + uncertaintyMargin) * 10) / 10
  };

  const band = reliabilityBand(reliability);
  let decisionStatus = 'exploratory';
  if (reliability >= 75 && decisionScore >= 70) decisionStatus = 'strong';
  else if (reliability >= 60 && decisionScore >= 55) decisionStatus = 'supported';
  else if (reliability >= 40) decisionStatus = 'indicative';
  if (reliability < 40) decisionStatus = 'indicative_only';
  if (!validPopulation || reliability < 20) decisionStatus = 'insufficient_evidence';

  return {
    rawPotential,
    reliability,
    reliabilityBand: band,
    decisionScore,
    decisionStatus,
    coverage: Math.round(coverage * 100),
    sourceType,
    freshnessDays,
    uncertainty,
    warnings
  };
}

module.exports = {
  REQUIRED_FIELDS,
  assessOpportunityRow
};
