/**
 * Bonds V3 — AI Insights Engine
 *
 * Generates contextual investment insights based on financial calculations,
 * risk scores, and city-level market data.
 * Optionally enriched by an LLM if OPENAI_API_KEY is configured.
 */

const { generateLLMInsights, buildPrompt } = require('./llm');

function verdict(summary, risk) {
  if (summary.npv <= 0 || summary.irr < 10) return 'avoid';
  if (risk.score > 65 || summary.paybackMonths > 48) return 'consider';
  if (summary.irr > 20 && risk.score < 50 && summary.dscr > 1.5) return 'invest';
  return 'consider';
}

function buildKeyStrengths(summary, risk, marketData) {
  const strengths = [];

  if (summary.irr > 20) strengths.push('عائد داخلي مرتفع يتجاوز 20%');
  if (summary.npv > 0) strengths.push('صافي القيمة الحالية إيجابي');
  if (summary.paybackMonths && summary.paybackMonths <= 30) strengths.push('فترة استرداد قصيرة نسبياً');
  if (summary.dscr > 1.5) strengths.push('قدرة جيدة على تغطية أقساط القرض');
  if (risk.score < 45) strengths.push('مستوى مخاطر منخفض');

  if (marketData) {
    if (marketData.purchasing_power_index > 90) strengths.push('القوة الشرائية للمدينة مرتفعة');
    if (marketData.labor_availability_score > 70) strengths.push('توفر العمالة جيد في المدينة');
  }

  return strengths;
}

function buildKeyRisks(summary, risk, marketData) {
  const risks = [];

  if (summary.paybackMonths && summary.paybackMonths > 42) risks.push('فترة استرداد رأس المال طويلة');
  if (summary.dscr && summary.dscr < 1.25) risks.push('قدرة ضعيفة على تغطية أقساط القرض');
  if (risk.score > 55) risks.push('مستوى المخاطر مرتفع');

  if (marketData) {
    if (marketData.market_saturation_score > 70) risks.push('السوق يعاني من إشباع عالٍ');
    if (marketData.labor_availability_score < 50) risks.push('توفر العمالة منخفض في المدينة');
    if (marketData.avg_rent_per_sqm > 2000) risks.push('تكاليف الإيجار مرتفعة في المدينة');
  }

  return risks;
}

function cityInsight(marketData, cityName) {
  if (!marketData || !cityName) return null;

  const parts = [];

  if (marketData.purchasing_power_index >= 95) {
    parts.push(`تتمتع ${cityName} بقوة شرائية مرتفعة`);
  } else if (marketData.purchasing_power_index <= 75) {
    parts.push(`القوة الشرائية في ${cityName} محدودة`);
  }

  if (marketData.market_saturation_score >= 70) {
    parts.push('لكن المنافسة شديدة');
  } else if (marketData.market_saturation_score <= 40) {
    parts.push('مع فرصة جيدة بسبب قلة المنافسة');
  }

  return parts.length > 0 ? parts.join('، ') + '.' : null;
}

function nextSteps(verdict) {
  if (verdict === 'invest') {
    return [
      'إعداد دراسة جدوى تفصيلية',
      'البحث عن موقع مناسب',
      'التواصل مع البنوك لترتيب التمويل',
      'تسجيل النشاط التجاري والحصول على التراخيص'
    ];
  }

  if (verdict === 'consider') {
    return [
      'إعادة النظر في بعض الافتراضات المالية',
      'دراسة مدن أخرى أقل تشبعاً',
      'البحث عن طرق لتقليل رأس المال أو التكاليف التشغيلية',
      'تقييم المخاطر الرئيسية قبل اتخاذ القرار'
    ];
  }

  return [
    'إعادة النظر في جدوى الفكرة أساساً',
    'دراسة نماذج مشاريع بديلة',
    'البحث عن فرص بتكلفة أقل أو سوق أقل تشبعاً'
  ];
}

async function generateInsights(result, marketData = null, cityName = null) {
  const v = verdict(result.summary, result.risk);
  const strengths = buildKeyStrengths(result.summary, result.risk, marketData);
  const risks = buildKeyRisks(result.summary, result.risk, marketData);
  const city = cityInsight(marketData, cityName);

  const verdictLabels = {
    invest: 'استثمر',
    consider: 'فكر فيه',
    avoid: 'تجنب'
  };

  const recommendationParts = [];

  if (v === 'invest') {
    recommendationParts.push('المشروع يبدو جذاباً من الناحية المالية والسوقية');
  } else if (v === 'consider') {
    recommendationParts.push('المشروع يحمل إمكانيات لكنه يحتاج إلى دراسة أعمق');
  } else {
    recommendationParts.push('المشروع غير مشجع حالياً من الناحية المالية');
  }

  if (result.summary.paybackMonths) {
    recommendationParts.push(`فترة الاسترداد المتوقعة ${result.summary.paybackMonths} شهراً.`);
  }

  if (city) recommendationParts.push(city);

  const baseInsights = {
    verdict: v,
    verdictLabel: verdictLabels[v],
    recommendation: recommendationParts.join(' '),
    strengths,
    risks,
    cityInsight: city,
    nextSteps: nextSteps(v),
    llm_enriched: false
  };

  // Optional LLM enrichment
  const prompt = buildPrompt(result, marketData, cityName);
  const llm = await generateLLMInsights(prompt);

  if (llm) {
    return {
      ...baseInsights,
      llm: {
        executiveSummary: llm.executive_summary,
        strengths: llm.strengths,
        concerns: llm.concerns,
        recommendation: llm.recommendation,
        actionItems: llm.action_items
      },
      llm_enriched: true
    };
  }

  return baseInsights;
}

function compareModels(results) {
  return results
    .map(r => ({
      model: r.model,
      score: (
        (r.summary.irr || 0) * 0.35 +
        (r.summary.npv > 0 ? Math.min(r.summary.npv / 100000, 10) : 0) * 0.25 +
        (r.summary.paybackMonths ? Math.max(0, 60 - r.summary.paybackMonths) / 60 * 25 : 0) +
        (100 - r.risk.score) * 0.15
      ),
      summary: r.summary,
      risk: r.risk
    }))
    .sort((a, b) => b.score - a.score);
}

function rankCities(cityData) {
  return cityData
    .map(c => ({
      city: c.name,
      score: (
        (c.purchasing_power_index || 0) * 0.35 -
        (c.market_saturation_score || 0) * 0.30 -
        ((c.avg_rent_per_sqm || 0) / 100) * 0.20 +
        (c.labor_availability_score || 0) * 0.15
      )
    }))
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  generateInsights,
  compareModels,
  rankCities,
  verdict
};
