/**
 * BONDS Investment Intelligence — Investment Memorandum Engine
 *
 * Generates the full structure of an investment memorandum from platform data.
 * No financial calculations are performed here; all numbers come from UCP
 * outputs, valuation, financing, and the Trusted Data Fabric.
 */

const { InvestmentReadinessEngine } = require('./investment-readiness-engine');
const { InvestmentStoryEngine } = require('./investment-story-engine');

function safeNumber(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(decimals));
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtCurrency(value, currency = 'SAR') {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `${n.toLocaleString('en-US')} ${currency}`;
}

class InvestmentMemorandumEngine {
  constructor(context, options = {}) {
    this.context = context;
    this.options = options;
    this.language = options.language || context.project?.language || 'ar';
    this.currency = options.currency || context.project?.currency || 'SAR';
    this.isAr = this.language === 'ar';
  }

  async generate() {
    const { project, city, ucpResult } = this.context;
    const outputs = ucpResult?.outputs || {};
    const engineResults = ucpResult?.engineResults || {};
    const valuation = engineResults.valuation || {};
    const feasibility = engineResults.feasibility || {};
    const financing = engineResults.financing || {};
    const risk = engineResults.risk || {};
    const scenarios = ucpResult?.scenarios || [];

    const readinessEngine = new InvestmentReadinessEngine(this.context);
    const readiness = readinessEngine.evaluate();

    const storyEngine = new InvestmentStoryEngine(this.context, {
      language: this.language,
      userId: this.options.userId,
      useAi: this.options.useAi
    });
    const story = await storyEngine.generate();

    const sections = {
      executiveSummary: this._executiveSummary(project, city, valuation, risk, story),
      investmentHighlights: this._investmentHighlights(project, valuation, feasibility, risk),
      problemStatement: this._problemStatement(project, city),
      marketOpportunity: this._marketOpportunity(city, project),
      solution: this._solution(project),
      competitiveAdvantage: this._competitiveAdvantage(project, city),
      businessModel: this._businessModel(project),
      revenueModel: this._revenueModel(project, outputs),
      financialHighlights: this._financialHighlights(outputs, feasibility, financing),
      valuation: this._valuation(valuation, project),
      fundingRequirements: this._fundingRequirements(project, financing),
      useOfFunds: this._useOfFunds(project),
      capitalStructure: this._capitalStructure(financing, project),
      expectedRoi: this._expectedRoi(feasibility),
      irr: this._irr(feasibility),
      npv: this._npv(feasibility),
      riskAnalysis: this._riskAnalysis(risk),
      sensitivityAnalysis: this._sensitivityAnalysis(scenarios),
      swot: this._swot(story, risk, city),
      exitStrategy: this._exitStrategy(feasibility, project),
      roadmap: this._roadmap(project),
      managementTeam: this._managementTeam(),
      appendices: this._appendices(ucpResult)
    };

    const confidence = this._aggregateConfidence(readiness, story, ucpResult);
    const missingItems = readiness.output.missingItems;

    return {
      output: {
        type: this.options.type || 'investment_memorandum',
        language: this.language,
        currency: this.currency,
        projectId: project.id,
        title: this.isAr ? `نشرة استثمارية: ${project.name}` : `Investment Memorandum: ${project.name}`,
        sections,
        readiness: readiness.output,
        story: story.output,
        missingItems
      },
      confidence,
      evidence: this._buildEvidence(ucpResult, readiness, story),
      engine: 'investment_memorandum',
      status: 'ok'
    };
  }

  _t(ar, en) { return this.isAr ? ar : en; }

  _executiveSummary(project, city, valuation, risk, story) {
    return {
      title: this._t('الملخص التنفيذي', 'Executive Summary'),
      text: story.output.summary || this._t(
        `فرصة استثمارية في قطاع ${project.sector} بمدينة ${city?.name_ar || project.city_id || ''}، بتقييم ${fmtCurrency(valuation.value, this.currency)} ومستوى مخاطر ${risk.risk_grade || 'C'}.`,
        `Investment opportunity in the ${project.sector} sector in ${city?.name_en || project.city_id || ''}, with a valuation of ${fmtCurrency(valuation.value, this.currency)} and risk grade ${risk.risk_grade || 'C'}.`
      )
    };
  }

  _investmentHighlights(project, valuation, feasibility, risk) {
    return {
      title: this._t('أبرز نقاط الاستثمار', 'Investment Highlights'),
      bullets: [
        this._t(`التقييم: ${fmtCurrency(valuation.value, this.currency)}`, `Valuation: ${fmtCurrency(valuation.value, this.currency)}`),
        this._t(`الاستثمار المبدئي: ${fmtCurrency(project.capital, this.currency)}`, `Initial Investment: ${fmtCurrency(project.capital, this.currency)}`),
        this._t(`صافي الربح السنوي: ${fmtCurrency(project.annual_profit, this.currency)}`, `Annual Net Profit: ${fmtCurrency(project.annual_profit, this.currency)}`),
        this._t(`معدل العائد الداخلي: ${formatPct(feasibility.irr)}`, `IRR: ${formatPct(feasibility.irr)}`),
        this._t(`درجة المخاطر: ${risk.risk_grade || 'C'}`, `Risk Grade: ${risk.risk_grade || 'C'}`)
      ]
    };
  }

