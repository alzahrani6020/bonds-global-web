/**
 * Bonds Investment Risk Engine
 * Lightweight Monte Carlo, VaR/CVaR, and Goal Seek using the existing InvestmentEngine.
 * Works across all Investment Center sectors without requiring Pro-Forma statements.
 */
(function (global) {
  'use strict';

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function percentile(sorted, p) {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }

  function calculateVaR(values, confidence) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const p = 1 - confidence;
    return percentile(sorted, p);
  }

  function calculateCVaR(values, confidence) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const p = 1 - confidence;
    const thresholdIndex = Math.floor((sorted.length - 1) * p);
    const tail = sorted.slice(0, thresholdIndex + 1);
    if (tail.length === 0) return sorted[0];
    return tail.reduce((a, b) => a + b, 0) / tail.length;
  }

  /**
   * Run a lightweight Monte Carlo simulation by perturbing raw inputs.
   * @param {Object} baseInputs - raw sector inputs
   * @param {Array} variables - [{ field, type: 'triangular'|'uniform', min, max, mode }]
   * @param {number} iterations
   * @param {Function} analyzeFn - function(inputs) => { metrics: { npv, irr, roi, paybackMonths } }
   * @returns {Object} simulation results
   */
  function runMonteCarlo(baseInputs, variables, iterations, analyzeFn) {
    const npvs = [];
    const irrs = [];
    const rois = [];
    const successFlags = [];
    const samples = [];

    for (let i = 0; i < iterations; i++) {
      const scenarioInputs = { ...baseInputs };
      const variableValues = {};
      variables.forEach(v => {
        const sampled = sampleVariable(v);
        scenarioInputs[v.field] = sampled;
        variableValues[v.field] = round(sampled);
      });

      try {
        const result = analyzeFn(scenarioInputs);
        const metrics = result && result.metrics ? result.metrics : {};
        const npv = toNumber(metrics.npv);
        const irr = toNumber(metrics.irr);
        const roi = toNumber(metrics.roi);
        npvs.push(npv);
        irrs.push(irr);
        rois.push(roi);
        successFlags.push(npv > 0 ? 1 : 0);
        samples.push({ iteration: i + 1, variables: variableValues, npv: round(npv), irr: round(irr), roi: round(roi) });
      } catch (err) {
        // ignore failed scenarios
      }
    }

    return {
      iterations: npvs.length,
      npv: summarizeDistribution(npvs),
      irr: summarizeDistribution(irrs),
      roi: summarizeDistribution(rois),
      successRate: npvs.length > 0 ? (successFlags.reduce((a, b) => a + b, 0) / npvs.length) : 0,
      histogram: buildHistogram(npvs, 12),
      risk: {
        var95: round(calculateVaR(npvs, 0.95)),
        cvar95: round(calculateCVaR(npvs, 0.95)),
        var99: round(calculateVaR(npvs, 0.99)),
        cvar99: round(calculateCVaR(npvs, 0.99))
      },
      variables,
      samples
    };
  }

  function sampleVariable(v) {
    if (v.type === 'triangular') {
      const { min, max, mode } = v;
      const u = Math.random();
      const f = (mode - min) / (max - min);
      if (u <= f) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
      }
      return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }
    if (v.type === 'uniform') {
      return v.min + Math.random() * (v.max - v.min);
    }
    // default normal
    let u = 0, w = 0;
    while (w === 0) {
      u = Math.random() * 2 - 1;
      w = u * u + (Math.random() * 2 - 1) ** 2;
    }
    w = Math.sqrt(-2 * Math.log(w) / w);
    const sample = u * w * (v.stddev || 0) + (v.mean || 0);
    if (v.min !== undefined && sample < v.min) return v.min;
    if (v.max !== undefined && sample > v.max) return v.max;
    return sample;
  }

  function summarizeDistribution(values) {
    if (values.length === 0) return { mean: 0, median: 0, p5: 0, p95: 0, min: 0, max: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return {
      mean: round(mean),
      median: round(percentile(sorted, 0.5)),
      p5: round(percentile(sorted, 0.05)),
      p95: round(percentile(sorted, 0.95)),
      min: round(sorted[0]),
      max: round(sorted[sorted.length - 1])
    };
  }

  function buildHistogram(values, bins) {
    if (values.length === 0) return { labels: [], counts: [] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / bins || 1;
    const counts = new Array(bins).fill(0);
    values.forEach(v => {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)));
      counts[idx]++;
    });
    const labels = [];
    for (let i = 0; i < bins; i++) {
      labels.push(round(min + i * step) + ' - ' + round(min + (i + 1) * step));
    }
    return { labels, counts };
  }

  /**
   * Goal Seek using binary search on a raw input field.
   * @param {Object} baseInputs - raw sector inputs
   * @param {string} targetField - input field to solve for
   * @param {string} targetMetric - metric from InvestmentEngine (npv, irr, roi, paybackMonths)
   * @param {number} targetValue - desired value
   * @param {number} min - lower bound
   * @param {number} max - upper bound
   * @param {Function} analyzeFn - function(inputs) => { metrics }
   * @returns {Object} { found, value, iterations }
   */
  function goalSeek(baseInputs, targetField, targetMetric, targetValue, min, max, analyzeFn) {
    let lower = toNumber(min, 0);
    let upper = toNumber(max, lower + 1000);
    const tolerance = 0.001;
    const maxIterations = 50;

    function evaluate(value) {
      const inputs = { ...baseInputs, [targetField]: value };
      const result = analyzeFn(inputs);
      const metric = result && result.metrics ? result.metrics[targetMetric] : 0;
      return toNumber(metric) - targetValue;
    }

    let upperValue = evaluate(upper);
    let expansionCount = 0;
    while (upperValue < 0 && expansionCount < 20) {
      upper *= 2;
      upperValue = evaluate(upper);
      expansionCount++;
    }

    let lowerValue = evaluate(lower);
    let upperVal = upperValue;

    if (lowerValue * upperVal > 0) {
      return { found: false, value: null, reason: 'No sign change in range', bestValue: lower, bestError: lowerValue };
    }

    for (let i = 0; i < maxIterations; i++) {
      const mid = (lower + upper) / 2;
      const midValue = evaluate(mid);
      if (Math.abs(midValue) < tolerance) {
        return { found: true, value: round(mid), iterations: i + 1 };
      }
      if (midValue * lowerValue > 0) {
        lower = mid;
        lowerValue = midValue;
      } else {
        upper = mid;
        upperVal = midValue;
      }
    }

    const bestValue = round((lower + upper) / 2);
    return { found: true, value: bestValue, iterations: maxIterations, approximate: true };
  }

  /**
   * Detect anomalies / unrealistic inputs or results.
   * Returns array of warning objects: { type, field, message, severity }
   */
  function detectAnomalies(inputs, engineResult, lang = 'ar') {
    const t = {
      ar: {
        roiTooHigh: 'معدل العائد على الاستثمار غير واقعي (أكثر من 500%).',
        irrTooHigh: 'معدل العائد الداخلي غير واقعي (أكثر من 200%).',
        marginTooHigh: 'هامش الربح مرتفع جداً (أكثر من 90%).',
        marginNegative: 'هامش الربح سلبي؛ المشروع يخسر على كل وحدة.',
        npvTooHigh: 'NPV أعلى بكثير من الاستثمار؛ راجع الإيرادات أو التكاليف.',
        paybackTooLong: 'فترة الاسترداد أطول من مدة المشروع.',
        priceBelowCost: 'سعر البيع أقل من التكلفة المتغيرة.',
        lowSuccessRate: 'نسبة نجاح المحاكاة منخفضة (أقل من 30%).'
      },
      en: {
        roiTooHigh: 'Return on investment is unrealistic (over 500%).',
        irrTooHigh: 'Internal rate of return is unrealistic (over 200%).',
        marginTooHigh: 'Profit margin is extremely high (over 90%).',
        marginNegative: 'Profit margin is negative; the project loses money per unit.',
        npvTooHigh: 'NPV is much higher than investment; review revenue or costs.',
        paybackTooLong: 'Payback period exceeds project duration.',
        priceBelowCost: 'Selling price is below variable cost.',
        lowSuccessRate: 'Monte Carlo success rate is low (under 30%).'
      }
    };
    const m = (engineResult && engineResult.metrics) || {};
    const warnings = [];

    if (m.roi > 500) warnings.push({ type: 'metric', field: 'roi', message: t[lang].roiTooHigh, severity: 'high' });
    if (m.irr > 200) warnings.push({ type: 'metric', field: 'irr', message: t[lang].irrTooHigh, severity: 'high' });
    if (m.profitMargin > 90) warnings.push({ type: 'metric', field: 'profitMargin', message: t[lang].marginTooHigh, severity: 'medium' });
    if (m.profitMargin < 0) warnings.push({ type: 'metric', field: 'profitMargin', message: t[lang].marginNegative, severity: 'high' });
    if (Math.abs(m.npv) > (m.totalInvestment || 1) * 10 && m.npv > 0) warnings.push({ type: 'metric', field: 'npv', message: t[lang].npvTooHigh, severity: 'medium' });
    if (m.paybackMonths > (m.projectMonths || 60)) warnings.push({ type: 'metric', field: 'paybackMonths', message: t[lang].paybackTooLong, severity: 'high' });

    // Price below variable cost heuristic
    const priceFields = ['unitPrice', 'bottlePrice', 'avgTicket', 'subscriptionPrice', 'pricePerKg', 'revenuePerTrip', 'avgDailyRate', 'monthlyFee', 'avgDailyRevenue', 'avgDailyRevenuePerBed', 'avgMonthlyRevenuePerClinic', 'sellingPricePerUnit', 'sellingPricePerVilla', 'sellingPricePerApartment'];
    const costFields = ['rawMaterialCost', 'rawMaterialCostPerUnit', 'bottleCostPerUnit', 'foodCostRate', 'materialCostRate', 'operationalCostPerKg', 'fuelMaintenance', 'monthlyServers', 'costPerUnit'];
    const priceField = priceFields.find(f => Number.isFinite(inputs[f]) && inputs[f] > 0);
    const unitCostField = costFields.find(f => Number.isFinite(inputs[f]) && inputs[f] > 0);
    if (priceField && unitCostField && inputs[priceField] < inputs[unitCostField]) {
      warnings.push({ type: 'input', field: priceField, message: t[lang].priceBelowCost, severity: 'high' });
    }

    return warnings;
  }

  /**
   * Lightweight Working Capital adjustment for the generic InvestmentEngine.
   * Computes initial NWC investment from DSO/DIO/DPO and adjusts the first/last cash flows.
   */
  const sectorWorkingCapitalDefaults = {
    'water-factory': { dsoDays: 30, dioDays: 20, dpoDays: 30 },
    'food-factory': { dsoDays: 35, dioDays: 25, dpoDays: 30 },
    'industrial': { dsoDays: 45, dioDays: 30, dpoDays: 35 },
    'real-estate': { dsoDays: 15, dioDays: 5, dpoDays: 45 },
    'restaurants': { dsoDays: 5, dioDays: 10, dpoDays: 15 },
    'technology': { dsoDays: 30, dioDays: 0, dpoDays: 15 },
    'retail': { dsoDays: 10, dioDays: 35, dpoDays: 30 },
    'medical': { dsoDays: 45, dioDays: 15, dpoDays: 30 },
    'logistics': { dsoDays: 30, dioDays: 5, dpoDays: 20 },
    'tourism': { dsoDays: 15, dioDays: 10, dpoDays: 30 },
    'agriculture': { dsoDays: 20, dioDays: 25, dpoDays: 20 },
    'default': { dsoDays: 30, dioDays: 15, dpoDays: 30 }
  };

  function getWorkingCapitalDefaults(sectorId) {
    return sectorWorkingCapitalDefaults[sectorId] || sectorWorkingCapitalDefaults['default'];
  }

  function calculateWorkingCapitalInvestment(monthlyRevenue, monthlyCOGS, monthlyOpEx, dsoDays, dioDays, dpoDays) {
    const ar = monthlyRevenue * (dsoDays / 30);
    const inventory = monthlyCOGS * (dioDays / 30);
    const ap = monthlyOpEx * (dpoDays / 30);
    return ar + inventory - ap;
  }

  /**
   * Adjust a flat cash-flow engine result to account for working capital.
   * Returns new metrics and a workingCapital summary.
   */
  function applyWorkingCapital(inputs, engineResult, sectorId) {
    const defaults = getWorkingCapitalDefaults(sectorId);
    const dsoDays = toNumber(inputs.dsoDays, defaults.dsoDays);
    const dioDays = toNumber(inputs.dioDays, defaults.dioDays);
    const dpoDays = toNumber(inputs.dpoDays, defaults.dpoDays);

    const m = engineResult && engineResult.metrics ? engineResult.metrics : {};
    const monthlyRevenue = toNumber(m.monthlyRevenue, inputs.monthlyRevenue);
    const monthlyCOGS = toNumber(m.monthlyVariableCosts, inputs.monthlyVariableCosts);
    const monthlyOpEx = toNumber(m.monthlyFixedCosts, inputs.monthlyFixedCosts);
    const projectMonths = toNumber(m.projectMonths, inputs.projectMonths, 60);

    if (!monthlyRevenue || !projectMonths) {
      return { ...engineResult, workingCapital: { dsoDays, dioDays, dpoDays, investment: 0 } };
    }

    const wcInvestment = calculateWorkingCapitalInvestment(monthlyRevenue, monthlyCOGS, monthlyOpEx, dsoDays, dioDays, dpoDays);
    if (wcInvestment <= 0) {
      return { ...engineResult, workingCapital: { dsoDays, dioDays, dpoDays, investment: 0 } };
    }

    // Rebuild cash flows: initial outlay + WC outlay, then flat net cash flow, final month recovers WC
    const monthlyNet = toNumber(m.monthlyNetCashFlow, monthlyRevenue - monthlyCOGS - monthlyOpEx);
    const totalInvestment = toNumber(m.totalInvestment, inputs.totalInvestment);
    const cashFlows = new Array(projectMonths + 1).fill(monthlyNet);
    cashFlows[0] = -(totalInvestment + wcInvestment);
    cashFlows[cashFlows.length - 1] += wcInvestment;

    const monthlyRate = 0.10 / 12;
    const npv = calculateNPV(cashFlows, monthlyRate);
    const irr = calculateIRR(cashFlows);
    const roi = totalInvestment > 0 ? ((monthlyNet * projectMonths + wcInvestment) / (totalInvestment + wcInvestment) - 1) * 100 : 0;
    const paybackMonths = monthlyNet > 0 ? (totalInvestment + wcInvestment) / monthlyNet : Infinity;

    return {
      ...engineResult,
      metrics: {
        ...m,
        npv: round(npv),
        irr: round(irr),
        roi: round(roi),
        paybackMonths: round(paybackMonths),
        workingCapitalInvestment: round(wcInvestment)
      },
      workingCapital: { dsoDays, dioDays, dpoDays, investment: round(wcInvestment) }
    };
  }

  // Minimal NPV/IRR helpers for working-capital recalculation (matching investment-engine logic)
  function calculateNPV(cashFlows, monthlyRate) {
    return cashFlows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + monthlyRate, i), 0);
  }

  function calculateIRR(cashFlows, guess = 0.1) {
    const maxIterations = 50;
    const tolerance = 1e-6;
    let rate = guess;
    for (let i = 0; i < maxIterations; i++) {
      const npv = cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
      const derivative = cashFlows.reduce((acc, cf, t) => acc - t * cf / Math.pow(1 + rate, t + 1), 0);
      if (Math.abs(derivative) < 1e-12) return rate * 12 * 100;
      const nextRate = rate - npv / derivative;
      if (Math.abs(nextRate - rate) < tolerance) return nextRate * 12 * 100;
      rate = nextRate;
    }
    return rate * 12 * 100;
  }

  const InvestmentRiskEngine = {
    runMonteCarlo,
    goalSeek,
    calculateVaR,
    calculateCVaR,
    detectAnomalies,
    applyWorkingCapital,
    getWorkingCapitalDefaults,
    calculateWorkingCapitalInvestment
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InvestmentRiskEngine;
  }
  global.InvestmentRiskEngine = InvestmentRiskEngine;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
