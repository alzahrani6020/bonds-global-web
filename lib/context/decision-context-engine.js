/**
 * BONDS Decision Context Engine
 *
 * Applies a decision context (financing, investment, sale, etc.) to a semantic profile.
 * Modifies field weights, required formulas, confidence thresholds and report template.
 */

const CONTEXTS = {
  financing: {
    id: 'financing',
    names: { ar: 'تمويل', en: 'Financing' },
    aliases: ['finance', 'loan', 'funding', 'تمويل', 'قرض'],
    fieldWeights: {
      dscr: 2,
      ltv: 2,
      cash_flow: 2,
      collateral: 2,
      revenue: 1,
      net_profit: 1
    },
    confidenceThreshold: 80,
    requiredEngines: ['financing', 'risk', 'valuation'],
    reportTemplate: 'financing'
  },
  investment: {
    id: 'investment',
    names: { ar: 'استثمار', en: 'Investment' },
    aliases: ['invest', 'investment', 'استثمار', 'استثمر'],
    fieldWeights: {
      annual_revenue: 2,
      net_profit: 2,
      ebitda: 2,
      growth_rate: 2,
      total_assets: 1,
      total_liabilities: 1
    },
    confidenceThreshold: 75,
    requiredEngines: ['feasibility', 'valuation', 'risk', 'simulation'],
    reportTemplate: 'investment_memo'
  },
  purchase: {
    id: 'purchase',
    names: { ar: 'شراء', en: 'Purchase' },
    aliases: ['buy', 'purchase', 'acquire', 'شراء', 'اقتناء'],
    fieldWeights: {
      market_value: 2,
      comparables: 2,
      condition_score: 1,
      location: 1
    },
    confidenceThreshold: 80,
    requiredEngines: ['valuation', 'market', 'risk'],
    reportTemplate: 'valuation'
  },
  sale: {
    id: 'sale',
    names: { ar: 'بيع', en: 'Sale' },
    aliases: ['sell', 'sale', 'disposal', 'بيع', 'تصفية'],
    fieldWeights: {
      market_value: 2,
      demand: 2,
      liquidity: 1,
      condition_score: 1
    },
    confidenceThreshold: 75,
    requiredEngines: ['valuation', 'market'],
    reportTemplate: 'valuation'
  },
  expansion: {
    id: 'expansion',
    names: { ar: 'توسع', en: 'Expansion' },
    aliases: ['expand', 'growth', 'scale', 'توسع', 'نمو'],
    fieldWeights: {
      capacity: 2,
      market_size: 2,
      incremental_revenue: 2,
      capex: 1
    },
    confidenceThreshold: 70,
    requiredEngines: ['feasibility', 'market', 'simulation'],
    reportTemplate: 'feasibility'
  },
  restructuring: {
    id: 'restructuring',
    names: { ar: 'إعادة هيكلة', en: 'Restructuring' },
    aliases: ['restructure', 'restructuring', 'إعادة هيكلة', 'هيكلة'],
    fieldWeights: {
      debt: 2,
      cash_flow: 2,
      ebitda: 2,
      liabilities: 1
    },
    confidenceThreshold: 75,
    requiredEngines: ['financing', 'risk', 'valuation'],
    reportTemplate: 'restructuring'
  },
  liquidation: {
    id: 'liquidation',
    names: { ar: 'تصفية', en: 'Liquidation' },
    aliases: ['liquidate', 'liquidation', 'تصفية', 'إفلاس'],
    fieldWeights: {
      asset_value: 2,
      liabilities: 2,
      recovery_rate: 2,
      market_value: 1
    },
    confidenceThreshold: 80,
    requiredEngines: ['valuation', 'risk', 'distressed_recovery'],
    reportTemplate: 'distressed_recovery'
  },
  merger: {
    id: 'merger',
    names: { ar: 'اندماج', en: 'Merger' },
    aliases: ['merge', 'merger', 'اندماج'],
    fieldWeights: {
      revenue: 2,
      ebitda: 2,
      synergies: 2,
      market_share: 1
    },
    confidenceThreshold: 75,
    requiredEngines: ['valuation', 'risk', 'simulation'],
    reportTemplate: 'valuation'
  },
  acquisition: {
    id: 'acquisition',
    names: { ar: 'استحواذ', en: 'Acquisition' },
    aliases: ['acquire', 'acquisition', 'استحواذ', 'شراء شركة'],
    fieldWeights: {
      revenue: 2,
      ebitda: 2,
      growth_rate: 2,
      liabilities: 1,
      assets: 1
    },
    confidenceThreshold: 80,
    requiredEngines: ['valuation', 'risk', 'simulation', 'market'],
    reportTemplate: 'valuation'
  }
};

function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

function detectContext(input, context = {}) {
  const text = normalize(input || context.context || context.decision_context);
  if (!text && !context.intent) return null;

  let best = null;
  let bestScore = 0;

  for (const key of Object.keys(CONTEXTS)) {
    const ctx = CONTEXTS[key];
    let score = 0;
    for (const alias of ctx.aliases) {
      const aliasNorm = normalize(alias);
      if (text.includes(aliasNorm)) {
        score = Math.max(score, aliasNorm.length / Math.max(text.length, 1) + 0.2);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = ctx;
    }
  }

  if (!best && context.intent) {
    const intentMap = {
      request_financing: 'financing',
      buy_asset: 'purchase',
      sell_asset: 'sale',
      feasibility: 'investment',
      value_asset: 'investment'
    };
    if (intentMap[context.intent]) {
      best = CONTEXTS[intentMap[context.intent]];
      bestScore = 0.5;
    }
  }

  if (!best) return null;

  return {
    context: best.id,
    names: best.names,
    confidence: Math.min(Math.round(bestScore * 100), 100),
    fieldWeights: best.fieldWeights,
    confidenceThreshold: best.confidenceThreshold,
    requiredEngines: best.requiredEngines,
    reportTemplate: best.reportTemplate
  };
}

function applyContext(profile, contextResult) {
  if (!profile || !contextResult) return profile;
  const ctx = CONTEXTS[contextResult.context];
  if (!ctx) return profile;

  const weightedFields = (profile.defaultFields || []).map(field => {
    const weight = ctx.fieldWeights[field.name] || 1;
    return {
      ...field,
      weight,
      required: weight >= 2 ? true : field.required
    };
  });

  return {
    ...profile,
    defaultFields: weightedFields,
    confidenceThreshold: ctx.confidenceThreshold,
    requiredEngines: Array.from(new Set([...(profile.defaultEngines || []), ...ctx.requiredEngines])),
    reportTemplate: ctx.reportTemplate
  };
}

function getContext(contextId) {
  return CONTEXTS[contextId] || null;
}

function listContexts() {
  return Object.keys(CONTEXTS).map(k => CONTEXTS[k]);
}

module.exports = {
  CONTEXTS,
  detectContext,
  applyContext,
  getContext,
  listContexts
};
