/**
 * BONDS Intent Engine
 *
 * Detects the user's intent from natural language or context.
 * Maps each intent to the engines, data and reports needed.
 */

const INTENTS = {
  buy_asset: {
    id: 'buy_asset',
    names: { ar: 'شراء أصل', en: 'Buy Asset' },
    keywords: ['buy', 'purchase', 'acquire', 'شراء', 'اقتناء', 'استحواذ', 'تملك'],
    engines: ['valuation', 'financing', 'risk', 'market'],
    data: ['asset_class', 'location', 'market_price', 'comparables'],
    report: 'valuation',
    requiredTier: 'free'
  },
  sell_asset: {
    id: 'sell_asset',
    names: { ar: 'بيع أصل', en: 'Sell Asset' },
    keywords: ['sell', 'sale', 'dispose', 'بيع', 'تصفية', 'تخارج'],
    engines: ['valuation', 'market', 'risk'],
    data: ['asset_class', 'location', 'market_price', 'demand'],
    report: 'valuation',
    requiredTier: 'free'
  },
  value_asset: {
    id: 'value_asset',
    names: { ar: 'تقييم أصل', en: 'Value Asset' },
    keywords: ['value', 'valuation', 'appraise', 'worth', 'تقييم', 'قيمة', 'تثمين'],
    engines: ['valuation', 'knowledge', 'confidence'],
    data: ['asset_class', 'location', 'condition', 'income', 'comparables'],
    report: 'valuation',
    requiredTier: 'free'
  },
  request_financing: {
    id: 'request_financing',
    names: { ar: 'طلب تمويل', en: 'Request Financing' },
    keywords: ['finance', 'financing', 'loan', 'funding', 'mortgage', 'تمويل', 'قرض', 'سلفة'],
    engines: ['financing', 'risk', 'valuation'],
    data: ['project_value', 'cash_flow', 'collateral', 'dscr', 'ltv'],
    report: 'financing',
    requiredTier: 'pro'
  },
  feasibility: {
    id: 'feasibility',
    names: { ar: 'دراسة جدوى', en: 'Feasibility Study' },
    keywords: ['feasibility', 'study', 'جدوى', 'دراسة', 'economic', 'اقتصادية'],
    engines: ['feasibility', 'market', 'risk', 'knowledge'],
    data: ['sector', 'location', 'investment', 'revenue', 'costs'],
    report: 'feasibility',
    requiredTier: 'free'
  },
  market_analysis: {
    id: 'market_analysis',
    names: { ar: 'تحليل سوق', en: 'Market Analysis' },
    keywords: ['market', 'analysis', 'industry', 'سوق', 'تحليل', 'قطاع'],
    engines: ['market', 'knowledge', 'live_data'],
    data: ['sector', 'location', 'competitors', 'demand', 'supply'],
    report: 'market',
    requiredTier: 'pro'
  },
  risk_analysis: {
    id: 'risk_analysis',
    names: { ar: 'تحليل مخاطر', en: 'Risk Analysis' },
    keywords: ['risk', 'risks', 'مخاطر', 'خطر', 'تحليل مخاطر'],
    engines: ['risk', 'market', 'knowledge'],
    data: ['sector', 'location', 'financials', 'market_data'],
    report: 'risk',
    requiredTier: 'pro'
  },
  issue_certificate: {
    id: 'issue_certificate',
    names: { ar: 'إصدار شهادة', en: 'Issue Certificate' },
    keywords: ['certificate', 'bdvc', ' certify', 'شهادة', 'اعتماد'],
    engines: ['valuation', 'certificate', 'evidence', 'confidence'],
    data: ['valuation_id', 'confidence_score', 'data_quality_score', 'report_approval'],
    report: 'certificate',
    requiredTier: 'pro'
  },
  create_report: {
    id: 'create_report',
    names: { ar: 'إنشاء تقرير', en: 'Create Report' },
    keywords: ['report', 'generate report', 'تقرير', 'تقارير', 'إصدار تقرير'],
    engines: ['report', 'evidence', 'ai'],
    data: ['project_id', 'report_type', 'language'],
    report: 'report',
    requiredTier: 'free'
  },
  compare_scenarios: {
    id: 'compare_scenarios',
    names: { ar: 'مقارنة سيناريوهات', en: 'Compare Scenarios' },
    keywords: ['compare', 'scenario', 'scenarios', 'سيناريو', 'سيناريوهات', 'مقارنة'],
    engines: ['simulation', 'decision_graph', 'recommendation'],
    data: ['scenarios', 'metrics'],
    report: 'comparison',
    requiredTier: 'pro'
  },
  revalue: {
    id: 'revalue',
    names: { ar: 'إعادة تقييم', en: 'Revalue' },
    keywords: ['revalue', 're-evaluation', 'update value', 'إعادة تقييم', 'تحديث القيمة'],
    engines: ['valuation', 'live_data', 'confidence'],
    data: ['previous_valuation_id', 'new_data'],
    report: 'valuation',
    requiredTier: 'pro'
  },
  review_report: {
    id: 'review_report',
    names: { ar: 'مراجعة تقرير', en: 'Review Report' },
    keywords: ['review', 'revise', 'feedback', 'مراجعة', 'تدقيق', 'تصحيح'],
    engines: ['ai', 'evidence'],
    data: ['report_id', 'comments'],
    report: 'review',
    requiredTier: 'pro'
  }
};

function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

function detectIntent(input, context = {}) {
  const hasContext = !!(context.sector || context.project_type || context.action || context.intent);
  if (!input && !hasContext) return null;
  const text = normalize(input || context.intent);

  let best = null;
  let bestScore = 0;

  for (const key of Object.keys(INTENTS)) {
    const intent = INTENTS[key];
    let score = 0;
    for (const kw of intent.keywords) {
      const kwNorm = normalize(kw);
      if (text.includes(kwNorm)) {
        // Longer keyword match scores higher.
        score = Math.max(score, kwNorm.length / Math.max(text.length, 1) + 0.2);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }

  // Context hints
  if (!best && context.action) {
    const actionNorm = normalize(context.action);
    if (actionNorm.includes('buy') || actionNorm.includes('purchase') || actionNorm.includes('شراء')) best = INTENTS.buy_asset;
    if (actionNorm.includes('sell') || actionNorm.includes('بيع')) best = INTENTS.sell_asset;
    if (actionNorm.includes('finance') || actionNorm.includes('تمويل')) best = INTENTS.request_financing;
    if (actionNorm.includes('value') || actionNorm.includes('تقييم')) best = INTENTS.value_asset;
    if (actionNorm.includes('feasibility') || actionNorm.includes('جدوى')) best = INTENTS.feasibility;
    if (best) bestScore = 0.5;
  }

  if (!best) {
    // Default to feasibility for project-like inputs.
    if (context.sector || context.project_type) {
      best = INTENTS.feasibility;
      bestScore = 0.3;
    }
  }

  if (!best) return null;

  return {
    intent: best.id,
    confidence: Math.min(Math.round(bestScore * 100), 100),
    names: best.names,
    engines: best.engines,
    requiredData: best.data,
    reportType: best.report,
    requiredTier: best.requiredTier
  };
}

function getIntent(intentId) {
  return INTENTS[intentId] || null;
}

function listIntents() {
  return Object.keys(INTENTS).map(k => INTENTS[k]);
}

module.exports = {
  INTENTS,
  detectIntent,
  getIntent,
  listIntents
};
