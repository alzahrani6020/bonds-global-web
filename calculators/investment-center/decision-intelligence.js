/**
 * Bonds Decision Intelligence Layer
 * Provides professional decision-support output on top of InvestmentEngine results.
 * Exposes window.DecisionIntelligence.analyze(inputs, engineResult, lang)
 */
(function (global) {
  'use strict';

  const DEFAULT_LANG = 'ar';

  const i18n = {
    ar: {
      currency: 'ر.س',
      months: 'شهر',
      scoreLabel: 'درجة الثقة',
      dataQuality: 'جودة البيانات',
      riskAnalysis: 'تحليل المخاطر',
      financingAnalysis: 'تحليل التمويل',
      marketAnalysis: 'تحليل السوق',
      cashFlowAnalysis: 'تحليل التدفقات النقدية',
      recommendation: 'التوصية الاستثمارية',
      executiveReport: 'التقرير التنفيذي',
      keyRisks: 'قائمة المخاطر الرئيسية',
      keyOpportunities: 'قائمة الفرص الرئيسية',
      printExecutiveReport: 'طباعة التقرير التنفيذي',
      printDecisionReport: 'طباعة تقرير القرار',
      dataQualitySummary: 'ملخص جودة البيانات',
      financingSummary: 'ملخص التمويل',
      marketSummary: 'ملخص السوق',
      cashFlowSummary: 'ملخص التدفقات النقدية',
      decisionIntelligence: 'الذكاء في اتخاذ القرار',
      proceed: 'المضي قدماً',
      reconsider: 'إعادة الدراسة',
      mitigate: 'المضي مع خطة تخفيف',
      avoid: 'تجنب الاستثمار',
      excellent: 'ممتاز',
      good: 'جيد',
      fair: 'مقبول',
      poor: 'ضعيف',
      high: 'عالي',
      medium: 'متوسط',
      low: 'منخفض',
      severe: 'حرج',
      financialRisk: 'مالية',
      operationalRisk: 'تشغيلية',
      marketRisk: 'سوقية',
      regulatoryRisk: 'تنظيمية',
      technologyRisk: 'تقنية',
      competitionRisk: 'منافسة',
      supplyChainRisk: 'سلسلة التوريد',
      reputationRisk: 'سمعة',
      currencyRisk: 'عملة',
      geopoliticalRisk: 'جيوسياسية',
      debtEquityRatio: 'نسبة الدين إلى حقوق الملكية',
      collateralCoverage: 'تغطية الضمانات',
      dscrEstimate: 'تغطية خدمة الدين المقدرة',
      interestBurden: 'عبء الفائدة السنوي',
      selfFinanceRatio: 'نسبة التمويل الذاتي',
      tam: 'إجمالي السوق المتاح (TAM)',
      sam: 'السوق الموجه (SAM)',
      som: 'السوق الم obtainable (SOM)',
      marketShare: 'الحصة السوقية المقدرة',
      competitionLevel: 'مستوى المنافسة',
      growthPotential: 'إمكانية النمو',
      monthlyNetCashFlow: 'صافي التدفق النقدي الشهري',
      annualNetCashFlow: 'صافي التدفق النقدي السنوي',
      cumulativeCashFlow: 'التدفق النقدي التراكمي',
      breakEvenTiming: 'توقع التعادل',
      liquidityAssessment: 'تقييم السيولة',
      positive: 'إيجابي',
      negative: 'سلبي',
      stable: 'مستقر',
      stressed: 'تحت ضغط',
      reportTitle: 'تقرير قرار استثماري تنفيذي',
      generatedOn: 'تاريخ الإصدار',
      projectName: 'اسم المشروع',
      sector: 'القطاع',
      overallVerdict: 'القرار النهائي',
      confidenceScore: 'درجة الثقة',
      keyMetrics: 'المؤشرات الرئيسية',
      risks: 'المخاطر',
      opportunities: 'الفرص',
      recommendationDetails: 'تفاصيل التوصية',
      noData: 'غير متوفر',
      reportPreparedBy: 'أعده',
      reportConfidential: 'تقرير سري — للاستخدام الداخلي فقط',
      dataQualityChecklist: 'قائمة جودة البيانات',
      fieldsCompleted: 'الحقول المكتملة',
      fieldsZero: 'الحقول الصفرية',
      rangeIssuesLabel: 'مشاكل النطاق',
      riskMatrix: 'مصفوفة المخاطر',
      likelihood: 'الاحتمال',
      impact: 'التأثير',
      cashFlowChart: 'التدفق النقدي التراكمي',
      riskBreakdown: 'توزيع المخاطر',
      financingStructure: 'هيكل التمويل',
      equity: 'حقوق الملكية',
      debt: 'الدين',
      marketScores: 'مؤشرات السوق',
      topRisks: 'أبرز 3 مخاطر',
      topOpportunities: 'أبرز 3 فرص',
      assumptions: 'الافتراضات الرئيسية',
      disclaimer: 'إخلاء المسؤولية',
      disclaimerText: 'هذا التقرير يعتمد على البيانات المدخلة والافتراضات المعلنة. لا يُعتبر توصية مالية نهائية ويجب مراجعته من مستشار مالي مرخص قبل اتخاذ قرار الاستثمار.',
      noRisks: 'لم يتم تحديد مخاطر جوهرية.',
      noOpportunities: 'لم يتم تحديد فرص بارزة.',
      breakEven: 'التعادل',
      investment: 'الاستثمار',
      chartMonths: ['ش1', 'ش2', 'ش3', 'ش4', 'ش5', 'ش6', 'ش7', 'ش8', 'ش9', 'ش10', 'ش11', 'ش12'],
      riskLevelLabel: 'مستوى المخاطر',
      cashFlow: 'التدفق النقدي',
      print: 'طباعة',
      close: 'إغلاق',
      details: 'التفاصيل',
      showMore: 'عرض المزيد',
      showLess: 'عرض أقل',
      basedOn: 'بناءً على',
      outOf: 'من',
      score: 'الدرجة',
      qualityIssues: 'ملاحظات الجودة'
    },
    en: {
      currency: 'SAR',
      months: 'months',
      scoreLabel: 'Confidence Score',
      dataQuality: 'Data Quality',
      riskAnalysis: 'Risk Analysis',
      financingAnalysis: 'Financing Analysis',
      marketAnalysis: 'Market Analysis',
      cashFlowAnalysis: 'Cash Flow Analysis',
      recommendation: 'Investment Recommendation',
      executiveReport: 'Executive Report',
      keyRisks: 'Key Risks',
      keyOpportunities: 'Key Opportunities',
      dataQualitySummary: 'Data Quality Summary',
      financingSummary: 'Financing Summary',
      marketSummary: 'Market Summary',
      cashFlowSummary: 'Cash Flow Summary',
      decisionIntelligence: 'Decision Intelligence',
      printExecutiveReport: 'Print Executive Report',
      printDecisionReport: 'Print Decision Report',
      proceed: 'Proceed',
      reconsider: 'Reconsider',
      mitigate: 'Proceed with Mitigation Plan',
      avoid: 'Avoid Investment',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      severe: 'Severe',
      financialRisk: 'Financial',
      operationalRisk: 'Operational',
      marketRisk: 'Market',
      regulatoryRisk: 'Regulatory',
      technologyRisk: 'Technology',
      competitionRisk: 'Competition',
      supplyChainRisk: 'Supply Chain',
      reputationRisk: 'Reputation',
      currencyRisk: 'Currency',
      geopoliticalRisk: 'Geopolitical',
      debtEquityRatio: 'Debt-to-Equity Ratio',
      collateralCoverage: 'Collateral Coverage',
      dscrEstimate: 'Estimated DSCR',
      interestBurden: 'Annual Interest Burden',
      selfFinanceRatio: 'Self-Finance Ratio',
      tam: 'Total Addressable Market (TAM)',
      sam: 'Serviceable Addressable Market (SAM)',
      som: 'Serviceable Obtainable Market (SOM)',
      marketShare: 'Estimated Market Share',
      competitionLevel: 'Competition Level',
      growthPotential: 'Growth Potential',
      monthlyNetCashFlow: 'Monthly Net Cash Flow',
      annualNetCashFlow: 'Annual Net Cash Flow',
      cumulativeCashFlow: 'Cumulative Cash Flow',
      breakEvenTiming: 'Break-Even Timing',
      liquidityAssessment: 'Liquidity Assessment',
      positive: 'Positive',
      negative: 'Negative',
      stable: 'Stable',
      stressed: 'Stressed',
      reportTitle: 'Executive Investment Decision Report',
      generatedOn: 'Generated on',
      projectName: 'Project Name',
      sector: 'Sector',
      overallVerdict: 'Overall Verdict',
      confidenceScore: 'Confidence Score',
      keyMetrics: 'Key Metrics',
      risks: 'Risks',
      opportunities: 'Opportunities',
      recommendationDetails: 'Recommendation Details',
      noData: 'Not available',
      reportPreparedBy: 'Prepared by',
      reportConfidential: 'Confidential — Internal Use Only',
      dataQualityChecklist: 'Data Quality Checklist',
      fieldsCompleted: 'Fields Completed',
      fieldsZero: 'Zero Fields',
      rangeIssuesLabel: 'Range Issues',
      riskMatrix: 'Risk Matrix',
      likelihood: 'Likelihood',
      impact: 'Impact',
      cashFlowChart: 'Cumulative Cash Flow',
      riskBreakdown: 'Risk Breakdown',
      financingStructure: 'Financing Structure',
      equity: 'Equity',
      debt: 'Debt',
      marketScores: 'Market Scores',
      topRisks: 'Top 3 Risks',
      topOpportunities: 'Top 3 Opportunities',
      assumptions: 'Key Assumptions',
      disclaimer: 'Disclaimer',
      disclaimerText: 'This report is based on entered data and stated assumptions. It is not a final financial recommendation and should be reviewed by a licensed financial advisor before making an investment decision.',
      noRisks: 'No material risks identified.',
      noOpportunities: 'No outstanding opportunities identified.',
      breakEven: 'Break-even',
      investment: 'Investment',
      chartMonths: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
      riskLevelLabel: 'Risk Level',
      cashFlow: 'Cash Flow',
      print: 'Print',
      close: 'Close',
      details: 'Details',
      showMore: 'Show More',
      showLess: 'Show Less',
      basedOn: 'Based on',
      outOf: 'of',
      score: 'Score',
      qualityIssues: 'Quality Issues'
    }
  };

  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (typeof value === 'number' && value === 0) return true;
    return false;
  }

  function formatMoney(n, lang) {
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA');
  }

  function formatPercent(n) {
    if (!Number.isFinite(n)) return '-';
    return n.toFixed(1) + '%';
  }

  function formatMonths(n, lang) {
    if (!Number.isFinite(n)) return '∞';
    return n.toFixed(1) + ' ' + i18n[lang || DEFAULT_LANG].months;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function getLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  function getLevelLabel(level, t) {
    return t[level] || level;
  }

  function getSeverity(score) {
    if (score >= 80) return 'severe';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  function getSeverityColor(severity) {
    switch (severity) {
      case 'severe': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#94a3b8';
    }
  }

  function getVerdictColor(recommendation) {
    switch (recommendation) {
      case 'proceed': return { bg: '#dcfce7', border: '#86efac', text: '#166534', icon: '✓' };
      case 'mitigate': return { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', icon: '!' };
      case 'reconsider': return { bg: '#fef9c3', border: '#fde047', text: '#854d0e', icon: '?' };
      case 'avoid': return { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: '✕' };
      default: return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', icon: '!' };
    }
  }

  function scoreToColor(score) {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#f59e0b';
    if (score >= 20) return '#f97316';
    return '#ef4444';
  }

  // ===== 1. Data Quality Analysis =====
  function analyzeDataQuality(inputs) {
    const expertFieldNames = [
      'projectName', 'projectOwner', 'projectLocation', 'legalStructure', 'startMonth',
      'projectPhase', 'projectDurationYears', 'regulatoryApprovalsNeeded',
      'projectManagerExperience', 'environmentalImpact',
      'tam', 'sam', 'som', 'competitorCount', 'avgCompetitorPrice', 'marketEntryBarrier',
      'customerAcquisitionCost', 'customerLifetimeValue', 'digitalAdBudget', 'brandAwareness',
      'seasonalFactor', 'churnRate', 'repeatPurchaseRate', 'onlineVsOfflineRatio',
      'operatingDaysPerMonth', 'operatingHoursPerDay', 'shiftCount', 'capacityUtilizationTarget',
      'employeeProductivityIndex', 'maintenanceCostRate', 'insuranceCostAnnual', 'licenseRenewalCost',
      'softwareSubscriptions', 'marketingBudget', 'salesCommissionRate', 'energyCostMonthly',
      'waterCostMonthly', 'wasteDisposalCost', 'securityCost', 'cleaningCost', 'outsourcingCost', 'trainingCost',
      'landCost', 'buildingCost', 'renovationCost', 'machineryCost', 'furnitureCost', 'vehiclesCost',
      'workingCapital', 'contingencyReserve', 'salvageValue', 'assetLifeYears', 'preOpeningCost',
      'initialInventoryCost', 'permitsAndLicensesCost', 'feasibilityStudyCost',
      'equityAmount', 'loanAmount', 'interestRate', 'loanTermYears', 'gracePeriodMonths',
      'requiredRoi', 'minDscr', 'balloonPayment', 'earlyRepaymentPenalty', 'collateralValue',
      'debtServiceStartMonth',
      'marketRiskScore', 'operationalRiskScore', 'financialRiskScore', 'regulatoryRiskScore',
      'technologyRiskScore', 'reputationRiskScore', 'mitigationBudget', 'supplyChainRiskScore',
      'competitionRiskScore', 'currencyRiskScore', 'geopoliticalRiskScore',
      'keyAssumptions', 'sensitivityCase', 'successFactors', 'exitStrategy'
    ];

    const totalFields = expertFieldNames.length;
    let filledFields = 0;
    let zeroOrDefaultFields = 0;
    let rangeIssues = 0;

    expertFieldNames.forEach(name => {
      const value = inputs[name];
      if (!isEmpty(value)) filledFields++;
      if (typeof value === 'number') {
        if (value === 0) zeroOrDefaultFields++;
        if ((name.toLowerCase().includes('rate') || name.toLowerCase().includes('score')) && (value < 0 || value > 100)) {
          if (!['customerLifetimeValue', 'customerAcquisitionCost', 'avgCompetitorPrice'].includes(name)) {
            rangeIssues++;
          }
        }
      }
    });

    const completeness = filledFields / totalFields;
    const zeroPenalty = Math.min(0.4, zeroOrDefaultFields / totalFields);
    const rangePenalty = Math.min(0.1, rangeIssues / 10);

    let score = Math.round((completeness * 100) * (1 - zeroPenalty - rangePenalty));
    score = clamp(score, 0, 100);

    const issues = [];
    if (zeroOrDefaultFields > totalFields * 0.3) {
      issues.push(lang === 'en'
        ? 'Many expert fields are left at zero/default; refine inputs for a more reliable decision.'
        : 'العديد من الحقول الاحترافية بقيت صفر/افتراضية؛ حدّث المدخلات لقرار أكثر موثوقية.');
    }
    if (rangeIssues > 0) {
      issues.push(lang === 'en'
        ? 'Some percentage/risk values are outside expected ranges.'
        : 'بعض قيم النسب/المخاطر خارج النطاق المتوقع.');
    }
    if (filledFields < totalFields * 0.2) {
      issues.push(lang === 'en'
        ? 'Limited expert data available; confidence is reduced.'
        : 'البيانات الاحترافية محدودة؛ درجة الثقة منخفضة.');
    }

    return {
      score,
      level: getLevel(score),
      filledFields,
      totalFields,
      zeroOrDefaultFields,
      rangeIssues,
      issues,
      summary: lang === 'en'
        ? `Data quality is ${getLevelLabel(getLevel(score), i18n.en).toLowerCase()} (${score}/100). ${filledFields} of ${totalFields} expert fields populated.`
        : `جودة البيانات ${getLevelLabel(getLevel(score), i18n.ar)} (${score}/100). تم ملء ${filledFields} من ${totalFields} حقل احترافي.`
    };
  }

  // ===== 2. Risk Analysis =====
  function analyzeRisks(inputs, engineResult) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const metrics = engineResult.metrics || {};
    const risks = [];

    const riskMap = [
      { key: 'marketRiskScore', category: 'marketRisk', weight: 1.0 },
      { key: 'operationalRiskScore', category: 'operationalRisk', weight: 1.0 },
      { key: 'financialRiskScore', category: 'financialRisk', weight: 1.0 },
      { key: 'regulatoryRiskScore', category: 'regulatoryRisk', weight: 0.9 },
      { key: 'technologyRiskScore', category: 'technologyRisk', weight: 0.8 },
      { key: 'reputationRiskScore', category: 'reputationRisk', weight: 0.7 },
      { key: 'supplyChainRiskScore', category: 'supplyChainRisk', weight: 0.8 },
      { key: 'competitionRiskScore', category: 'competitionRisk', weight: 0.9 },
      { key: 'currencyRiskScore', category: 'currencyRisk', weight: 0.6 },
      { key: 'geopoliticalRiskScore', category: 'geopoliticalRisk', weight: 0.6 }
    ];

    let totalWeighted = 0;
    let totalWeight = 0;

    riskMap.forEach(item => {
      const score = toNumber(inputs[item.key]);
      if (score > 0) {
        const severityScore = (score / 5) * 100;
        const severity = getSeverity(severityScore);
        totalWeighted += severityScore * item.weight;
        totalWeight += item.weight;

        if (score >= 4) {
          risks.push({
            category: t[item.category],
            title: t[item.category],
            description: lang === 'en'
              ? `${t[item.category]} risk is elevated (${score}/5). Consider dedicated mitigation.`
              : `مخاطر ${t[item.category]} مرتفعة (${score}/5). فكّر بتخفيف مخصص.`,
            severity,
            score: severityScore
          });
        }
      }
    });

    // Financial risks from metrics
    if (metrics.profitMargin < 15) {
      risks.push({
        category: t.financialRisk,
        title: lang === 'en' ? 'Low Profit Margin' : 'هامش ربح منخفض',
        description: lang === 'en'
          ? `Profit margin is ${metrics.profitMargin.toFixed(1)}%, leaving limited buffer for cost overruns.`
          : `هامش الربح ${metrics.profitMargin.toFixed(1)}%، مما يترك هامشاً محدوداً لزيادة التكاليف.`,
        severity: metrics.profitMargin < 10 ? 'high' : 'medium',
        score: metrics.profitMargin < 10 ? 75 : 55
      });
    }

    if (!Number.isFinite(metrics.paybackMonths) || metrics.paybackMonths > 48) {
      risks.push({
        category: t.financialRisk,
        title: lang === 'en' ? 'Long Payback Period' : 'فترة استرداد طويلة',
        description: lang === 'en'
          ? 'Capital recovery is slow; cash reserves must be sufficient.'
          : 'استرداد رأس المال بطيء؛ يجب أن تكون الاحتياطات النقدية كافية.',
        severity: !Number.isFinite(metrics.paybackMonths) || metrics.paybackMonths > 72 ? 'high' : 'medium',
        score: !Number.isFinite(metrics.paybackMonths) ? 90 : 60
      });
    }

    if (inputs.regulatoryApprovalsNeeded > 5) {
      risks.push({
        category: t.regulatoryRisk,
        title: lang === 'en' ? 'Complex Regulatory Landscape' : 'بيئة تنظيمية معقدة',
        description: lang === 'en'
          ? 'Multiple approvals required may delay launch and increase costs.'
          : 'الموافقات المتعددة المطلوبة قد تؤخر الإطلاق وتزيد التكاليف.',
        severity: 'medium',
        score: 55
      });
    }

    const avgRisk = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    const riskScore = clamp(Math.round(avgRisk), 0, 100);

    return {
      score: riskScore,
      level: getLevel(riskScore),
      categories: riskMap.map(item => ({
        category: t[item.category],
        score: toNumber(inputs[item.key]) * 20,
        raw: toNumber(inputs[item.key])
      })).filter(c => c.raw > 0),
      risks,
      summary: lang === 'en'
        ? `Overall risk exposure is ${getLevelLabel(getLevel(riskScore), t).toLowerCase()} (${riskScore}/100).`
        : `التعرض الإجمالي للمخاطر ${getLevelLabel(getLevel(riskScore), t)} (${riskScore}/100).`
    };
  }

  // ===== 3. Financing Analysis =====
  function analyzeFinancing(inputs, engineResult) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const totalInvestment = toNumber(engineResult.metrics && engineResult.metrics.totalInvestment);
    const annualNetCashFlow = toNumber(engineResult.metrics && engineResult.metrics.monthlyNetCashFlow) * 12;

    const equity = toNumber(inputs.equityAmount);
    const loan = toNumber(inputs.loanAmount);
    const interestRate = toNumber(inputs.interestRate);
    const loanTerm = toNumber(inputs.loanTermYears);
    const collateral = toNumber(inputs.collateralValue);
    const minDscr = toNumber(inputs.minDscr, 1.25);

    const debtEquityRatio = equity > 0 ? loan / equity : 0;
    const totalFinancing = equity + loan;
    const debtRatio = totalFinancing > 0 ? loan / totalFinancing : 0;
    const collateralCoverage = loan > 0 ? collateral / loan : 0;

    let annualInterestBurden = 0;
    let dscr = 0;
    if (loan > 0 && interestRate > 0 && loanTerm > 0) {
      annualInterestBurden = loan * (interestRate / 100);
      dscr = annualInterestBurden > 0 ? annualNetCashFlow / annualInterestBurden : 0;
    } else if (loan > 0) {
      dscr = annualNetCashFlow / loan;
    } else {
      dscr = annualNetCashFlow > 0 ? 99 : 0;
    }

    const selfFinanceRatio = totalInvestment > 0 ? (equity / totalInvestment) * 100 : 0;

    let assessment = 'good';
    const issues = [];
    if (debtRatio > 0.7) {
      assessment = 'poor';
      issues.push(lang === 'en' ? 'Debt ratio is high; consider more equity.' : 'نسبة الدين مرتفعة؛ فكّر بزيادة رأس المال.');
    } else if (debtRatio > 0.5) {
      assessment = 'fair';
      issues.push(lang === 'en' ? 'Debt ratio is moderately high.' : 'نسبة الدين مرتفعة بشكل متوسط.');
    }
    if (collateralCoverage > 0 && collateralCoverage < 1) {
      issues.push(lang === 'en' ? 'Collateral does not fully cover the loan.' : 'الضمانات لا تغطي القرض بالكامل.');
    }
    if (dscr > 0 && dscr < minDscr) {
      issues.push(lang === 'en' ? `DSCR is below target (${minDscr}).` : `معدل تغطية خدمة الدين أقل من المستهدف (${minDscr}).`);
    }
    if (selfFinanceRatio < 20) {
      issues.push(lang === 'en' ? 'Self-financing ratio is low.' : 'نسبة التمويل الذاتي منخفضة.');
    }

    return {
      debtEquityRatio,
      debtRatio,
      collateralCoverage,
      dscr,
      annualInterestBurden,
      selfFinanceRatio,
      minDscr,
      assessment,
      issues,
      summary: lang === 'en'
        ? `Debt-to-equity ${debtEquityRatio.toFixed(2)}, DSCR ${dscr.toFixed(2)}, self-finance ${selfFinanceRatio.toFixed(1)}%.`
        : `الدين/حقوق الملكية ${debtEquityRatio.toFixed(2)}، تغطية خدمة الدين ${dscr.toFixed(2)}، التمويل الذاتي ${selfFinanceRatio.toFixed(1)}%.`
    };
  }

  // ===== 4. Market Analysis =====
  function analyzeMarket(inputs, engineResult) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const annualRevenue = toNumber(engineResult.metrics && engineResult.metrics.monthlyNetCashFlow) * 12;
    const tam = toNumber(inputs.tam);
    const sam = toNumber(inputs.sam);
    const som = toNumber(inputs.som);
    const marketSize = toNumber(inputs.marketSize);
    const marketGrowthRate = toNumber(inputs.marketGrowthRate);
    const competitionLevel = toNumber(inputs.competitionLevel);
    const competitorCount = toNumber(inputs.competitorCount);
    const clv = toNumber(inputs.customerLifetimeValue);
    const cac = toNumber(inputs.customerAcquisitionCost);

    const marketShareDenominator = marketSize > 0 ? marketSize : (sam > 0 ? sam : tam);
    const marketShare = marketShareDenominator > 0 ? (annualRevenue / marketShareDenominator) * 100 : 0;

    let growthPotential = 'medium';
    if (marketGrowthRate >= 15) growthPotential = 'high';
    else if (marketGrowthRate < 5) growthPotential = 'low';

    let competitionAssessment = 'medium';
    if (competitionLevel <= 2 || competitorCount <= 3) competitionAssessment = 'low';
    else if (competitionLevel >= 4 || competitorCount >= 10) competitionAssessment = 'high';

    let unitEconomics = 'neutral';
    if (clv > 0 && cac > 0) {
      unitEconomics = clv / cac >= 3 ? 'strong' : (clv / cac >= 1 ? 'acceptable' : 'weak');
    }

    const score = clamp(Math.round(
      (marketGrowthRate >= 15 ? 30 : marketGrowthRate >= 8 ? 22 : 12) +
      (competitionAssessment === 'low' ? 25 : competitionAssessment === 'medium' ? 18 : 10) +
      (growthPotential === 'high' ? 25 : growthPotential === 'medium' ? 18 : 10) +
      (unitEconomics === 'strong' ? 20 : unitEconomics === 'acceptable' ? 14 : 8)
    ), 0, 100);

    return {
      tam,
      sam,
      som,
      marketShare,
      marketGrowthRate,
      competitionLevel,
      competitorCount,
      growthPotential,
      competitionAssessment,
      unitEconomics,
      clvCacRatio: cac > 0 ? clv / cac : 0,
      score,
      level: getLevel(score),
      summary: lang === 'en'
        ? `Market growth ${marketGrowthRate.toFixed(1)}%, competition ${competitionAssessment}, estimated share ${marketShare.toFixed(2)}%.`
        : `نمو السوق ${marketGrowthRate.toFixed(1)}%، المنافسة ${competitionAssessment}، الحصة المقدرة ${marketShare.toFixed(2)}%.`
    };
  }

  // ===== 5. Cash Flow Analysis =====
  function analyzeCashFlow(inputs, engineResult) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const metrics = engineResult.metrics || {};
    const monthlyNet = toNumber(metrics.monthlyNetCashFlow);
    const totalInvestment = toNumber(metrics.totalInvestment);
    const projectMonths = toNumber(metrics.projectMonths, 60);
    const annualNet = monthlyNet * 12;

    const cumulative = -totalInvestment + (monthlyNet * projectMonths);
    const breakEvenMonths = monthlyNet > 0 ? totalInvestment / monthlyNet : Infinity;

    let liquidity = 'positive';
    if (monthlyNet < 0) liquidity = 'negative';
    else if (monthlyNet < totalInvestment * 0.005) liquidity = 'stressed';
    else liquidity = 'stable';

    let score = 50;
    if (monthlyNet > 0) score += 30;
    if (cumulative > 0) score += 15;
    if (Number.isFinite(breakEvenMonths) && breakEvenMonths <= 24) score += 5;
    score = clamp(score, 0, 100);

    return {
      monthlyNetCashFlow: monthlyNet,
      annualNetCashFlow: annualNet,
      cumulativeCashFlow: cumulative,
      breakEvenMonths,
      liquidity,
      score,
      level: getLevel(score),
      summary: lang === 'en'
        ? `Monthly net cash flow ${formatMoney(monthlyNet, lang)} ${t.currency}, break-even in ${Number.isFinite(breakEvenMonths) ? breakEvenMonths.toFixed(1) + ' ' + t.months : '∞'}.`
        : `صافي التدفق النقدي الشهري ${formatMoney(monthlyNet, lang)} ${t.currency}، التعادل خلال ${Number.isFinite(breakEvenMonths) ? breakEvenMonths.toFixed(1) + ' ' + t.months : '∞'}.`
    };
  }

  // ===== 6. Investment Recommendation =====
  function buildRecommendation(engineResult, dataQuality, risk, financing, market, cashFlow) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const rec = engineResult.recommendation || {};
    const decisionKey = rec.decisionKey || 'conditional';

    let recommendation = 'mitigate';
    if (decisionKey === 'recommended' && dataQuality.score >= 60 && risk.score < 60 && cashFlow.score >= 70) {
      recommendation = 'proceed';
    } else if (decisionKey === 'not_recommended' || risk.score >= 80 || cashFlow.liquidity === 'negative') {
      recommendation = 'avoid';
    } else if (decisionKey === 'reconsider' || decisionKey === 'high_risk' || dataQuality.score < 40 || financing.assessment === 'poor') {
      recommendation = 'reconsider';
    }

    const nuances = [];
    if (dataQuality.score < 50) {
      nuances.push(lang === 'en'
        ? 'Improve data quality before finalizing the decision.'
        : 'حسّن جودة البيانات قبل اتخاذ القرار النهائي.');
    }
    if (financing.dscr > 0 && financing.dscr < financing.minDscr) {
      nuances.push(lang === 'en'
        ? 'Restructure financing to improve debt service coverage.'
        : 'أعد هيكلة التمويل لتحسين تغطية خدمة الدين.');
    }
    if (market.competitionAssessment === 'high') {
      nuances.push(lang === 'en'
        ? 'Differentiate clearly from competitors to protect margins.'
        : 'تميز بوضوح عن المنافسين لحماية الهوامش.');
    }
    if (cashFlow.liquidity === 'stressed') {
      nuances.push(lang === 'en'
        ? 'Maintain a larger working-capital buffer.'
        : 'حافظ على احتياطي رأس مال عامل أكبر.');
    }

    const labelMap = {
      proceed: t.proceed,
      reconsider: t.reconsider,
      mitigate: t.mitigate,
      avoid: t.avoid
    };

    return {
      recommendation,
      label: labelMap[recommendation] || t.mitigate,
      basedOnEngine: rec.decision || t.noData,
      nuances,
      summary: lang === 'en'
        ? `Decision: ${labelMap[recommendation] || t.mitigate}. ${nuances.length > 0 ? nuances[0] : ''}`
        : `القرار: ${labelMap[recommendation] || t.mitigate}. ${nuances.length > 0 ? nuances[0] : ''}`
    };
  }

  // ===== 7. Confidence Score =====
  function calculateConfidence(dataQuality, risk, market, cashFlow, financing) {
    const modelStability = clamp(100 - risk.score, 0, 100);
    const marketClarity = market.score;
    const financialClarity = financing.assessment === 'poor' ? 40 : (financing.assessment === 'fair' ? 70 : 90);
    const riskClarity = clamp(100 - Math.abs(risk.score - 50) * 2, 0, 100);

    const score = Math.round(
      dataQuality.score * 0.30 +
      modelStability * 0.20 +
      marketClarity * 0.20 +
      financialClarity * 0.20 +
      riskClarity * 0.10
    );

    return {
      score: clamp(score, 0, 100),
      level: getLevel(score),
      breakdown: {
        dataQuality: dataQuality.score,
        modelStability,
        marketClarity,
        financialClarity,
        riskClarity
      }
    };
  }

  // ===== 8. Key Risks List =====
  function buildKeyRisks(riskAnalysis, financing, market, cashFlow) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const risks = [...riskAnalysis.risks];

    if (financing.dscr > 0 && financing.dscr < financing.minDscr) {
      risks.push({
        category: t.financialRisk,
        title: lang === 'en' ? 'Low DSCR' : 'تغطية خدمة الدين ضعيفة',
        description: lang === 'en'
          ? `Estimated DSCR ${financing.dscr.toFixed(2)} is below target ${financing.minDscr}.`
          : `تغطية خدمة الدين المقدرة ${financing.dscr.toFixed(2)} أقل من المستهدف ${financing.minDscr}.`,
        severity: financing.dscr < 1 ? 'high' : 'medium',
        score: financing.dscr < 1 ? 80 : 55
      });
    }

    if (cashFlow.liquidity === 'negative') {
      risks.push({
        category: t.financialRisk,
        title: lang === 'en' ? 'Negative Cash Flow' : 'تدفق نقدي سلبي',
        description: lang === 'en'
          ? 'Projected monthly net cash flow is negative; funding gap expected.'
          : 'صافي التدفق النقدي الشهري المتوقع سلبي؛ هناك فجوة تمويلية متوقعة.',
        severity: 'severe',
        score: 95
      });
    }

    if (market.competitionAssessment === 'high') {
      risks.push({
        category: t.competitionRisk,
        title: lang === 'en' ? 'Intense Competition' : 'منافسة شديدة',
        description: lang === 'en'
          ? 'High competition level may pressure pricing and margins.'
          : 'المنافسة العالية قد تضغط على الأسعار والهوامش.',
        severity: 'medium',
        score: 60
      });
    }

    return risks.slice(0, 8);
  }

  // ===== 9. Key Opportunities List =====
  function buildOpportunities(market, cashFlow, inputs, engineResult) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const opportunities = [];
    const metrics = engineResult.metrics || {};

    if (market.marketGrowthRate >= 10) {
      opportunities.push({
        category: t.marketAnalysis,
        title: lang === 'en' ? 'Strong Market Growth' : 'نمو سوقي قوي',
        description: lang === 'en'
          ? `Annual market growth of ${market.marketGrowthRate.toFixed(1)}% supports expansion.`
          : `نمو سوقي سنوي ${market.marketGrowthRate.toFixed(1)}% يدعم التوسع.`,
        impact: 'high'
      });
    }

    if (metrics.roi >= 25) {
      opportunities.push({
        category: t.financialRisk,
        title: lang === 'en' ? 'High ROI Potential' : 'عائد استثماري مرتفع',
        description: lang === 'en'
          ? `ROI of ${metrics.roi.toFixed(1)}% is attractive to investors and lenders.`
          : `عائد الاستثمار ${metrics.roi.toFixed(1)}% جاذب للمستثمرين والممولين.`,
        impact: 'high'
      });
    }

    if (Number.isFinite(metrics.paybackMonths) && metrics.paybackMonths <= 24) {
      opportunities.push({
        category: t.cashFlowAnalysis,
        title: lang === 'en' ? 'Fast Payback' : 'استرداد سريع',
        description: lang === 'en'
          ? `Capital is expected to be recovered within ${metrics.paybackMonths.toFixed(1)} months.`
          : `من المتوقع استرداد رأس المال خلال ${metrics.paybackMonths.toFixed(1)} شهراً.`,
        impact: 'high'
      });
    }

    if (market.unitEconomics === 'strong') {
      opportunities.push({
        category: t.marketAnalysis,
        title: lang === 'en' ? 'Strong Unit Economics' : 'اقتصاديات الوحدة قوية',
        description: lang === 'en'
          ? `Customer lifetime value is ${market.clvCacRatio.toFixed(1)}x acquisition cost.`
          : `قيمة العميل مدى الحياة ${market.clvCacRatio.toFixed(1)} ضعف تكلفة الاكتساب.`,
        impact: 'medium'
      });
    }

    if (inputs.digitalAdBudget > 0 && inputs.brandAwareness < 50) {
      opportunities.push({
        category: t.marketAnalysis,
        title: lang === 'en' ? 'Brand Growth Potential' : 'إمكانية نمو العلامة التجارية',
        description: lang === 'en'
          ? 'Digital ad budget can accelerate customer acquisition and brand awareness.'
          : 'ميزانية الإعلانات الرقمية يمكن أن تسرّع اكتساب العملاء والوعي بالعلامة.',
        impact: 'medium'
      });
    }

    if (inputs.capacityUtilizationTarget < 85) {
      opportunities.push({
        category: t.operationalRisk,
        title: lang === 'en' ? 'Capacity Headroom' : 'مساحة للطاقة الإنتاجية',
        description: lang === 'en'
          ? 'Current utilization target leaves room for revenue growth without major capex.'
          : 'مستهدف الاستغلال الحالي يترك مجالاً لنمو الإيرادات بدون استثمارات رأسمالية كبيرة.',
        impact: 'medium'
      });
    }

    return opportunities.slice(0, 8);
  }

  // ===== SVG Chart Helpers (for executive report) =====
  function generateSparkline(data, width, height, color, fillColor) {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;
    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="overflow:visible">
        <polygon points="${areaPoints}" fill="${fillColor}" opacity="0.25" />
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>`;
  }

  function generateDonutChart(segments, width, height) {
    if (!segments || segments.length === 0) return '';
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    if (total <= 0) return '';
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 4;
    const innerRadius = radius * 0.62;
    let startAngle = -Math.PI / 2;
    let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
    segments.forEach(seg => {
      const angle = (seg.value / total) * Math.PI * 2;
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(startAngle + angle);
      const y2 = cy + radius * Math.sin(startAngle + angle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
      const ix1 = cx + innerRadius * Math.cos(startAngle);
      const iy1 = cy + innerRadius * Math.sin(startAngle);
      const ix2 = cx + innerRadius * Math.cos(startAngle + angle);
      const iy2 = cy + innerRadius * Math.sin(startAngle + angle);
      const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
      svg += `<path d="${path}" fill="${seg.color}" stroke="#fff" stroke-width="1.5" />`;
      startAngle += angle;
    });
    svg += `</svg>`;
    return svg;
  }

  function generateRiskMatrix(categories) {
    if (!categories || categories.length === 0) return '';
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const size = 5;
    const cells = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const impact = x + 1;
        const likelihood = size - y;
        const level = impact * likelihood;
        let color = '#dcfce7';
        if (level >= 20) color = '#fee2e2';
        else if (level >= 12) color = '#fef9c3';
        else if (level >= 6) color = '#dbeafe';
        cells.push({ x, y, impact, likelihood, level, color });
      }
    }
    let html = '<div class="risk-matrix"><table><thead><tr><th></th>';
    for (let i = 1; i <= size; i++) html += `<th>${i}</th>`;
    html += '</tr></thead><tbody>';
    for (let y = 0; y < size; y++) {
      html += `<tr><th>${size - y}</th>`;
      for (let x = 0; x < size; x++) {
        const cell = cells.find(c => c.x === x && c.y === y);
        const active = categories.some(cat => {
          const raw = Math.round(cat.raw);
          const impact = Math.min(5, Math.max(1, raw));
          const likelihood = Math.min(5, Math.max(1, raw));
          return impact === cell.impact && likelihood === cell.likelihood;
        });
        html += `<td style="background:${cell.color};${active ? 'box-shadow:inset 0 0 0 2px #1a1a1a;' : ''}">${active ? '●' : ''}</td>`;
      }
      html += '</tr>';
    }
    html += `</tbody></table><div class="risk-matrix__labels"><span class="risk-matrix__impact">${t.impact} ${lang === 'en' ? '→' : '←'}</span><span class="risk-matrix__likelihood">${t.likelihood} ↑</span></div></div>`;
    return html;
  }

  // ===== 10. Executive Report HTML =====
  function buildExecutiveReport(inputs, engineResult, decision, confidence, dataQuality, risk, financing, market, cashFlow, keyRisks, keyOpportunities) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const isEn = lang === 'en';
    const dir = isEn ? 'ltr' : 'rtl';
    const metrics = engineResult.metrics || {};
    const rec = engineResult.recommendation || {};
    const verdictStyle = getVerdictColor(decision.recommendation);

    const formatN = n => formatMoney(n, lang);
    const formatP = n => formatPercent(n);

    const projectName = inputs.projectName || (isEn ? 'Investment Project' : 'مشروع استثماري');
    const sectorName = inputs.projectSector || (isEn ? 'General' : 'عام');
    const generatedDate = new Date().toLocaleDateString(isEn ? 'en-US' : 'ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build cumulative cash flow data (12 months or project duration)
    const projectMonths = Math.min(24, toNumber(metrics.projectMonths, 12));
    const monthlyNet = toNumber(metrics.monthlyNetCashFlow);
    const totalInvestment = toNumber(metrics.totalInvestment);
    const cfData = [];
    let cumulative = -totalInvestment;
    for (let i = 1; i <= projectMonths; i++) {
      cumulative += monthlyNet;
      cfData.push(cumulative);
    }
    const cfLabels = [];
    for (let i = 1; i <= projectMonths; i++) {
      cfLabels.push(isEn ? `M${i}` : `${i}ش`);
    }
    const cfSparkline = generateSparkline(cfData, 500, 90, '#d4a853', '#d4a853');

    // Risk breakdown donut
    const riskSegments = risk.categories.slice(0, 6).map((cat, idx) => {
      const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];
      return { label: cat.category, value: Math.max(1, cat.score), color: colors[idx % colors.length] };
    });
    if (riskSegments.length === 0) riskSegments.push({ label: isEn ? 'Risk' : 'المخاطر', value: 1, color: '#94a3b8' });
    const riskDonut = generateDonutChart(riskSegments, 120, 120);

    // Financing structure donut
    const equityVal = Math.max(0, toNumber(inputs.equityAmount));
    const debtVal = Math.max(0, toNumber(inputs.loanAmount));
    const finTotal = equityVal + debtVal;
    const finSegments = [];
    if (finTotal > 0) {
      finSegments.push({ label: t.equity, value: equityVal, color: '#22c55e' });
      finSegments.push({ label: t.debt, value: debtVal, color: '#3b82f6' });
    } else {
      finSegments.push({ label: t.equity, value: 1, color: '#22c55e' });
      finSegments.push({ label: t.debt, value: 0, color: '#3b82f6' });
    }
    const finDonut = generateDonutChart(finSegments, 120, 120);

    const topRisks = keyRisks.slice(0, 3);
    const topOpportunities = keyOpportunities.slice(0, 3);

    const riskRows = topRisks.map(r => `
      <tr>
        <td><span class="badge" style="background:${getSeverityColor(r.severity)}20;color:${getSeverityColor(r.severity)};border:1px solid ${getSeverityColor(r.severity)}">${t[r.severity] || r.severity}</span></td>
        <td><strong>${r.title}</strong></td>
        <td>${r.description}</td>
      </tr>`).join('');

    const opportunityRows = topOpportunities.map(o => `
      <tr>
        <td><span class="badge" style="background:#22c55e20;color:#22c55e;border:1px solid #22c55e">${t[o.impact] || o.impact}</span></td>
        <td><strong>${o.title}</strong></td>
        <td>${o.description}</td>
      </tr>`).join('');

    return `
<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${t.reportTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=${isEn ? 'Inter' : 'Vazirmatn'}:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    body { font-family: ${isEn ? 'Inter' : 'Vazirmatn'}, Arial, sans-serif; background: #f8f5ef; color: #1a1a1a; padding: 0; margin: 0; line-height: 1.6; }
    .page { max-width: 900px; margin: 0 auto; background: #fff; min-height: 100vh; box-shadow: 0 0 40px rgba(0,0,0,0.06); }
    .page-inner { padding: 40px; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #d4a853; padding-bottom: 20px; margin-bottom: 24px; }
    .report-header__logo { height: 52px; }
    .report-header__meta { text-align: ${isEn ? 'right' : 'left'}; font-size: 12px; color: #666; }
    .report-header__meta strong { color: #1a1a1a; display: block; font-size: 13px; margin-bottom: 3px; }
    h1 { color: #1a1a1a; margin: 0 0 6px; font-size: 24px; font-weight: 900; }
    h2 { color: #b88a3a; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-top: 26px; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
    h3 { font-size: 13px; color: #555; margin: 0 0 10px; font-weight: 700; }
    .subtitle { color: #666; font-size: 14px; margin: 0 0 18px; }
    .verdict { padding: 20px; border-radius: 12px; margin: 18px 0; display: flex; align-items: center; gap: 16px; border: 1px solid ${verdictStyle.border}; background: ${verdictStyle.bg}; color: ${verdictStyle.text}; }
    .verdict__icon { width: 56px; height: 56px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,0.06); flex-shrink: 0; }
    .verdict__title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; margin-bottom: 2px; }
    .verdict__value { font-size: 22px; font-weight: 900; }
    .verdict__confidence { margin-${isEn ? 'left' : 'right'}: auto; text-align: center; background: #fff; padding: 10px 16px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .verdict__confidence-value { font-size: 24px; font-weight: 900; color: ${scoreToColor(confidence.score)}; }
    .verdict__confidence-label { font-size: 11px; color: #666; text-transform: uppercase; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
    .metric-item { background: #f8f5ef; border-radius: 10px; padding: 14px; text-align: center; border: 1px solid rgba(212,168,83,0.15); }
    .metric-item .label { font-size: 11px; color: #666; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
    .metric-item .value { font-size: 20px; font-weight: 800; color: #b88a3a; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 16px 0; }
    .panel { background: #fafafa; border: 1px solid #eee; border-radius: 12px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 12px; }
    th, td { padding: 8px 10px; border: 1px solid #e5e5e5; text-align: ${isEn ? 'left' : 'right'}; }
    th { background: #f8f5ef; font-weight: 700; color: #333; }
    tr:nth-child(even) { background: #fafafa; }
    .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
    .risk-matrix table { width: 180px; height: 180px; table-layout: fixed; border-collapse: collapse; }
    .risk-matrix td { width: 36px; height: 36px; text-align: center; padding: 0; font-size: 14px; color: #1a1a1a; }
    .risk-matrix th { background: transparent; border: none; font-size: 10px; color: #888; padding: 2px; }
    .risk-matrix__labels { display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 6px; }
    .risk-breakdown { display: flex; align-items: center; gap: 16px; }
    .risk-legend { display: flex; flex-direction: column; gap: 6px; font-size: 11px; }
    .risk-legend__item { display: flex; align-items: center; gap: 8px; }
    .risk-legend__dot { width: 10px; height: 10px; border-radius: 50%; }
    .chart-panel { margin-top: 8px; }
    .assumptions { background: #f8f5ef; border-radius: 10px; padding: 14px; font-size: 12px; color: #555; }
    .disclaimer { font-size: 10px; color: #888; border-top: 1px solid #e5e5e5; padding-top: 14px; margin-top: 24px; text-align: center; }
    .footer { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #999; margin-top: 20px; }
    @media print { body { background: #fff; } .page { box-shadow: none; } .page-inner { padding: 24px; } }
    @media (max-width: 640px) { .page-inner { padding: 20px; } .metric-grid { grid-template-columns: repeat(2, 1fr); } .two-col { grid-template-columns: 1fr; } .verdict { flex-direction: column; text-align: center; } .verdict__confidence { margin: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="page-inner">
      <div class="report-header">
        <img src="https://bonds-global.com/assets/bonds-logo.svg" alt="Bonds Global" class="report-header__logo" />
        <div class="report-header__meta">
          <strong>${t.reportTitle}</strong>
          <span>${t.generatedOn}: ${generatedDate}</span><br>
          <span>${t.reportConfidential}</span>
        </div>
      </div>

      <h1>${projectName}</h1>
      <div class="subtitle"><strong>${t.sector}:</strong> ${sectorName} &nbsp;|&nbsp; <strong>${t.projectName}:</strong> ${projectName}</div>

      <div class="verdict">
        <div class="verdict__icon">${verdictStyle.icon}</div>
        <div>
          <div class="verdict__title">${t.overallVerdict}</div>
          <div class="verdict__value">${decision.label}</div>
        </div>
        <div class="verdict__confidence">
          <div class="verdict__confidence-value">${confidence.score}%</div>
          <div class="verdict__confidence-label">${t.confidenceScore}</div>
        </div>
      </div>

      <h2>${t.keyMetrics}</h2>
      <div class="metric-grid">
        <div class="metric-item"><div class="label">ROI</div><div class="value">${formatP(metrics.roi)}</div></div>
        <div class="metric-item"><div class="label">IRR</div><div class="value">${formatP(metrics.irr)}</div></div>
        <div class="metric-item"><div class="label">NPV</div><div class="value">${formatN(metrics.npv)} ${t.currency}</div></div>
        <div class="metric-item"><div class="label">${t.breakEvenTiming}</div><div class="value">${formatMonths(metrics.paybackMonths, lang)}</div></div>
        <div class="metric-item"><div class="label">${t.marketShare}</div><div class="value">${formatP(market.marketShare)}</div></div>
        <div class="metric-item"><div class="label">${t.riskLevelLabel}</div><div class="value">${risk.score}</div></div>
      </div>

      <div class="two-col">
        <div class="panel">
          <h3>${t.cashFlowChart}</h3>
          <div class="chart-panel">${cfSparkline}</div>
          <table style="margin-top:12px">
            <tr><th>${t.cashFlow}</th><th>${t.value}</th></tr>
            <tr><td>${t.monthlyNetCashFlow}</td><td>${formatN(cashFlow.monthlyNetCashFlow)} ${t.currency}</td></tr>
            <tr><td>${t.cumulativeCashFlow}</td><td>${formatN(cashFlow.cumulativeCashFlow)} ${t.currency}</td></tr>
          </table>
        </div>
        <div class="panel">
          <h3>${t.riskBreakdown}</h3>
          <div class="risk-breakdown">
            ${riskDonut}
            <div class="risk-legend">
              ${riskSegments.map(s => `<div class="risk-legend__item"><span class="risk-legend__dot" style="background:${s.color}"></span><span>${s.label} (${s.value}%)</span></div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="two-col">
        <div class="panel">
          <h3>${t.financingStructure}</h3>
          <div class="risk-breakdown">
            ${finDonut}
            <div class="risk-legend">
              <div class="risk-legend__item"><span class="risk-legend__dot" style="background:#22c55e"></span><span>${t.equity}: ${formatN(equityVal)} ${t.currency}</span></div>
              <div class="risk-legend__item"><span class="risk-legend__dot" style="background:#3b82f6"></span><span>${t.debt}: ${formatN(debtVal)} ${t.currency}</span></div>
              <div class="risk-legend__item"><span style="display:inline-block;width:10px"></span><span>DSCR: ${financing.dscr.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        <div class="panel">
          <h3>${t.riskMatrix}</h3>
          ${generateRiskMatrix(risk.categories)}
        </div>
      </div>

      <h2>${t.topRisks}</h2>
      <table>
        <tr><th>${t.score}</th><th>${t.risks}</th><th>${isEn ? 'Description' : 'الوصف'}</th></tr>
        ${riskRows || `<tr><td colspan="3">${t.noRisks}</td></tr>`}
      </table>

      <h2>${t.topOpportunities}</h2>
      <table>
        <tr><th>${t.score}</th><th>${t.opportunities}</th><th>${isEn ? 'Description' : 'الوصف'}</th></tr>
        ${opportunityRows || `<tr><td colspan="3">${t.noOpportunities}</td></tr>`}
      </table>

      <h2>${t.recommendationDetails}</h2>
      <p><strong>${t.recommendation}:</strong> ${decision.basedOnEngine}</p>
      ${decision.nuances.length ? `<ul>${decision.nuances.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}

      <h2>${t.assumptions}</h2>
      <div class="assumptions">
        <p>${dataQuality.summary}</p>
        <p>${lang === 'en' ? 'Key assumptions entered by the user form the basis of this analysis. Actual results may differ materially.' : 'تشكّل الافتراضات الرئيسية التي أدخلها المستخدم أساس هذا التحليل. قد تختلف النتائج الفعلية بشكل كبير.'}</p>
      </div>

      <div class="disclaimer">
        ${t.disclaimerText}<br>
        Bonds Global — bonds-global.com
      </div>

      <div class="footer">
        <span>${t.reportPreparedBy} Bonds Global</span>
        <span>${t.reportConfidential}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  let lang = DEFAULT_LANG;

  function analyze(inputs, engineResult, userLang) {
    lang = (userLang === 'en' || userLang === 'ar') ? userLang : DEFAULT_LANG;
    inputs = inputs || {};
    engineResult = engineResult || {};

    const dataQuality = analyzeDataQuality(inputs);
    const risk = analyzeRisks(inputs, engineResult);
    const financing = analyzeFinancing(inputs, engineResult);
    const market = analyzeMarket(inputs, engineResult);
    const cashFlow = analyzeCashFlow(inputs, engineResult);
    const recommendation = buildRecommendation(engineResult, dataQuality, risk, financing, market, cashFlow);
    const confidence = calculateConfidence(dataQuality, risk, market, cashFlow, financing);
    const keyRisks = buildKeyRisks(risk, financing, market, cashFlow);
    const keyOpportunities = buildOpportunities(market, cashFlow, inputs, engineResult);
    const executiveReport = buildExecutiveReport(inputs, engineResult, recommendation, confidence, dataQuality, risk, financing, market, cashFlow, keyRisks, keyOpportunities);

    return {
      dataQuality,
      riskAnalysis: risk,
      financingAnalysis: financing,
      marketAnalysis: market,
      cashFlowAnalysis: cashFlow,
      recommendation,
      confidenceScore: confidence,
      executiveReport,
      keyRisks,
      keyOpportunities,
      lang
    };
  }

  // ===== Rendering Helpers =====
  function renderGauge(containerId, score, label, t) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const level = getLevel(score);
    const color = scoreToColor(score);
    container.innerHTML = `
      <div class="di-gauge">
        <div class="di-gauge__track">
          <div class="di-gauge__fill" style="width: ${score}%; background: ${color};"></div>
        </div>
        <div class="di-gauge__value" style="color: ${color};">${score}</div>
        <div class="di-gauge__label">${label}</div>
      </div>`;
  }

  function renderCircularGauge(containerId, score, label) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const color = scoreToColor(score);
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (score / 100) * circumference;
    container.innerHTML = `
      <div class="di-circular-gauge">
        <svg viewBox="0 0 100 100" class="di-circular-gauge__svg">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)" />
        </svg>
        <div class="di-circular-gauge__value" style="color:${color}">${score}<span>%</span></div>
        <div class="di-circular-gauge__label">${label}</div>
      </div>`;
  }

  function renderList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = `<p class="di-empty">${i18n[lang].noData}</p>`;
      return;
    }
    container.innerHTML = items.map(item => {
      const badge = type === 'risk' ? (item.severity || 'medium') : (item.impact || 'medium');
      const icon = type === 'risk' ? '⚠️' : '💡';
      return `
        <div class="di-list-item di-list-item--${badge}">
          <div class="di-list-item__icon">${icon}</div>
          <div class="di-list-item__content">
            <div class="di-list-item__category">${item.category}</div>
            <div class="di-list-item__title">${item.title}</div>
            <div class="di-list-item__desc">${item.description}</div>
          </div>
          <span class="di-list-item__badge di-list-item__badge--${badge}">${badge}</span>
        </div>`;
    }).join('');
  }

  function renderDecisionPanel(containerId, decision) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const style = getVerdictColor(decision.recommendation);
    container.className = `di-verdict di-verdict--${decision.recommendation}`;
    container.innerHTML = `
      <div class="di-verdict__icon">${style.icon}</div>
      <div class="di-verdict__body">
        <div class="di-verdict__label">${i18n[lang].recommendation}</div>
        <div class="di-verdict__value">${decision.label}</div>
        <div class="di-verdict__based">${decision.basedOnEngine}</div>
        ${decision.nuances.length ? `<ul class="di-verdict__nuances">${decision.nuances.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
      </div>
    `;
  }

  function renderSummary(containerId, dataQuality, risk, financing, market, cashFlow) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const t = i18n[lang];
    const finLabel = financing.assessment === 'good' ? t.good : financing.assessment === 'fair' ? t.fair : t.poor;
    const liqLabel = t[cashFlow.liquidity] || cashFlow.liquidity;
    container.innerHTML = `
      <div class="di-summary-grid">
        <div class="di-summary-item di-summary-item--${dataQuality.level}"><div class="di-summary-item__label">${t.dataQuality}</div><div class="di-summary-item__value">${dataQuality.score}<span>/100</span></div></div>
        <div class="di-summary-item di-summary-item--${risk.level}"><div class="di-summary-item__label">${t.riskAnalysis}</div><div class="di-summary-item__value">${risk.score}<span>/100</span></div></div>
        <div class="di-summary-item di-summary-item--${financing.assessment}"><div class="di-summary-item__label">${t.financingAnalysis}</div><div class="di-summary-item__value">${finLabel}</div></div>
        <div class="di-summary-item di-summary-item--${market.level}"><div class="di-summary-item__label">${t.marketAnalysis}</div><div class="di-summary-item__value">${market.score}<span>/100</span></div></div>
        <div class="di-summary-item di-summary-item--${cashFlow.level}"><div class="di-summary-item__label">${t.cashFlowAnalysis}</div><div class="di-summary-item__value">${cashFlow.score}<span>/100</span></div></div>
        <div class="di-summary-item"><div class="di-summary-item__label">${t.debtEquityRatio}</div><div class="di-summary-item__value">${financing.debtEquityRatio.toFixed(2)}</div></div>
      </div>`;
  }

  function renderDataQuality(containerId, dataQuality) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const t = i18n[lang];
    const color = scoreToColor(dataQuality.score);
    container.innerHTML = `
      <div class="di-data-quality">
        <div class="di-data-quality__score">
          <div class="di-data-quality__value" style="color:${color}">${dataQuality.score}<span>%</span></div>
          <div class="di-data-quality__label">${t.dataQuality}</div>
        </div>
        <div class="di-data-quality__progress">
          <div class="di-data-quality__track"><div class="di-data-quality__fill" style="width:${dataQuality.score}%; background:${color}"></div></div>
          <div class="di-data-quality__checklist">
            <div class="di-data-quality__check ${dataQuality.filledFields >= dataQuality.totalFields * 0.5 ? 'ok' : ''}">
              <span class="di-data-quality__icon">${dataQuality.filledFields >= dataQuality.totalFields * 0.5 ? '✓' : '○'}</span>
              <span>${t.fieldsCompleted}: ${dataQuality.filledFields} ${t.outOf} ${dataQuality.totalFields}</span>
            </div>
            <div class="di-data-quality__check ${dataQuality.zeroOrDefaultFields <= dataQuality.totalFields * 0.3 ? 'ok' : ''}">
              <span class="di-data-quality__icon">${dataQuality.zeroOrDefaultFields <= dataQuality.totalFields * 0.3 ? '✓' : '○'}</span>
              <span>${t.fieldsZero}: ${dataQuality.zeroOrDefaultFields}</span>
            </div>
            <div class="di-data-quality__check ${dataQuality.rangeIssues === 0 ? 'ok' : ''}">
              <span class="di-data-quality__icon">${dataQuality.rangeIssues === 0 ? '✓' : '!'}</span>
              <span>${t.rangeIssuesLabel}: ${dataQuality.rangeIssues}</span>
            </div>
          </div>
        </div>
        ${dataQuality.issues.length ? `<div class="di-data-quality__issues"><strong>${t.qualityIssues}:</strong><ul>${dataQuality.issues.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      </div>`;
  }

  function renderMarketScores(containerId, market) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const t = i18n[lang];
    const competitionLabel = market.competitionAssessment === 'low' ? t.low : market.competitionAssessment === 'high' ? t.high : t.medium;
    const growthLabel = market.growthPotential === 'high' ? t.high : market.growthPotential === 'low' ? t.low : t.medium;
    container.innerHTML = `
      <div class="di-market-scores">
        <div class="di-market-score"><div class="di-market-score__value" style="color:${scoreToColor(market.marketGrowthRate * 5)}">${market.marketGrowthRate.toFixed(1)}%</div><div class="di-market-score__label">${t.growthPotential}</div></div>
        <div class="di-market-score"><div class="di-market-score__value" style="color:${scoreToColor(market.competitionAssessment === 'low' ? 80 : market.competitionAssessment === 'medium' ? 50 : 25)}">${competitionLabel}</div><div class="di-market-score__label">${t.competitionLevel}</div></div>
        <div class="di-market-score"><div class="di-market-score__value">${market.marketShare.toFixed(2)}%</div><div class="di-market-score__label">${t.marketShare}</div></div>
        <div class="di-market-score"><div class="di-market-score__value">${market.clvCacRatio.toFixed(1)}x</div><div class="di-market-score__label">CLV/CAC</div></div>
      </div>`;
  }

  function renderCashFlowChart(containerId, cashFlow, metrics) {
    const canvas = document.getElementById(containerId);
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const t = i18n[lang];
    const months = Math.min(24, toNumber(metrics.projectMonths, 12));
    const labels = [];
    const data = [];
    let cumulative = -toNumber(metrics.totalInvestment);
    for (let i = 1; i <= months; i++) {
      labels.push(i % 3 === 0 || i === 1 || i === months ? (lang === 'en' ? 'M' + i : i + 'ش') : '');
      cumulative += cashFlow.monthlyNetCashFlow;
      data.push(cumulative);
    }
    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
    }
    canvas._chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: t.cumulativeCashFlow,
          data,
          borderColor: '#d4a853',
          backgroundColor: 'rgba(212,168,83,0.12)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  function renderRiskChart(containerId, risk) {
    const canvas = document.getElementById(containerId);
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const t = i18n[lang];
    const categories = risk.categories.slice(0, 6);
    const labels = categories.map(c => c.category);
    const data = categories.map(c => c.score);
    const bg = categories.map(c => scoreToColor(c.score));
    if (canvas._chartInstance) canvas._chartInstance.destroy();
    canvas._chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bg,
          borderColor: 'rgba(10,15,26,0.8)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: lang === 'en' ? 'right' : 'left', labels: { color: '#e8ecf4', font: { size: 11 }, boxWidth: 12 } }
        }
      }
    });
  }

  function renderFinancingChart(containerId, inputs, financing) {
    const canvas = document.getElementById(containerId);
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const t = i18n[lang];
    const equity = Math.max(0, toNumber(inputs.equityAmount));
    const debt = Math.max(0, toNumber(inputs.loanAmount));
    if (canvas._chartInstance) canvas._chartInstance.destroy();
    canvas._chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [t.equity, t.debt],
        datasets: [{
          data: equity + debt > 0 ? [equity, debt] : [1, 0],
          backgroundColor: ['#22c55e', '#3b82f6'],
          borderColor: 'rgba(10,15,26,0.8)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: lang === 'en' ? 'right' : 'left', labels: { color: '#e8ecf4', font: { size: 11 }, boxWidth: 12 } }
        }
      }
    });
  }

  function renderConfidenceBreakdown(containerId, confidence) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const t = i18n[lang];
    const b = confidence.breakdown;
    container.innerHTML = `
      <div class="di-confidence-breakdown">
        <div class="di-confidence-factor"><span>${t.dataQuality}</span><div class="di-confidence-factor__bar"><div style="width:${b.dataQuality}%; background:${scoreToColor(b.dataQuality)}"></div></div><span>${b.dataQuality}</span></div>
        <div class="di-confidence-factor"><span>${t.marketAnalysis}</span><div class="di-confidence-factor__bar"><div style="width:${b.marketClarity}%; background:${scoreToColor(b.marketClarity)}"></div></div><span>${b.marketClarity}</span></div>
        <div class="di-confidence-factor"><span>${t.financingAnalysis}</span><div class="di-confidence-factor__bar"><div style="width:${b.financialClarity}%; background:${scoreToColor(b.financialClarity)}"></div></div><span>${b.financialClarity}</span></div>
        <div class="di-confidence-factor"><span>${t.riskAnalysis}</span><div class="di-confidence-factor__bar"><div style="width:${b.riskClarity}%; background:${scoreToColor(b.riskClarity)}"></div></div><span>${b.riskClarity}</span></div>
      </div>`;
  }

  const DecisionIntelligence = {
    analyze,
    renderGauge,
    renderCircularGauge,
    renderList,
    renderDecisionPanel,
    renderSummary,
    renderDataQuality,
    renderMarketScores,
    renderCashFlowChart,
    renderRiskChart,
    renderFinancingChart,
    renderConfidenceBreakdown,
    i18n,
    getLevel,
    getLevelLabel,
    scoreToColor
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecisionIntelligence;
  }
  global.DecisionIntelligence = DecisionIntelligence;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
