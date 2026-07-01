/**
 * BONDS Auto Population Engine
 *
 * Attempts to fill form fields from available data sources before asking the user.
 * Returns a confidence score for each value so the UI can decide auto-fill vs suggestion vs ask.
 */

const { scoreToConfidence, gradeConfidence } = require('../confidence/confidence-engine');

let fabricInstance = null;

function setFabric(fabric) {
  fabricInstance = fabric;
}

// In-memory source adapters. In production these can call the data_sources catalog,
// external APIs, or RPCs. The interface is intentionally uniform.
const SOURCE_ADAPTERS = {
  user_history: async ({ fieldName, userId }) => {
    if (!userId) return null;
    // Stub: would query user's previous projects.
    const history = {
      rent: { value: 25000, confidence: 90 },
      labor_cost: { value: 18000, confidence: 85 }
    };
    return history[fieldName] || null;
  },
  market_data: async ({ fieldName, sector, city, country }) => {
    const market = {
      rent: { restaurant: 22000, retail: 18000, hotel: 45000 },
      energy_cost: { manufacturing: 15000 },
      average_daily_rate: { hotel: 450 }
    };
    if (market[fieldName] && market[fieldName][sector]) {
      return { value: market[fieldName][sector], confidence: 75, source: 'market_rent' };
    }
    return null;
  },
  government_data: async ({ fieldName, country, city }) => {
    const gov = {
      licenses: { value: ['commercial', 'municipal'], confidence: 95, source: 'gov_business_registry' }
    };
    return gov[fieldName] || null;
  },
  financial_data: async ({ fieldName, sector }) => {
    const fin = {
      interest_rate: { value: 0.065, confidence: 80, source: 'central_bank' },
      growth_rate: { value: 0.05, confidence: 60, source: 'market_index' }
    };
    return fin[fieldName] || null;
  },
  maps: async ({ fieldName, city }) => {
    if (fieldName === 'location_index') {
      return { value: 72, confidence: 55, source: 'location_index' };
    }
    return null;
  },
  trusted_data_fabric: async ({ field, context }) => {
    if (!fabricInstance) return null;
    try {
      const values = await fabricInstance.resolveValues({ fields: [field], context });
      const result = values[field.name];
      if (!result || result.error || result.value === null || result.value === undefined) return null;
      return {
        value: result.value,
        confidence: result.confidence,
        source: 'trusted_data_fabric',
        sourceDetail: result.source || 'fabric',
        timestamp: result.timestamp,
        alternatives: result.alternatives || [],
        verification: result.verification,
        evidence: result.evidence
      };
    } catch (err) {
      // Fabric failures should not break auto-population; fall back to ask/manual.
      return null;
    }
  },
  previous_projects: async ({ fieldName, sector, userId }) => {
    if (!userId) return null;
    // Stub: would query bonds_projects metadata.
    return null;
  }
};

const SOURCE_ORDER = ['user_history', 'trusted_data_fabric', 'government_data', 'market_data', 'financial_data', 'maps', 'previous_projects'];

async function populateField(field, context = {}) {
  const candidates = [];
  for (const sourceName of SOURCE_ORDER) {
    const adapter = SOURCE_ADAPTERS[sourceName];
    if (!adapter) continue;
    const value = await adapter({
      fieldName: field.name,
      field,
      sector: context.sector,
      activity: context.activity,
      city: context.city,
      country: context.country,
      userId: context.userId,
      context
    });
    if (value) {
      candidates.push({
        source: sourceName,
        value: value.value,
        confidence: value.confidence || 50,
        sourceDetail: value.source || sourceName,
        timestamp: value.timestamp || new Date().toISOString()
      });
    }
  }

  if (candidates.length === 0) return null;

  // Pick highest-confidence candidate.
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];

  let mode = 'ask';
  if (best.confidence >= 80) mode = 'auto';
  else if (best.confidence >= 50) mode = 'suggest';

  return {
    field: field.name,
    value: best.value,
    confidence: best.confidence,
    grade: gradeConfidence(best.confidence),
    mode,
    source: best.source,
    sourceDetail: best.sourceDetail,
    alternatives: candidates.slice(1),
    timestamp: best.timestamp,
    verification: best.verification || null,
    evidence: best.evidence || null
  };
}

async function populate(form, context = {}) {
  const populated = [];
  const manual = [];

  for (const field of form.fields) {
    if (field.calculated || field.hidden) continue;
    const result = await populateField(field, {
      ...context,
      sector: form.sector
    });
    if (result) {
      populated.push(result);
      field.value = result.value;
      field.populated = true;
      field.populationSource = result.source;
      field.confidence = result.confidence;
      field.populationMode = result.mode;
    } else {
      manual.push(field.name);
    }
  }

  const overallConfidence = populated.length
    ? populated.reduce((sum, p) => sum + p.confidence, 0) / populated.length
    : 0;

  return {
    sector: form.sector,
    populated,
    manual,
    overallConfidence: Math.round(overallConfidence),
    overallGrade: gradeConfidence(overallConfidence)
  };
}

module.exports = {
  populate,
  populateField,
  SOURCE_ADAPTERS,
  SOURCE_ORDER,
  setFabric
};
