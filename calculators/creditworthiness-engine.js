/**
 * Creditworthiness Evaluation Engine
 * Generic engine for companies, factories, and financial bonds.
 */

(function (root) {
  'use strict';

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function scoreFromThresholds(value, thresholds) {
    // thresholds: array of {max, score} sorted by max ascending
    let prev = { max: -Infinity, score: 0 };
    for (const t of thresholds) {
      if (value <= t.max) {
        if (!isFinite(prev.max)) return t.score;
        const range = t.max - prev.max;
        const progress = range === 0 ? 0 : (value - prev.max) / range;
        return clamp(Math.round(prev.score + progress * (t.score - prev.score)), 0, 100);
      }
      prev = t;
    }
    return prev.score;
  }

  function inverseScoreFromThresholds(value, thresholds) {
    // thresholds: array of {max, score} sorted by max ascending; score decreases as value increases
    let prev = { max: -Infinity, score: 100 };
    for (const t of thresholds) {
      if (value <= t.max) {
        if (!isFinite(prev.max)) return t.score;
        const range = t.max - prev.max;
        const progress = range === 0 ? 0 : (value - prev.max) / range;
        return clamp(Math.round(prev.score + progress * (t.score - prev.score)), 0, 100);
      }
      prev = t;
    }
    return prev.score;
  }

  function safeDiv(num, den, fallback) {
    if (!den || den === 0) return fallback;
    return num / den;
  }

  function pct(v) { return (v * 100).toFixed(1) + '%'; }

  const AXIS_LABELS = {
    creditHistory: { ar: 'السجل الائتماني', en: 'Credit History' },
    solvency: { ar: 'الملاءة المالية', en: 'Solvency' },
    liquidity: { ar: 'السيولة', en: 'Liquidity' },
    profitability: { ar: 'الربحية', en: 'Profitability' },
    cashFlow: { ar: 'التدفقات النقدية', en: 'Cash Flow' },
    debt: { ar: 'المديونية', en: 'Debt' },
    governance: { ar: 'جودة الإدارة والحوكمة', en: 'Management & Governance' },
    sector: { ar: 'القطاع والسوق', en: 'Sector & Market' },
    collateral: { ar: 'الضمانات', en: 'Collateral' }
  };

  function classifyRating(score) {
    if (score >= 90) return { label: 'AAA', enLabel: 'AAA', color: '#22c55e', note: 'جودة ائتمانية ممتازة', enNote: 'Excellent credit quality' };
    if (score >= 80) return { label: 'AA', enLabel: 'AA', color: '#4ade80', note: 'جودة ائتمانية قوية جداً', enNote: 'Very strong credit quality' };
    if (score >= 70) return { label: 'A', enLabel: 'A', color: '#86efac', note: 'جودة ائتمانية جيدة', enNote: 'Good credit quality' };
    if (score >= 60) return { label: 'BBB', enLabel: 'BBB', color: '#facc15', note: 'جودة ائتمانية مقبولة', enNote: 'Adequate credit quality' };
    if (score >= 50) return { label: 'BB', enLabel: 'BB', color: '#fbbf24', note: 'جودة ائتمانية ضعيفة نسبياً', enNote: 'Moderately weak credit quality' };
    if (score >= 40) return { label: 'B', enLabel: 'B', color: '#fb923c', note: 'جودة ائتمانية ضعيفة', enNote: 'Weak credit quality' };
    return { label: 'عالي المخاطر', enLabel: 'High Risk', color: '#ef4444', note: 'جودة ائتمانية ضعيفة جداً / عالي المخاطر', enNote: 'Very weak credit quality / high risk' };
  }

  function evaluate(data, lang) {
    const isEn = lang === 'en';
    const l = (key) => AXIS_LABELS[key][isEn ? 'en' : 'ar'];

    const totalAssets = Number(data.totalAssets) || 0;
    const currentAssets = Number(data.currentAssets) || 0;
    const inventory = Number(data.inventory) || 0;
    const cash = Number(data.cash) || 0;
    const currentLiabilities = Number(data.currentLiabilities) || 0;
    const totalDebt = Number(data.totalDebt) || 0;
    const shortTermDebt = Number(data.shortTermDebt) || 0;
    const longTermDebt = Number(data.longTermDebt) || 0;
    const totalEquity = Number(data.totalEquity) || 0;
    const revenue = Number(data.revenue) || 0;
    const cogs = Number(data.cogs) || 0;
    const operatingProfit = Number(data.operatingProfit) || 0;
    const netProfit = Number(data.netProfit) || 0;
    const operatingCashFlow = Number(data.operatingCashFlow) || 0;
    const interestExpense = Number(data.interestExpense) || 0;
    const taxExpense = Number(data.taxExpense) || 0;
    const financingAmount = Number(data.financingAmount) || totalDebt || 1;

    const equityRatio = safeDiv(totalEquity, totalAssets, 0);
    const currentRatio = safeDiv(currentAssets, currentLiabilities, 0);
    const quickRatio = safeDiv(currentAssets - inventory, currentLiabilities, 0);
    const debtRatio = safeDiv(totalDebt, totalAssets, 0);
    const debtToEquity = safeDiv(totalDebt, totalEquity, 0);
    const netProfitMargin = safeDiv(netProfit, revenue, 0);
    const grossProfitMargin = safeDiv(revenue - cogs, revenue, 0);
    const roa = safeDiv(netProfit, totalAssets, 0);
    const roe = safeDiv(netProfit, totalEquity, 0);
    const operatingCashFlowMargin = safeDiv(operatingCashFlow, revenue, 0);
    const ebit = operatingProfit;
    const interestCoverage = safeDiv(ebit, interestExpense, Infinity);
    const annualDebtService = interestExpense + safeDiv(shortTermDebt + longTermDebt, 5, 0);
    const dscr = safeDiv(operatingCashFlow, annualDebtService, 0);
    const collateralCoverage = safeDiv(data.collateralTotal, financingAmount, 0);

    // 1. Credit history (10%)
    const defaultsScore = data.defaults === '0' ? 100 : data.defaults === '1' ? 40 : 0;
    const paymentScore = Number(data.paymentRegularity) || 0;
    const existingObligations = Number(data.existingObligations) || 0;
    const obligationsScore = clamp(100 - existingObligations * 15, 0, 100);
    const creditHistoryScore = Math.round(defaultsScore * 0.35 + paymentScore * 0.35 + obligationsScore * 0.30);

    // 2. Financial solvency (15%)
    const equityScore = scoreFromThresholds(equityRatio, [
      { max: 0, score: 0 }, { max: 0.10, score: 30 }, { max: 0.20, score: 50 },
      { max: 0.30, score: 70 }, { max: 0.40, score: 85 }, { max: 0.50, score: 95 }, { max: 1, score: 100 }
    ]);
    const sizeScore = scoreFromThresholds(totalAssets / 1_000_000, [
      { max: 0, score: 0 }, { max: 1, score: 40 }, { max: 5, score: 60 }, { max: 20, score: 75 }, { max: 100, score: 90 }, { max: Infinity, score: 100 }
    ]);
    const solvencyScore = Math.round(equityScore * 0.60 + sizeScore * 0.40);

    // 3. Liquidity (15%)
    const currentScore = scoreFromThresholds(currentRatio, [
      { max: 0.5, score: 20 }, { max: 1.0, score: 50 }, { max: 1.5, score: 75 }, { max: 2.0, score: 90 }, { max: 3.0, score: 100 }
    ]);
    const quickScore = scoreFromThresholds(quickRatio, [
      { max: 0.3, score: 20 }, { max: 0.6, score: 50 }, { max: 1.0, score: 75 }, { max: 1.5, score: 90 }, { max: 2.5, score: 100 }
    ]);
    const cashScore = scoreFromThresholds(safeDiv(cash, currentLiabilities, 0), [
      { max: 0.1, score: 20 }, { max: 0.25, score: 50 }, { max: 0.5, score: 75 }, { max: 1.0, score: 95 }
    ]);
    const liquidityScore = Math.round(currentScore * 0.45 + quickScore * 0.35 + cashScore * 0.20);

    // 4. Profitability (15%)
    const marginScore = scoreFromThresholds(netProfitMargin, [
      { max: -0.05, score: 0 }, { max: 0, score: 20 }, { max: 0.03, score: 40 },
      { max: 0.07, score: 60 }, { max: 0.12, score: 80 }, { max: 0.20, score: 95 }, { max: 1, score: 100 }
    ]);
    const roaScore = scoreFromThresholds(roa, [
      { max: 0, score: 10 }, { max: 0.02, score: 40 }, { max: 0.05, score: 65 }, { max: 0.10, score: 85 }, { max: 0.15, score: 100 }
    ]);
    const roeScore = scoreFromThresholds(roe, [
      { max: 0, score: 10 }, { max: 0.05, score: 45 }, { max: 0.10, score: 70 }, { max: 0.15, score: 85 }, { max: 0.25, score: 100 }
    ]);
    const profitabilityScore = Math.round(marginScore * 0.40 + roaScore * 0.30 + roeScore * 0.30);

    // 5. Cash flows (15%)
    const ocfMarginScore = scoreFromThresholds(operatingCashFlowMargin, [
      { max: -0.05, score: 0 }, { max: 0, score: 25 }, { max: 0.05, score: 55 }, { max: 0.10, score: 75 }, { max: 0.15, score: 90 }, { max: 1, score: 100 }
    ]);
    const stabilityScore = clamp(Number(data.cashFlowStability) || 50, 0, 100);
    const dscrScore = scoreFromThresholds(dscr, [
      { max: 0.8, score: 10 }, { max: 1.0, score: 35 }, { max: 1.25, score: 60 }, { max: 1.50, score: 80 }, { max: 2.0, score: 95 }
    ]);
    const cashFlowScore = Math.round(ocfMarginScore * 0.35 + dscrScore * 0.45 + stabilityScore * 0.20);

    // 6. Debt (10%)
    const debtRatioScore = inverseScoreFromThresholds(debtRatio, [
      { max: 0.20, score: 100 }, { max: 0.40, score: 80 }, { max: 0.60, score: 60 }, { max: 0.80, score: 40 }, { max: 1.0, score: 20 }
    ]);
    const deScore = inverseScoreFromThresholds(debtToEquity, [
      { max: 0.5, score: 100 }, { max: 1.0, score: 80 }, { max: 1.5, score: 60 }, { max: 2.5, score: 40 }, { max: 4.0, score: 20 }
    ]);
    const interestCoverageScore = scoreFromThresholds(interestCoverage, [
      { max: 1, score: 20 }, { max: 2, score: 50 }, { max: 3, score: 70 }, { max: 5, score: 90 }, { max: 10, score: 100 }
    ]);
    const debtScore = Math.round(debtRatioScore * 0.35 + deScore * 0.35 + interestCoverageScore * 0.30);

    // 7. Management & governance (10%)
    const expYears = Number(data.mgmtExperience) || 0;
    const expScore = scoreFromThresholds(expYears, [
      { max: 2, score: 30 }, { max: 5, score: 55 }, { max: 10, score: 80 }, { max: 15, score: 95 }
    ]);
    const transparencyScore = (Number(data.transparency) || 1) * 20;
    const riskMgmtScore = (Number(data.riskManagement) || 1) * 20;
    const governanceScore = Math.round(expScore * 0.40 + transparencyScore * 0.30 + riskMgmtScore * 0.30);

    // 8. Sector & market (5%)
    const marketGrowthScore = (Number(data.marketGrowth) || 1) * 20;
    const competitionScore = 120 - (Number(data.competition) || 1) * 20; // inverse
    const sectorRiskScore = 120 - (Number(data.sectorRisk) || 1) * 20; // inverse
    const sectorScore = Math.round((marketGrowthScore + competitionScore + sectorRiskScore) / 3);

    // 9. Collateral (5%)
    const collateralScore = scoreFromThresholds(collateralCoverage, [
      { max: 0.3, score: 20 }, { max: 0.6, score: 45 }, { max: 1.0, score: 75 }, { max: 1.5, score: 95 }
    ]);

    const weights = {
      creditHistory: 0.10,
      solvency: 0.15,
      liquidity: 0.15,
      profitability: 0.15,
      cashFlow: 0.15,
      debt: 0.10,
      governance: 0.10,
      sector: 0.05,
      collateral: 0.05
    };

    const axes = {
      creditHistory: { label: l('creditHistory'), score: creditHistoryScore, weight: weights.creditHistory },
      solvency: { label: l('solvency'), score: solvencyScore, weight: weights.solvency },
      liquidity: { label: l('liquidity'), score: liquidityScore, weight: weights.liquidity },
      profitability: { label: l('profitability'), score: profitabilityScore, weight: weights.profitability },
      cashFlow: { label: l('cashFlow'), score: cashFlowScore, weight: weights.cashFlow },
      debt: { label: l('debt'), score: debtScore, weight: weights.debt },
      governance: { label: l('governance'), score: governanceScore, weight: weights.governance },
      sector: { label: l('sector'), score: sectorScore, weight: weights.sector },
      collateral: { label: l('collateral'), score: collateralScore, weight: weights.collateral }
    };

    let totalScore = 0;
    for (const k in axes) totalScore += axes[k].score * axes[k].weight;
    totalScore = Math.round(totalScore);

    return {
      totalScore,
      rating: classifyRating(totalScore),
      axes,
      ratios: {
        equityRatio, currentRatio, quickRatio, debtRatio, debtToEquity,
        netProfitMargin, grossProfitMargin, roa, roe, operatingCashFlowMargin,
        interestCoverage, dscr, collateralCoverage
      },
      inputs: data
    };
  }

  function generateReport(result, lang) {
    const isEn = lang === 'en';
    const axes = result.axes;
    const r = result.ratios;
    const rating = result.rating;

    const sortedAxes = Object.values(axes).sort((a, b) => a.score - b.score);
    const weakest = sortedAxes.slice(0, 3);
    const strongest = sortedAxes.slice(-3).reverse();

    const strengths = strongest.filter(a => a.score >= 70).map(a => a.label);
    const weaknesses = weakest.filter(a => a.score <= 55).map(a => a.label);

    const recommendations = [];
    if (axes.liquidity.score < 60) recommendations.push(isEn ? 'Improve liquidity: accelerate receivables collection and reduce excess inventory.' : 'تحسين السيولة: تسريع تحصيل الذمم المدينة وخفض المخزون الزائد.');
    if (axes.profitability.score < 60) recommendations.push(isEn ? 'Improve profitability: review cost structure and pricing, focus on higher-margin products.' : 'رفع الربحية: مراجعة هيكل التكاليف وأسعار البيع وتركيز المنتجات الأعلى هامشاً.');
    if (axes.debt.score < 60) recommendations.push(isEn ? 'Restructure debt: extend maturities or reduce short-term borrowing.' : 'إعادة هيكلة الديون: تمديد آجال الاستحقاق أو تقليل الاقتراض قصير الأجل.');
    if (axes.cashFlow.score < 60) recommendations.push(isEn ? 'Strengthen operating cash flow: defer non-essential spending and improve cash conversion cycle.' : 'تعزيز التدفقات النقدية التشغيلية: تأجيل مصاريف غير ضرورية وتحسين دورة النقد.');
    if (axes.creditHistory.score < 60) recommendations.push(isEn ? 'Fix credit history: adhere to payment schedules and settle any defaults.' : 'تصحيح السجل الائتماني: الالتزام بمواعيد السداد وإبرام تسويات للتعثرات.');
    if (axes.collateral.score < 60) recommendations.push(isEn ? 'Increase collateral: provide additional real estate, equipment, or financial assets.' : 'زيادة الضمانات: تقديم عقارات أو معدات أو أصول مالية إضافية.');
    if (axes.governance.score < 70) recommendations.push(isEn ? 'Strengthen governance: prepare transparent periodic reports and implement risk management policy.' : 'تعزيز الحوكمة: إعداد تقارير دورية شفافة ووضع سياسة إدارة مخاطر.');
    if (axes.sector.score < 60) recommendations.push(isEn ? 'Diversify revenue and customer base to reduce sector risk.' : 'تنويع مصادر الإيرادات والعملاء لتقليل مخاطر القطاع.');
    if (recommendations.length === 0) recommendations.push(isEn ? 'Maintain current performance and work on increasing working capital.' : 'الحفاظ على الأداء الحالي والعمل على زيادة رأس المال العامل.');

    return { strengths, weaknesses, recommendations, sortedAxes, weakest, strongest };
  }

  root.CreditEngine = { evaluate, generateReport, pct };
})(window);
