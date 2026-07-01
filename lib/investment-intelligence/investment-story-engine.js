/**
 * BONDS Investment Intelligence — Investment Story Engine
 *
 * Builds the narrative that answers the seven investor questions:
 *   Why this project? Why now? Why this market? Why this team?
 *   Why this opportunity? Why this valuation? Why this funding?
 *
 * Uses the AI Orchestrator when available; falls back to rule-based
 * narrative when offline.
 */

const { analyze } = require('../ai/orchestrator');

function safeValue(obj, path, fallback = '') {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
}

function formatCurrency(value, currency = 'SAR') {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${n.toLocaleString('en-US')} ${currency}`;
}

class InvestmentStoryEngine {
  constructor(context, options = {}) {
    this.context = context;
    this.options = options;
  }

  async generate() {
    const { project, city, ucpResult } = this.context;
    const language = this.options.language || project.language || 'ar';
    const outputs = ucpResult?.outputs || {};
    const risk = ucpResult?.engineResults?.risk || {};
    const feasibility = ucpResult?.engineResults?.feasibility || {};
    const valuation = ucpResult?.engineResults?.valuation || {};

    const payload = {
      project_name: project.name,
      sector: project.sector,
      city: city?.name_en || city?.name_ar || project.city_id,
      country: city?.country_code || 'SA',
      revenue: safeValue(outputs, 'annual_revenue.value', project.revenue),
      profit: project.annual_profit,
      investment: project.capital,
      valuation: valuation.value,
      irr: feasibility.irr,
      npv: feasibility.npv,
      payback: feasibility.payback,
      dscr: safeValue(outputs, 'dscr.value', ucpResult?.engineResults?.financing?.dscr),
      risk_grade: risk.risk_grade,
      confidence: ucpResult ? Math.round((ucpResult.confidence || 0) * 100) : 0,
      language
    };

    let story = null;
    let aiReviewed = false;

    if (this.options.useAi !== false) {
      try {
        const result = await analyze({
          userId: this.options.userId,
          projectId: project.id,
          type: 'investment_story',
          payload,
          model: this.options.model
        });
        story = result.result?.story || result.result;
        aiReviewed = true;
      } catch (err) {
        console.warn('[investment-story-engine] AI story failed, using fallback:', err.message);
      }
    }

    if (!story) {
      story = this._fallbackStory(payload, language);
    }

    return {
      output: story,
      confidence: payload.confidence,
      evidence: [
        { source: aiReviewed ? 'ai_orchestrator' : 'rule_based', evidence_type: 'narrative', evidence_code: 'investment_story', value: 'seven whys', confidence: payload.confidence, reason: 'Narrative built from UCP outputs' }
      ],
      engine: 'investment_story',
      status: 'ok'
    };
  }

  _fallbackStory(payload, language) {
    const isAr = language === 'ar';
    const n = (v) => formatCurrency(v, payload.country === 'SA' ? 'SAR' : 'USD');

    return {
      summary: isAr
        ? `${payload.project_name} فرصة استثمارية في قطاع ${payload.sector} تستهدف ${payload.city}، مع مؤشرات مالية أولية تدعم دراسة الجدوى.`
        : `${payload.project_name} is an investment opportunity in the ${payload.sector} sector targeting ${payload.city}, with initial financial indicators supporting feasibility.`,
      whyThisProject: isAr
        ? `المشروع يجمع بين رأس مال مبدئي ${n(payload.investment)} وإيرادات متوقعة ${n(payload.revenue)}، مما يوفر أساساً مالياً واضحاً للتقييم.`
        : `The project combines an initial investment of ${n(payload.investment)} with expected revenue of ${n(payload.revenue)}, providing a clear financial basis for valuation.`,
      whyNow: isAr
        ? `البيانات الحالية تظهر فرصة سوقية في ${payload.city}، ودخول السوق الآن يتيح الاستفادة من البيانات المتاحة قبل تغير الظروف.`
        : `Current data shows a market opportunity in ${payload.city}, and entering now allows capturing available data before conditions change.`,
      whyThisMarket: isAr
        ? `السوق المستهدف يتوافق مع حجم الإيرادات المتوقعة ومؤشرات الطلب في المنطقة، مع تقييم مخاطر ${payload.risk_grade || 'C'}.`
        : `The target market aligns with expected revenue and demand indicators in the region, with a risk grade of ${payload.risk_grade || 'C'}.`,
      whyThisTeam: isAr
        ? `يعتمد المستند على بيانات المنصة الموثقة؛ يُنصح بإضافة ملف الفريق لزيادة ثقة المستثمر.`
        : `This document relies on verified platform data; adding a team profile is recommended to increase investor confidence.`,
      whyThisOpportunity: isAr
        ? `الفرصة تكمن في تحقيق عائد يتناسب مع رأس المال المستثمر، مدعومة بحسابات UCP وتحليل المخاطر.`
        : `The opportunity lies in achieving a return commensurate with the invested capital, supported by UCP calculations and risk analysis.`,
      whyThisValuation: isAr
        ? `التقييم ${n(payload.valuation)} مستمد من منصة التقييم الموحدة UCP ومنهجيات السوق المتاحة.`
        : `The valuation of ${n(payload.valuation)} is derived from the Unified Calculation Platform and available market methodologies.`,
      whyThisFunding: isAr
        ? `متطلبات التمويل مبنية على رأس المال المبدئي وهيكل التمويل المسجل، مع مؤشرات السداد عند توفرها.`
        : `Funding requirements are based on initial capital and recorded financing structure, with repayment indicators where available.`
    };
  }
}

module.exports = { InvestmentStoryEngine };
