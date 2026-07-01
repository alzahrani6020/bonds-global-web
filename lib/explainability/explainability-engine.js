/**
 * BONDS Explainability Engine
 *
 * Generates human-readable explanations for any system decision or output.
 */

function formatCurrency(value, currency = 'SAR') {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return `${n.toLocaleString('en-US')} ${currency}`;
}

function explain(result = {}, options = {}) {
  const { language = 'ar', currency = 'SAR' } = options;
  const isAr = language === 'ar';

  const why = result.reason || (isAr ? 'القرار مبني على البيانات والقواعد المُدخلة.' : 'Decision is based on provided data and rules.');
  const basedOn = (result.inputs || []).map(input => ({
    field: input.name || input.field,
    value: input.unit === 'currency' ? formatCurrency(input.value, currency) : input.value,
    source: input.source || 'user'
  }));

  const evidence = (result.evidence || []).map(e => ({
    source: e.source,
    value: e.value,
    confidence: e.confidence,
    date: e.timestamp || e.date
  }));

  const assumptions = result.assumptions || (isAr
    ? ['البيانات صحيحة وفعلية', 'لا يوجد تغييرات سوقية كبيرة غير متوقعة']
    : ['Data is accurate and actual', 'No major unforeseen market changes']);

  const risks = result.risks || (isAr
    ? ['تقلبات أسعار السوق', 'تغيرات تنظيمية']
    : ['Market price volatility', 'Regulatory changes']);

  const alternatives = result.alternatives || [];

  return {
    language,
    summary: isAr ? `النتيجة: ${result.value}` : `Result: ${result.value}`,
    why,
    basedOn,
    evidence,
    assumptions,
    risks,
    alternatives,
    confidence: result.confidence || 0,
    grade: result.grade || 'F',
    recommendation: result.recommendation || (isAr ? 'تابع المراجعة' : 'Proceed with review')
  };
}

function explainDecision(decisionId, context = {}, result = {}) {
  const templates = {
    ar: {
      certificate: 'تم رفض إصدار الشهادة بسبب انخفاض درجة الثقة أو عدم اعتماد التقرير.',
      financing: 'تم تحذير التمويل لأن مؤشر DSCR أقل من 1.25.',
      valuation: 'تم اختيار منهجية التقييم بناءً على فئة الأصل.'
    },
    en: {
      certificate: 'Certificate issuance rejected due to low confidence or unapproved report.',
      financing: 'Financing flagged because DSCR is below 1.25.',
      valuation: 'Valuation method selected based on asset class.'
    }
  };
  const lang = context.language || 'ar';
  const reason = templates[lang][decisionId] || templates[lang].valuation;
  return explain({ ...result, reason, inputs: context.inputs }, { language: lang, currency: context.currency });
}

module.exports = {
  explain,
  explainDecision,
  formatCurrency
};