  _problemStatement(project, city) {
    return {
      title: this._t('مشكلة السوق', 'Problem Statement'),
      text: this._t(
        `قطاع ${project.sector} في ${city?.name_ar || ''} يحتاج إلى فرص استثمارية مدروسة تعتمد على بيانات موثوقة وتقييم دقيق.`,
        `The ${project.sector} sector in ${city?.name_en || ''} needs well-researched investment opportunities based on trusted data and accurate valuation.`
      )
    };
  }

  _marketOpportunity(city, project) {
    return {
      title: this._t('الفرصة السوقية', 'Market Opportunity'),
      text: this._t(
        `السوق في ${city?.name_ar || ''} يوفر فرصة لاستيعاب مشروع برأس مال ${fmtCurrency(project.capital, this.currency)} وإيرادات متوقعة ${fmtCurrency(project.revenue, this.currency)}.`,
        `The market in ${city?.name_en || ''} provides an opportunity for a project with capital of ${fmtCurrency(project.capital, this.currency)} and expected revenue of ${fmtCurrency(project.revenue, this.currency)}.`
      )
    };
  }

  _solution(project) {
    return {
      title: this._t('الحل', 'Solution'),
      text: this._t(
        `المشروع يقدم حلاً في قطاع ${project.sector} مع نموذج تشغيلي يعتمد على البيانات المالية المسجلة في المنصة.`,
        `The project delivers a solution in the ${project.sector} sector with an operating model built on the platform's recorded financial data.`
      )
    };
  }

  _competitiveAdvantage(project, city) {
    return {
      title: this._t('الميزة التنافسية', 'Competitive Advantage'),
      text: this._t(
        `الاعتماد على منصة UCP للحسابات المالية والبيانات الموثقة من ${city?.name_ar || ''} يوفر شفافية وثقة أعلى للمستثمر.`,
        `Reliance on the UCP platform for financial calculations and verified data from ${city?.name_en || ''} provides greater transparency and investor confidence.`
      )
    };
  }

  _businessModel(project) {
    return {
      title: this._t('نموذج العمل', 'Business Model'),
      text: this._t(
        `نموذج العمل يعتمد على تحقيق إيرادات ${fmtCurrency(project.revenue, this.currency)} سنوياً برأس مال ${fmtCurrency(project.capital, this.currency)}.`,
        `The business model targets annual revenue of ${fmtCurrency(project.revenue, this.currency)} with capital of ${fmtCurrency(project.capital, this.currency)}.`
      )
    };
  }

  _revenueModel(project, outputs) {
    const revenue = outputs.annual_revenue?.value ?? project.revenue;
    return {
      title: this._t('نموذج الإيرادات', 'Revenue Model'),
      text: this._t(
        `الإيرادات المتوقعة ${fmtCurrency(revenue, this.currency)} سنوياً بناءً على بيانات المشروع المسجلة.`,
        `Expected revenue of ${fmtCurrency(revenue, this.currency)} annually based on the project's recorded data.`
      )
    };
  }

  _financialHighlights(outputs, feasibility, financing) {
    return {
      title: this._t('الأرقام المالية الرئيسية', 'Financial Highlights'),
      metrics: [
        { label: this._t('الإيرادات', 'Revenue'), value: fmtCurrency(outputs.annual_revenue?.value, this.currency), source: 'ucp' },
        { label: this._t('صافي الربح', 'Net Profit'), value: fmtCurrency(feasibility.npv, this.currency), source: 'ucp' },
        { label: this._t('معدل العائد الداخلي', 'IRR'), value: formatPct(feasibility.irr), source: 'ucp' },
        { label: this._t('فترة الاسترداد', 'Payback'), value: `${safeNumber(feasibility.payback, 1)} ${this._t('سنوات', 'years')}`, source: 'ucp' },
        { label: this._t('DSCR', 'DSCR'), value: safeNumber(financing.dscr, 2) || 'N/A', source: 'ucp' }
      ]
    };
  }

  _valuation(valuation, project) {
    return {
      title: this._t('التقييم', 'Valuation'),
      text: this._t(
        `القيمة العادلة المستخرجة من UCP تبلغ ${fmtCurrency(valuation.value, this.currency)}، بناءً على بيانات المشروع والسوق.`,
        `The fair value derived from UCP is ${fmtCurrency(valuation.value, this.currency)}, based on project and market data.`
      ),
      value: valuation.value
    };
  }

  _fundingRequirements(project, financing) {
    return {
      title: this._t('متطلبات التمويل', 'Funding Requirements'),
      text: this._t(
        `مبلغ التمويل المطلوب ${fmtCurrency(financing.amount || project.capital, this.currency)} لدعم رأس المال والتشغيل.`,
        `Funding required: ${fmtCurrency(financing.amount || project.capital, this.currency)} to support capital and operations.`
      )
    };
  }

