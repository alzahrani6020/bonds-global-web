/**
 * Bonds Investment Center Engine
 * Unified financial calculations and smart investment recommendations.
 */
(function (global) {
  'use strict';

  const DISCOUNT_RATE = 0.10; // 10% default discount rate

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Calculate Net Present Value (NPV)
   * cashFlows: array of net cash flows (first element is initial investment, negative)
   * discountRate: annual discount rate (e.g. 0.10)
   */
  function calculateNPV(cashFlows, discountRate = DISCOUNT_RATE) {
    if (!Array.isArray(cashFlows) || cashFlows.length === 0) return 0;
    let npv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + discountRate, i);
    }
    return npv;
  }

  /**
   * Calculate Internal Rate of Return (IRR) using Newton-Raphson method
   * cashFlows: array of net cash flows (first element is initial investment, negative)
   */
  function calculateIRR(cashFlows, guess = 0.1) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) return 0;

    const maxIterations = 100;
    const tolerance = 1e-7;
    let rate = guess;

    function npv(rate) {
      let total = 0;
      for (let i = 0; i < cashFlows.length; i++) {
        total += cashFlows[i] / Math.pow(1 + rate, i);
      }
      return total;
    }

    function npvDerivative(rate) {
      let total = 0;
      for (let i = 1; i < cashFlows.length; i++) {
        total -= i * cashFlows[i] / Math.pow(1 + rate, i + 1);
      }
      return total;
    }

    for (let i = 0; i < maxIterations; i++) {
      const value = npv(rate);
      const derivative = npvDerivative(rate);
      if (Math.abs(derivative) < tolerance) break;
      const newRate = rate - value / derivative;
      if (Math.abs(newRate - rate) < tolerance) return newRate;
      rate = newRate;
    }

    return rate;
  }

  /**
   * Calculate Return on Investment (ROI)
   */
  function calculateROI(netProfit, totalInvestment) {
    if (totalInvestment <= 0) return 0;
    return (netProfit / totalInvestment) * 100;
  }

  /**
   * Calculate Payback Period in months
   */
  function calculatePaybackMonths(totalInvestment, monthlyNetCashFlow) {
    if (monthlyNetCashFlow <= 0) return Infinity;
    return totalInvestment / monthlyNetCashFlow;
  }

  /**
   * Calculate Break Even Point
   * Returns both units and revenue amount.
   */
  function calculateBreakEven(fixedCosts, unitPrice, unitVariableCost) {
    const contributionMargin = unitPrice - unitVariableCost;
    if (contributionMargin <= 0) {
      return { units: Infinity, revenue: Infinity };
    }
    const units = fixedCosts / contributionMargin;
    return {
      units: Math.ceil(units),
      revenue: units * unitPrice
    };
  }

  /**
   * Calculate Profit Margin
   */
  function calculateProfitMargin(netProfit, revenue) {
    if (revenue <= 0) return 0;
    return (netProfit / revenue) * 100;
  }

  /**
   * Calculate Risk Score (0-100)
   * Higher = riskier
   */
  function calculateRiskScore(inputs, metrics, sectorRiskWeight = 1) {
    let score = 0;

    // Payback period risk: longer payback = higher risk
    if (!Number.isFinite(metrics.paybackMonths) || metrics.paybackMonths > 72) {
      score += 35;
    } else if (metrics.paybackMonths > 48) {
      score += 25;
    } else if (metrics.paybackMonths > 24) {
      score += 15;
    } else {
      score += 5;
    }

    // Profit margin risk: lower margin = higher risk
    if (metrics.profitMargin < 10) {
      score += 25;
    } else if (metrics.profitMargin < 20) {
      score += 15;
    } else if (metrics.profitMargin < 30) {
      score += 8;
    } else {
      score += 3;
    }

    // Fixed cost ratio risk
    const fixedCostRatio = inputs.totalInvestment > 0
      ? (inputs.monthlyFixedCosts * 12) / inputs.totalInvestment
      : 0;
    if (fixedCostRatio > 1.5) {
      score += 20;
    } else if (fixedCostRatio > 1.0) {
      score += 12;
    } else {
      score += 5;
    }

    // Sector risk weight
    score += (sectorRiskWeight - 1) * 5;

    // NPV negative adds risk
    if (metrics.npv <= 0) score += 15;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Generate smart investment recommendation
   */
  function generateRecommendation(metrics) {
    const reasons = [];
    let decision = '';
    let decisionKey = '';
    let color = '';

    const roi = metrics.roi;
    const irr = metrics.irr;
    const npv = metrics.npv;
    const payback = metrics.paybackMonths;
    const risk = metrics.riskScore;

    if (roi < 8 || irr < 0.08 || npv <= 0) {
      decision = 'غير موصى به';
      decisionKey = 'not_recommended';
      color = '#ef4444';
      if (roi < 8) reasons.push('معدل العائد على الاستثمار منخفض جدًا.');
      if (irr < 0.08) reasons.push('معدل العائد الداخلي أقل من 8%.');
      if (npv <= 0) reasons.push('القيمة الحالية الصافية غير إيجابية.');
    } else if (payback > 72 || risk > 75) {
      decision = 'عالي المخاطر';
      decisionKey = 'high_risk';
      color = '#f97316';
      if (payback > 72) reasons.push('فترة استرداد رأس المال تتجاوز 6 سنوات.');
      if (risk > 75) reasons.push('درجة المخاطر مرتفعة بسبب الهامش أو التكاليف الثابتة.');
    } else if (roi < 15 || irr < 0.12 || payback > 48 || risk > 60) {
      decision = 'يحتاج إعادة دراسة';
      decisionKey = 'reconsider';
      color = '#eab308';
      if (roi < 15) reasons.push('معدل العائد على الاستثمار أقل من 15%.');
      if (irr < 0.12) reasons.push('معدل العائد الداخلي أقل من 12%.');
      if (payback > 48) reasons.push('فترة الاسترداد تتجاوز 4 سنوات.');
      if (risk > 60) reasons.push('درجة المخاطر متوسطة إلى مرتفعة.');
    } else if (roi >= 25 && irr >= 0.20 && payback <= 24 && risk <= 40) {
      decision = 'مناسب للاستثمار';
      decisionKey = 'recommended';
      color = '#22c55e';
      reasons.push('معدل عائد ممتاز يتجاوز 25%.');
      reasons.push('فترة استرداد رأس المال قصيرة (24 شهرًا أو أقل).');
      reasons.push('درجة المخاطر منخفضة.');
    } else {
      decision = 'مناسب بشروط';
      decisionKey = 'conditional';
      color = '#3b82f6';
      reasons.push('المؤشرات المالية إيجابية لكنها تحتاج إلى شروط تشغيلية.');
      if (roi < 25) reasons.push('معدل العائد جيد لكن يمكن تحسينه.');
      if (payback > 24) reasons.push('فترة الاسترداد مقبولة لكن مراقبة التدفقات النقدية ضرورية.');
      if (risk > 40) reasons.push('هناك مخاطر متوسطة يجب إدارتها.');
    }

    return { decision, decisionKey, color, reasons };
  }

  /**
   * Main analyze function
   * inputs object should contain:
   * - totalInvestment (initial setup cost)
   * - monthlyFixedCosts
   * - monthlyVariableCosts
   * - monthlyRevenue
   * - unitPrice (optional, for break-even)
   * - unitVariableCost (optional, for break-even)
   * - projectMonths (optional, default 60)
   * - sectorRiskWeight (optional, default 1)
   */
  function analyze(inputs) {
    const totalInvestment = toNumber(inputs.totalInvestment);
    const monthlyFixedCosts = toNumber(inputs.monthlyFixedCosts);
    const monthlyVariableCosts = toNumber(inputs.monthlyVariableCosts);
    const monthlyRevenue = toNumber(inputs.monthlyRevenue);
    const monthlyNetCashFlow = monthlyRevenue - monthlyFixedCosts - monthlyVariableCosts;
    const projectMonths = Math.max(12, Math.min(120, toNumber(inputs.projectMonths, 60)));
    const unitPrice = toNumber(inputs.unitPrice, 0);
    const unitVariableCost = toNumber(inputs.unitVariableCost, 0);

    // Build cash flows: initial investment + monthly net cash flows
    const cashFlows = [-totalInvestment];
    for (let i = 0; i < projectMonths; i++) {
      cashFlows.push(monthlyNetCashFlow);
    }

    const roi = calculateROI(monthlyNetCashFlow * projectMonths - totalInvestment, totalInvestment);
    const irr = calculateIRR(cashFlows);
    const npv = calculateNPV(cashFlows);
    const paybackMonths = calculatePaybackMonths(totalInvestment, monthlyNetCashFlow);
    const profitMargin = calculateProfitMargin(monthlyNetCashFlow, monthlyRevenue);

    const breakEven = (unitPrice > 0 && unitVariableCost >= 0)
      ? calculateBreakEven(monthlyFixedCosts, unitPrice, unitVariableCost)
      : { units: 0, revenue: 0 };

    const metrics = {
      roi: parseFloat(roi.toFixed(2)),
      irr: parseFloat((irr * 100).toFixed(2)),
      npv: parseFloat(npv.toFixed(2)),
      paybackMonths: Number.isFinite(paybackMonths) ? parseFloat(paybackMonths.toFixed(1)) : Infinity,
      profitMargin: parseFloat(profitMargin.toFixed(2)),
      breakEvenUnits: breakEven.units,
      breakEvenRevenue: parseFloat(breakEven.revenue.toFixed(2)),
      monthlyNetCashFlow: parseFloat(monthlyNetCashFlow.toFixed(2)),
      totalInvestment,
      projectMonths
    };

    metrics.riskScore = calculateRiskScore(
      { totalInvestment, monthlyFixedCosts },
      { ...metrics, paybackMonths },
      toNumber(inputs.sectorRiskWeight, 1)
    );

    const recommendation = generateRecommendation(metrics);

    return {
      success: true,
      metrics,
      recommendation,
      cashFlows: cashFlows.slice(0, 13) // first year summary only
    };
  }

  // English aliases
  function analyzeEn(inputs) {
    const result = analyze(inputs);
    if (!result.success) return result;

    const rec = result.recommendation;
    const enDecisionMap = {
      recommended: 'Recommended for Investment',
      conditional: 'Suitable with Conditions',
      reconsider: 'Needs Re-evaluation',
      high_risk: 'High Risk',
      not_recommended: 'Not Recommended'
    };

    return {
      ...result,
      recommendation: {
        ...rec,
        decision: enDecisionMap[rec.decisionKey] || rec.decision
      }
    };
  }

  const InvestmentEngine = {
    analyze,
    analyzeEn,
    calculateNPV,
    calculateIRR,
    calculateROI,
    calculatePaybackMonths,
    calculateBreakEven,
    calculateProfitMargin,
    calculateRiskScore,
    generateRecommendation
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InvestmentEngine;
  }
  global.InvestmentEngine = InvestmentEngine;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
