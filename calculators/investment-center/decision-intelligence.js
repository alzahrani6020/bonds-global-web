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
      noData: 'غير متوفر'
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
      noData: 'Not available'
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

  // ===== 10. Executive Report HTML =====
  function buildExecutiveReport(inputs, engineResult, decision, confidence, dataQuality, risk, financing, market, cashFlow, keyRisks, keyOpportunities) {
    const t = i18n[lang] || i18n[DEFAULT_LANG];
    const isEn = lang === 'en';
    const dir = isEn ? 'ltr' : 'rtl';
    const metrics = engineResult.metrics || {};
    const rec = engineResult.recommendation || {};

    const formatN = n => formatMoney(n, lang);
    const formatP = n => formatPercent(n);

    const riskRows = keyRisks.slice(0, 5).map(r => `
      <tr>
        <td>${r.category}</td>
        <td>${r.title}</td>
        <td>${t[r.severity] || r.severity}</td>
      </tr>`).join('');

    const opportunityRows = keyOpportunities.slice(0, 5).map(o => `
      <tr>
        <td>${o.category}</td>
        <td>${o.title}</td>
        <td>${t[o.impact] || o.impact}</td>
      </tr>`).join('');

    return `
<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${t.reportTitle}</title>
  <style>
    body { font-family: ${isEn ? 'Inter' : 'Vazirmatn'}, Arial, sans-serif; background: #fff; color: #1a1a1a; padding: 32px; max-width: 1100px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #1a1a1a; margin: 0; font-size: 22px; text-align: center; font-weight: 900; }
    h2 { color: #b88a3a; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-top: 28px; font-size: 17px; font-weight: 800; }
    .header { text-align: center; border-bottom: 3px solid #d4a853; padding-bottom: 16px; margin-bottom: 24px; }
    .header p { color: #555; margin: 4px 0; font-size: 14px; }
    .verdict { padding: 18px; border-radius: 10px; margin: 16px 0; text-align: center; font-weight: 800; font-size: 18px; }
    .verdict.proceed { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
    .verdict.reconsider { background: #fffbeb; border: 1px solid #fcd34d; color: #854d0e; }
    .verdict.mitigate { background: #eff6ff; border: 1px solid #93c5fd; color: #1e40af; }
    .verdict.avoid { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 16px 0; }
    .metric-item { background: #f8f5ef; border-radius: 8px; padding: 14px; text-align: center; }
    .metric-item .label { font-size: 12px; color: #666; font-weight: 600; margin-bottom: 4px; }
    .metric-item .value { font-size: 18px; font-weight: 800; color: #b88a3a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { padding: 10px 12px; border: 1px solid #ddd; text-align: ${isEn ? 'left' : 'right'}; }
    th { background: #f8f5ef; font-weight: 700; color: #333; }
    tr:nth-child(even) { background: #fafafa; }
    .confidence-gauge { width: 100%; height: 20px; background: #eee; border-radius: 10px; overflow: hidden; margin: 10px 0; }
    .confidence-gauge .fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e); }
    .footer { font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 30px; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${t.reportTitle}</h1>
    <p>${inputs.projectName || (isEn ? 'Investment Project' : 'مشروع استثماري')}</p>
    <p>${t.generatedOn}: ${new Date().toLocaleDateString(isEn ? 'en-US' : 'ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <div class="verdict ${decision.recommendation}">
    ${t.overallVerdict}: ${decision.label} — ${t.confidenceScore}: ${confidence.score}%
  </div>

  <div class="confidence-gauge"><div class="fill" style="width:${confidence.score}%"></div></div>

  <h2>${t.keyMetrics}</h2>
  <div class="metric-grid">
    <div class="metric-item"><div class="label">ROI</div><div class="value">${formatP(metrics.roi)}</div></div>
    <div class="metric-item"><div class="label">IRR</div><div class="value">${formatP(metrics.irr)}</div></div>
    <div class="metric-item"><div class="label">NPV</div><div class="value">${formatN(metrics.npv)} ${t.currency}</div></div>
    <div class="metric-item"><div class="label">${t.financingSummary}</div><div class="value">${formatP(financing.selfFinanceRatio)}</div></div>
    <div class="metric-item"><div class="label">${t.marketSummary}</div><div class="value">${formatP(market.marketShare)}</div></div>
    <div class="metric-item"><div class="label">${t.cashFlowSummary}</div><div class="value">${formatN(cashFlow.monthlyNetCashFlow)} ${t.currency}</div></div>
  </div>

  <h2>${t.recommendationDetails}</h2>
  <p><strong>${t.recommendation}:</strong> ${decision.basedOnEngine}</p>
  ${decision.nuances.length ? `<ul>${decision.nuances.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}

  <h2>${t.dataQuality}</h2>
  <p>${dataQuality.summary}</p>
  <p>${t.scoreLabel}: ${dataQuality.score}/100 — ${getLevelLabel(dataQuality.level, t)}</p>

  <h2>${t.riskAnalysis}</h2>
  <p>${risk.summary}</p>
  <table>
    <tr><th>${t.risks}</th><th>${isEn ? 'Description' : 'الوصف'}</th><th>${isEn ? 'Severity' : 'الشدة'}</th></tr>
    ${riskRows || `<tr><td colspan="3">${t.noData}</td></tr>`}
  </table>

  <h2>${t.keyOpportunities}</h2>
  <table>
    <tr><th>${t.opportunities}</th><th>${isEn ? 'Description' : 'الوصف'}</th><th>${isEn ? 'Impact' : 'التأثير'}</th></tr>
    ${opportunityRows || `<tr><td colspan="3">${t.noData}</td></tr>`}
  </table>

  <div class="footer">
    Bonds Global — ${isEn ? 'Investment Decision Intelligence' : 'ذكاء قرار الاستثمار'}<br>
    bonds-global.com
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

  function renderGauge(containerId, score, label, t) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const level = getLevel(score);
    const color = level === 'excellent' ? '#22c55e' : level === 'good' ? '#3b82f6' : level === 'fair' ? '#f59e0b' : '#ef4444';
    container.innerHTML = `
      <div class="di-gauge">
        <div class="di-gauge__track">
          <div class="di-gauge__fill" style="width: ${score}%; background: ${color};"></div>
        </div>
        <div class="di-gauge__value" style="color: ${color};">${score}</div>
        <div class="di-gauge__label">${label}</div>
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
      return `
        <div class="di-list-item di-list-item--${badge}">
          <div class="di-list-item__category">${item.category}</div>
          <div class="di-list-item__title">${item.title}</div>
          <div class="di-list-item__desc">${item.description}</div>
          <span class="di-list-item__badge di-list-item__badge--${badge}">${badge}</span>
        </div>`;
    }).join('');
  }

  function renderDecisionPanel(containerId, decision) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.className = `di-verdict di-verdict--${decision.recommendation}`;
    container.innerHTML = `
      <div class="di-verdict__label">${i18n[lang].recommendation}</div>
      <div class="di-verdict__value">${decision.label}</div>
      <div class="di-verdict__based">${decision.basedOnEngine}</div>
      ${decision.nuances.length ? `<ul class="di-verdict__nuances">${decision.nuances.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
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
        <div class="di-summary-item"><div class="di-summary-item__label">${t.dataQuality}</div><div class="di-summary-item__value">${dataQuality.score}/100 — ${getLevelLabel(dataQuality.level, t)}</div></div>
        <div class="di-summary-item"><div class="di-summary-item__label">${t.riskAnalysis}</div><div class="di-summary-item__value">${risk.score}/100 — ${getLevelLabel(risk.level, t)}</div></div>
        <div class="di-summary-item"><div class="di-summary-item__label">${t.financingAnalysis}</div><div class="di-summary-item__value">${finLabel}</div></div>
        <div class="di-summary-item"><div class="di-summary-item__label">${t.marketAnalysis}</div><div class="di-summary-item__value">${market.score}/100 — ${getLevelLabel(market.level, t)}</div></div>
        <div class="di-summary-item"><div class="di-summary-item__label">${t.cashFlowAnalysis}</div><div class="di-summary-item__value">${cashFlow.score}/100 — ${liqLabel}</div></div>
        <div class="di-summary-item"><div class="di-summary-item__label">${t.debtEquityRatio}</div><div class="di-summary-item__value">${financing.debtEquityRatio.toFixed(2)}</div></div>
      </div>`;
  }

  const DecisionIntelligence = {
    analyze,
    renderGauge,
    renderList,
    renderDecisionPanel,
    renderSummary,
    i18n
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecisionIntelligence;
  }
  global.DecisionIntelligence = DecisionIntelligence;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