  _useOfFunds(project) {
    return {
      title: this._t('استخدام الأموال', 'Use of Funds'),
      text: this._t(
        `رأس المال ${fmtCurrency(project.capital, this.currency)} يُخصص للأصول والتشغيل والتوسع وفق خطة المشروع.`,
        `Capital of ${fmtCurrency(project.capital, this.currency)} is allocated to assets, operations, and expansion per the project plan.`
      )
    };
  }

  _capitalStructure(financing, project) {
    return {
      title: this._t('هيكل رأس المال', 'Capital Structure'),
      text: this._t(
        `هيكل مبدئي: استثمار ملكي ${fmtCurrency(project.capital, this.currency)}${financing.amount ? ` + تمويل ${fmtCurrency(financing.amount, this.currency)}` : ''}.`,
        `Initial structure: equity ${fmtCurrency(project.capital, this.currency)}${financing.amount ? ` + financing ${fmtCurrency(financing.amount, this.currency)}` : ''}.`
      )
    };
  }

  _expectedRoi(feasibility) {
    return {
      title: this._t('العائد المتوقع', 'Expected ROI'),
      value: formatPct(feasibility.irr)
    };
  }

  _irr(feasibility) {
    return {
      title: 'IRR',
      value: formatPct(feasibility.irr)
    };
  }

  _npv(feasibility) {
    return {
      title: 'NPV',
      value: fmtCurrency(feasibility.npv, this.currency)
    };
  }

  _riskAnalysis(risk) {
    return {
      title: this._t('تحليل المخاطر', 'Risk Analysis'),
      grade: risk.risk_grade || 'C',
      text: this._t(
        `درجة المخاطر ${risk.risk_grade || 'C'}. يُنصح بمراجعة افتراضات المخاطر وإعداد خطط تخفيف.`,
        `Risk grade ${risk.risk_grade || 'C'}. Review risk assumptions and prepare mitigation plans.`
      )
    };
  }

  _sensitivityAnalysis(scenarios) {
    return {
      title: this._t('تحليل الحساسية', 'Sensitivity Analysis'),
      scenarios: scenarios.map(s => ({
        name: s.scenarioType || s.name,
        value: s.resultValue,
        summary: s.summary
      }))
    };
  }

  _swot(story, risk, city) {
    return {
      title: 'SWOT',
      strengths: story.output?.whyThisProject ? [story.output.whyThisProject] : [],
      weaknesses: risk.risk_grade ? [`Risk grade ${risk.risk_grade}`] : [],
      opportunities: story.output?.whyThisOpportunity ? [story.output.whyThisOpportunity] : [],
      threats: city ? [`Market conditions in ${city.name_en || city.name_ar}`] : []
    };
  }

  _exitStrategy(feasibility, project) {
    return {
      title: this._t('استراتيجية الخروج', 'Exit Strategy'),
      text: this._t(
        `خيارات الخروج تشمل البيع الاستراتيجي أو إعادة التمويل بعد تحقيق الاستقرار المالي (IRR ${formatPct(feasibility.irr)}).`,
        `Exit options include strategic sale or refinancing after achieving financial stability (IRR ${formatPct(feasibility.irr)}).`
      )
    };
  }

  _roadmap(project) {
    return {
      title: this._t('خارطة الطريق', 'Roadmap'),
      milestones: [
        { phase: this._t('التأسيس', 'Setup'), detail: this._t('إكمال البيانات والتقييم', 'Complete data and valuation') },
        { phase: this._t('جمع التمويل', 'Fundraising'), detail: this._t('عرض النشرة على المستثمرين', 'Present memorandum to investors') },
        { phase: this._t('التنفيذ', 'Execution'), detail: this._t('بدء التشغيل وفق خطة المشروع', 'Begin operations per project plan') }
      ]
    };
  }

  _managementTeam() {
    return {
      title: this._t('الفريق الإداري', 'Management Team'),
      text: this._t('يُنصح بإرفاق ملفات الفريق الإداري في غرفة البيانات.', 'Management team profiles should be attached in the data room.')
    };
  }

  _appendices(ucpResult) {
    return {
      title: this._t('الملاحق', 'Appendices'),
      items: [
        this._t('تقرير UCP الكامل', 'Full UCP Report'),
        this._t('تحليل المخاطر', 'Risk Analysis'),
        this._t('بيانات السوق', 'Market Data')
      ],
      ucpTrace: ucpResult?.trace || null
    };
  }

  _aggregateConfidence(readiness, story, ucpResult) {
    const scores = [readiness.confidence, story.confidence];
    if (ucpResult?.confidence) scores.push(Math.round(ucpResult.confidence * 100));
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  _buildEvidence(ucpResult, readiness, story) {
    const evidence = [];
    if (ucpResult) {
      evidence.push({ source: 'ucp', evidence_type: 'calculation', evidence_code: 'ucp_outputs', value: ucpResult.outputs, confidence: Math.round((ucpResult.confidence || 0) * 100), reason: 'UCP financial outputs' });
    }
    evidence.push(...readiness.evidence, ...story.evidence);
    return evidence;
  }
}

module.exports = { InvestmentMemorandumEngine };
