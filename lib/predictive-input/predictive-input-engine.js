/**
 * BONDS Predictive Input Engine
 *
 * Extends Auto Population with predictions from similar projects,
 * geographic data, and sector-wide benchmarks.
 */

const autoPopulate = require('../auto-populate/auto-populate-engine');

const PREDICTIVE_ADAPTERS = {
  similar_projects: async ({ fieldName, sector, city, userId }) => {
    if (!sector) return null;
    // Stub: would query bonds_projects metadata for similar projects.
    const similar = {
      rent: { restaurant: { Riyadh: 24000 }, retail: { Riyadh: 19000 } },
      labor_cost: { restaurant: 17000, manufacturing: 25000 },
      average_daily_rate: { hotel: 460 }
    };
    const value = similar[fieldName]?.[sector]?.[city] || similar[fieldName]?.[sector];
    if (value === undefined) return null;
    return {
      value,
      confidence: 80,
      source: 'similar_projects',
      reason: `Average from similar ${sector} projects${city ? ' in ' + city : ''}`
    };
  },
  geographic_data: async ({ fieldName, city, country }) => {
    const geo = {
      location_index: { Riyadh: 78, Jeddah: 74, Dubai: 82 },
      climate_factor: { Riyadh: 0.95, Jeddah: 0.92 }
    };
    const value = geo[fieldName]?.[city] || geo[fieldName]?.[country];
    if (value === undefined) return null;
    return {
      value,
      confidence: 68,
      source: 'geographic_data',
      reason: `Geographic benchmark for ${city || country}`
    };
  },
  sector_benchmarks: async ({ fieldName, sector }) => {
    const benchmarks = {
      food_cost_percentage: { restaurant: 0.32 },
      occupancy_rate: { hotel: 0.72, healthcare: 0.68 },
      conversion_rate: { retail: 0.22 }
    };
    const value = benchmarks[fieldName]?.[sector];
    if (value === undefined) return null;
    return {
      value,
      confidence: 70,
      source: 'sector_benchmarks',
      reason: `Sector benchmark for ${sector}`
    };
  }
};

const PREDICTIVE_ORDER = ['user_history', 'similar_projects', 'government_data', 'market_data', 'geographic_data', 'sector_benchmarks', 'financial_data', 'maps', 'previous_projects'];

async function predictField(field, context = {}) {
  const candidates = [];

  // Run all adapters, not just the original order, to allow predictive sources.
  const adapters = { ...autoPopulate.SOURCE_ADAPTERS, ...PREDICTIVE_ADAPTERS };
  const orderedSources = PREDICTIVE_ORDER.filter(name => adapters[name]);

  for (const sourceName of orderedSources) {
    const adapter = adapters[sourceName];
    const value = await adapter({
      fieldName: field.name,
      sector: context.sector,
      activity: context.activity,
      city: context.city,
      country: context.country,
      userId: context.userId
    });
    if (value) {
      candidates.push({
        source: sourceName,
        value: value.value,
        confidence: value.confidence || 50,
        sourceDetail: value.source || sourceName,
        reason: value.reason || null,
        timestamp: value.timestamp || new Date().toISOString()
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];

  let mode = 'ask';
  if (best.confidence >= 80) mode = 'auto';
  else if (best.confidence >= 50) mode = 'suggest';

  return {
    field: field.name,
    value: best.value,
    confidence: best.confidence,
    mode,
    source: best.source,
    sourceDetail: best.sourceDetail,
    reason: best.reason,
    alternatives: candidates.slice(1)
  };
}

async function predict(form, context = {}) {
  const predicted = [];
  const manual = [];

  for (const field of form.fields) {
    if (field.calculated || field.hidden) continue;
    const result = await predictField(field, { ...context, sector: form.sector });
    if (result) {
      predicted.push(result);
      field.value = result.value;
      field.predicted = true;
      field.predictionSource = result.source;
      field.confidence = result.confidence;
      field.predictionMode = result.mode;
    } else {
      manual.push(field.name);
    }
  }

  const overallConfidence = predicted.length
    ? predicted.reduce((sum, p) => sum + p.confidence, 0) / predicted.length
    : 0;

  return {
    sector: form.sector,
    predicted,
    manual,
    overallConfidence: Math.round(overallConfidence),
    overallGrade: require('../confidence/confidence-engine').gradeConfidence(overallConfidence)
  };
}

module.exports = {
  predict,
  predictField,
  PREDICTIVE_ADAPTERS
};
