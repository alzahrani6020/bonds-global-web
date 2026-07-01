/**
 * BONDS Adaptive Recommendation Engine
 *
 * Generates recommendations that adapt to the user's Decision Profile,
 * project context, business rules, live data and confidence scores.
 */

const rulesEngine = require('../rules/business-rules-engine');
const { combineConfidence, gradeConfidence } = require('../confidence/confidence-engine');
const { explain } = require('../explainability/explainability-engine');

function generateRecommendations({
  sector,
  country,
  assetType,
  decisionType,
  liveData = {},
  decisionProfile,
  contextMemory,
  language = 'ar'
}) {
  const recommendations = [];

  // Sector-specific recommendation
  const sectorRec = buildSectorRecommendation(sector, country, liveData, language);
  if (sectorRec) recommendations.push(sectorRec);

  // Decision-type recommendation
  const decisionRec = buildDecisionRecommendation(decisionType, liveData, language);
  if (decisionRec) recommendations.push(decisionRec);

  // Data-source recommendation based on profile
  if (decisionProfile) {
    const sourceRec = buildDataSourceRecommendation(decisionProfile, sector, language);
    if (sourceRec) recommendations.push(sourceRec);
  }

  // Context-memory recommendation
  if (contextMemory) {
    const contextRec = buildContextRecommendation(contextMemory, language);
    if (contextRec) recommendations.push(contextRec);
  }

  // Apply business rules and confidence
  const scored = recommendations.map(rec => {
    const ruleResult = rulesEngine.evaluateAll(rec.requiredRules || [], rec.ruleContext || {});
    const confidence = combineConfidence(
      [rec.baseConfidence, ruleResult.passed ? 80 : 40],
      [2, 1]
    );
    return {
      ...rec,
      confidence,
      grade: gradeConfidence(confidence),
      valid: ruleResult.passed,
      ruleFailures: ruleResult.failures
    };
  }).filter(r => r.valid);

  scored.sort((a, b) => b.confidence - a.confidence);

  return {
    language,
    sector,
    decisionType,
    recommendations: scored,
    explanation: explain({
      value: scored.length ? scored[0].title : null,
      confidence: scored.length ? scored[0].confidence : 0,
      reason: language === 'ar' ? 'التوصيات مبنية على القطاع والسياق والبيانات الحية.' : 'Recommendations based on sector, context and live data.',
      inputs: [
        { name: 'sector', value: sector },
        { name: 'country', value: country },
        { name: 'decisionType', value: decisionType }
      ],
      evidence: scored.map(r => ({ source: r.source, value: r.title, confidence: r.confidence }))
    }, { language })
  };
}

function buildSectorRecommendation(sector, country, liveData, language) {
  const isAr = language === 'ar';
  const templates = {
    restaurant: {
      title: isAr ? 'راجع تكلفة الطعام مقابل المتوسط السوقي' : 'Review food cost vs market average',
      action: isAr ? 'تحقق من نسبة Food Cost' : 'Check Food Cost ratio',
      source: 'sector_benchmark',
      baseConfidence: 72,
      requiredRules: ['BR-SECTOR-002'],
      ruleContext: { sector }
    },
    manufacturing: {
      title: isAr ? 'قم بتحليل خطوط الإنتاج والطاقة الاستيعابية' : 'Analyze production lines and capacity',
      action: isAr ? 'أدخل تفاصيل خطوط الإنتاج' : 'Enter production line details',
      source: 'sector_benchmark',
      baseConfidence: 70,
      requiredRules: ['BR-SECTOR-003'],
      ruleContext: { sector }
    },
    hotel: {
      title: isAr ? 'راقب معدل الإشغال والـ ADR' : 'Monitor occupancy and ADR',
      action: isAr ? 'قارن بفنادق مماثلة' : 'Compare with similar hotels',
      source: 'market_data',
      baseConfidence: 68,
      requiredRules: [],
      ruleContext: { sector }
    },
    company: {
      title: isAr ? 'راجع معدل النمو وهوامش الربح' : 'Review growth rate and margins',
      action: isAr ? 'تحقق من EBITDA والنمو' : 'Check EBITDA and growth',
      source: 'financial_data',
      baseConfidence: 65,
      requiredRules: [],
      ruleContext: { sector }
    }
  };
  return templates[sector] || null;
}

function buildDecisionRecommendation(decisionType, liveData, language) {
  const isAr = language === 'ar';
  const templates = {
    request_financing: {
      title: isAr ? 'تأكد من استيفاء شروط DSCR و LTV' : 'Ensure DSCR and LTV requirements are met',
      action: isAr ? 'أدخل بيانات التدفقات النقدية' : 'Enter cash flow data',
      source: 'business_rules',
      baseConfidence: 78,
      requiredRules: ['BR-FIN-001', 'BR-FIN-002'],
      ruleContext: { dscr: liveData.dscr, ltv: liveData.ltv }
    },
    value_asset: {
      title: isAr ? 'استخدم منهجية التقييم المناسبة للأصل' : 'Use appropriate valuation method for the asset',
      action: isAr ? 'اختر Market / Income / Cost' : 'Choose Market / Income / Cost',
      source: 'business_rules',
      baseConfidence: 80,
      requiredRules: ['BR-VAL-001'],
      ruleContext: { asset_class: liveData.asset_class }
    },
    feasibility: {
      title: isAr ? 'قم بتحليل السيناريوهات المتفائلة والمتشائمة' : 'Run optimistic and pessimistic scenarios',
      action: isAr ? 'أنشئ سيناريوهات متعددة' : 'Create multiple scenarios',
      source: 'simulation',
      baseConfidence: 60,
      requiredRules: [],
      ruleContext: {}
    }
  };
  return templates[decisionType] || null;
}

function buildDataSourceRecommendation(decisionProfile, sector, language) {
  const isAr = language === 'ar';
  const topSources = decisionProfile.topDataSources ? decisionProfile.topDataSources(3) : [];
  if (!topSources.length) return null;
  return {
    title: isAr ? `فضل مصادر البيانات التي تثق بها: ${topSources[0].source}` : `Prefer trusted data sources: ${topSources[0].source}`,
    action: isAr ? 'استخدم مصادر موثوقة' : 'Use trusted sources',
    source: 'decision_profile',
    baseConfidence: 75,
    requiredRules: ['BR-DATA-001'],
    ruleContext: { source_confidence: 'A' }
  };
}

function buildContextRecommendation(contextMemory, language) {
  const isAr = language === 'ar';
  const recent = (contextMemory.recent_entities || contextMemory.recentEntities || []).slice(0, 1)[0];
  if (!recent) return null;
  return {
    title: isAr ? `استكمل العمل على ${recent.type} الأخير` : `Continue working on last ${recent.type}`,
    action: isAr ? 'استئناف من آخر نقطة' : 'Resume from last point',
    source: 'context_memory',
    baseConfidence: 70,
    requiredRules: [],
    ruleContext: {}
  };
}

module.exports = {
  generateRecommendations,
  buildSectorRecommendation,
  buildDecisionRecommendation,
  buildDataSourceRecommendation,
  buildContextRecommendation
};
