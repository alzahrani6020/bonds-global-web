/**
 * Bonds V3 — Calculation Engine
 *
 * Core financial calculator for project feasibility studies.
 * Pure JavaScript, no external dependencies.
 */

const DEFAULT_PROJECTION_YEARS = 5;
const { adjustAssumptions, adjustRiskScore } = require('./city-adjustment');

function normalizeAssumptionValue(assumption) {
  if (!assumption) return 0;
  const value = Number(assumption.value);
  if (Number.isNaN(value)) return 0;

  // Percentages are stored as whole numbers (e.g. 35 means 35%)
  if (assumption.unit_type === 'percentage') {
    return value / 100;
  }
  return value;
}

function getAssumption(assumptions, code, fallback = 0) {
  const found = assumptions.find(a => a.code === code);
  return found ? normalizeAssumptionValue(found) : fallback;
}

function median(a, b) {
  return (Number(a) + Number(b)) / 2;
}

function round(num, decimals = 2) {
  return Number.isFinite(num) ? Number(num.toFixed(decimals)) : 0;
}

/**
 * Calculate Internal Rate of Return (IRR) using Newton-Raphson.
 */
function calculateIRR(cashFlows, guess = 0.1) {
  const maxIterations = 100;
  const precision = 1e-7;
  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / factor;
      derivative -= (t * cashFlows[t]) / (factor * (1 + rate));
    }

    if (Math.abs(npv) < precision) return rate;

    const newRate = rate - npv / derivative;
    if (Math.abs(newRate - rate) < precision) return newRate;
    rate = newRate;
  }

  return null;
}

/**
 * Calculate Net Present Value (NPV).
 */
function calculateNPV(cashFlows, discountRate) {
  return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + discountRate, t), 0);
}

/**
 * Build annual projections for the project.
 */
function buildProjections(inputs) {
  const years = [];
  const revenueYear1 = inputs.revenue;
  const growthRate = inputs.revenueGrowthRate;
  const cogsRatio = inputs.cogsRatio;
  const rentRatio = inputs.rentRatio;
  const salariesRatio = inputs.salariesRatio;
  const marketingRatio = inputs.marketingRatio;
  const utilitiesRatio = inputs.utilitiesRatio;
  const taxRate = inputs.taxRate;
  const depreciationRate = inputs.depreciationRate;
  const capex = inputs.capex;
  const annualDepreciation = capex * depreciationRate;

  for (let year = 1; year <= inputs.projectionYears; year++) {
    const revenue = revenueYear1 * Math.pow(1 + growthRate, year - 1);
    const cogs = revenue * cogsRatio;
    const grossProfit = revenue - cogs;

    const rent = revenue * rentRatio;
    const salaries = revenue * salariesRatio;
    const marketing = revenue * marketingRatio;
    const utilities = revenue * utilitiesRatio;
    const totalOpex = rent + salaries + marketing + utilities;

    const ebitda = grossProfit - totalOpex;
    const ebit = ebitda - annualDepreciation;
    const tax = Math.max(ebit, 0) * taxRate;
    const netProfit = ebit - tax;

    const cashFlow = netProfit + annualDepreciation;

    years.push({
      year,
      revenue: round(revenue),
      cogs: round(cogs),
      grossProfit: round(grossProfit),
      grossMargin: round((grossProfit / revenue) * 100, 2),
      rent: round(rent),
      salaries: round(salaries),
      marketing: round(marketing),
      utilities: round(utilities),
      totalOpex: round(totalOpex),
      ebitda: round(ebitda),
      ebitdaMargin: round((ebitda / revenue) * 100, 2),
      depreciation: round(annualDepreciation),
      ebit: round(ebit),
      tax: round(tax),
      netProfit: round(netProfit),
      netMargin: round((netProfit / revenue) * 100, 2),
      cashFlow: round(cashFlow)
    });
  }

  return years;
}

/**
 * Calculate loan schedule (principal + interest) if applicable.
 */
function buildLoanSchedule(inputs) {
  const loanRatio = inputs.loanRatio;
  const interestRate = inputs.interestRate;
  const termYears = inputs.loanTermYears;
  const totalInvestment = inputs.totalInvestment;
  const loanAmount = totalInvestment * loanRatio;

  if (loanAmount <= 0 || termYears <= 0) {
    return {
      loanAmount: 0,
      annualPayment: 0,
      totalInterest: 0,
      schedule: []
    };
  }

  const rate = interestRate;
  const n = termYears;
  const annualPayment = loanAmount * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);

  let balance = loanAmount;
  const schedule = [];
  let totalInterest = 0;

  for (let year = 1; year <= n; year++) {
    const interest = balance * rate;
    const principal = annualPayment - interest;
    balance -= principal;
    totalInterest += interest;

    schedule.push({
      year,
      beginningBalance: round(balance + principal),
      payment: round(annualPayment),
      interest: round(interest),
      principal: round(principal),
      endingBalance: round(Math.max(balance, 0))
    });
  }

  return {
    loanAmount: round(loanAmount),
    annualPayment: round(annualPayment),
    totalInterest: round(totalInterest),
    schedule
  };
}

/**
 * Calculate payback period in months from cash flows.
 */
function calculatePaybackMonths(cashFlows, totalInvestment) {
  let cumulative = 0;
  for (let year = 1; year < cashFlows.length; year++) {
    cumulative += cashFlows[year];
    if (cumulative >= totalInvestment) {
      const previousCumulative = cumulative - cashFlows[year];
      const fraction = (totalInvestment - previousCumulative) / cashFlows[year];
      return round((year - 1 + fraction) * 12);
    }
  }
  return null;
}

/**
 * Calculate break-even revenue.
 */
function calculateBreakEven(revenueYear1, inputs) {
  const fixedCostRatio = inputs.rentRatio + inputs.salariesRatio + inputs.utilitiesRatio + inputs.depreciationRate * (inputs.capex / revenueYear1);
  const variableCostRatio = inputs.cogsRatio + inputs.marketingRatio;

  if (variableCostRatio >= 1) return null;

  const contributionMarginRatio = 1 - variableCostRatio;
  const fixedCosts = revenueYear1 * fixedCostRatio;

  return fixedCosts / contributionMarginRatio;
}

/**
 * Calculate weighted risk score.
 */
function calculateRiskScore(risks, cityAdjustments = []) {
  if (!risks || risks.length === 0) return 50;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const risk of risks) {
    const adjustment = cityAdjustments.find(a => a.risk_factor_id === risk.risk_factor_id);
    const adjustedScore = Math.min(100, Math.max(0, risk.score + (adjustment ? Number(adjustment.adjustment) : 0)));
    const weight = Number(risk.weight) || 1;

    weightedSum += adjustedScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? round(weightedSum / totalWeight, 1) : 50;
}

/**
 * Main calculation function.
 */
function calculate(modelData, options = {}) {
  let assumptions = modelData.assumptions || [];
  const risks = modelData.risks || [];
  const cityAdjustments = modelData.cityRiskAdjustments || [];
  const model = modelData.projectModel || {};
  const cityIndicators = modelData.cityIndicators || {};
  const marketData = modelData.marketData || {};
  const countryBenchmarks = modelData.countryBenchmarks || null;

  // Apply city-level economic adjustments to assumptions
  let cityAssumptionAdjustments = [];
  if (Object.keys(cityIndicators).length > 0) {
    const adjustment = adjustAssumptions(assumptions, cityIndicators, marketData, countryBenchmarks);
    assumptions = adjustment.assumptions;
    cityAssumptionAdjustments = adjustment.adjustments;
  }

  // Inputs
  const revenue = options.revenue || median(model.revenue_min, model.revenue_max);
  const capex = options.capex || median(model.capex_min, model.capex_max);
  const projectionYears = options.projectionYears || DEFAULT_PROJECTION_YEARS;

  const inputs = {
    revenue,
    capex,
    projectionYears,
    revenueGrowthRate: getAssumption(assumptions, 'revenue_growth_rate', 0.05),
    cogsRatio: getAssumption(assumptions, 'cogs_ratio', 0.35),
    rentRatio: getAssumption(assumptions, 'rent_ratio', 0.10),
    salariesRatio: getAssumption(assumptions, 'salaries_ratio', 0.20),
    marketingRatio: getAssumption(assumptions, 'marketing_ratio', 0.03),
    utilitiesRatio: getAssumption(assumptions, 'utilities_ratio', 0.02),
    taxRate: getAssumption(assumptions, 'vat_rate', 0.15) / 100, // VAT not tax; fallback to corporate_tax_rate
    taxRateCorporate: getAssumption(assumptions, 'corporate_tax_rate', 0.20),
    depreciationRate: getAssumption(assumptions, 'annual_depreciation_rate', 0.10),
    workingCapitalDays: getAssumption(assumptions, 'working_capital_days', 30),
    discountRate: getAssumption(assumptions, 'discount_rate', 0.10),
    loanRatio: getAssumption(assumptions, 'loan_ratio', 0.50),
    interestRate: getAssumption(assumptions, 'interest_rate', 0.08),
    loanTermYears: getAssumption(assumptions, 'loan_term_years', 5)
  };

  // Use corporate tax rate for net income tax
  inputs.taxRate = inputs.taxRateCorporate;

  // Working capital and total investment
  const workingCapital = revenue * (inputs.workingCapitalDays / 365);
  const totalInvestment = capex + workingCapital;
  inputs.totalInvestment = totalInvestment;

  // Projections
  const projections = buildProjections(inputs);
  const firstYear = projections[0];
  const lastYear = projections[projections.length - 1];

  // Cash flows including initial investment
  const operatingCashFlows = projections.map(p => p.cashFlow);
  const cashFlows = [-totalInvestment, ...operatingCashFlows];

  // Loan schedule
  const loan = buildLoanSchedule(inputs);

  // Adjust cash flows for debt service if loan exists
  if (loan.loanAmount > 0) {
    for (let i = 0; i < projections.length; i++) {
      const payment = loan.schedule[i] ? loan.schedule[i].payment : 0;
      projections[i].cashFlowAfterDebt = round(projections[i].cashFlow - payment);
    }
  }

  // NPV and IRR
  const npv = calculateNPV(cashFlows, inputs.discountRate);
  const irr = calculateIRR(cashFlows);

  // Payback
  const paybackMonths = calculatePaybackMonths(cashFlows, totalInvestment);

  // Break-even
  const breakEvenRevenue = calculateBreakEven(revenue, inputs);

  // DSCR (Debt Service Coverage Ratio)
  let dscr = null;
  if (loan.annualPayment > 0) {
    const ebitdaYear1 = firstYear.ebitda;
    dscr = round(ebitdaYear1 / loan.annualPayment, 2);
  }

  // Risk
  let riskScore = calculateRiskScore(risks, cityAdjustments);
  if (Object.keys(cityIndicators).length > 0) {
    riskScore = adjustRiskScore(riskScore, cityIndicators, countryBenchmarks);
  }

  return {
    assumptions: inputs,
    model: {
      id: model.id,
      code: model.code,
      name_ar: model.name_ar,
      name_en: model.name_en
    },
    investment: {
      capex: round(capex),
      workingCapital: round(workingCapital),
      totalInvestment: round(totalInvestment)
    },
    summary: {
      annualRevenue: firstYear.revenue,
      annualProfit: firstYear.netProfit,
      grossMargin: firstYear.grossMargin,
      ebitdaMargin: firstYear.ebitdaMargin,
      netMargin: firstYear.netMargin,
      paybackMonths,
      roiMonths: paybackMonths,
      breakEvenRevenue: breakEvenRevenue ? round(breakEvenRevenue) : null,
      npv: round(npv),
      irr: irr !== null ? round(irr * 100, 2) : null,
      dscr
    },
    projections,
    loan,
    risk: {
      score: riskScore,
      level: riskScore < 40 ? 'low' : riskScore < 60 ? 'medium' : 'high'
    },
    cityAdjustments: cityAssumptionAdjustments,
    cityIndicators: Object.keys(cityIndicators).length > 0 ? {
      gdp_city: cityIndicators.gdp_city,
      growth_rate: cityIndicators.growth_rate,
      unemployment_rate: cityIndicators.unemployment_rate,
      avg_rent_per_sqm: cityIndicators.avg_rent_per_sqm,
      purchasing_power_index: cityIndicators.purchasing_power_index,
      business_ease_index: cityIndicators.business_ease_index,
      overall_confidence: cityIndicators.overall_confidence
    } : null
  };
}

/**
 * Generate a human-readable recommendation in Arabic.
 */
function recommend(calcResult, marketData = {}) {
  const { summary, risk } = calcResult;
  const parts = [];

  if (summary.npv > 0 && summary.irr > 15) {
    parts.push('المشروع مربح من الناحية المالية');
  } else if (summary.npv > 0) {
    parts.push('المشروع يحقق عائداً إيجابياً لكنه محدود');
  } else {
    parts.push('المشروع غير مربح حالياً من الناحية المالية');
  }

  if (summary.paybackMonths && summary.paybackMonths <= 24) {
    parts.push('وفترة استرداد رأس المال قصيرة نسبياً');
  } else if (summary.paybackMonths && summary.paybackMonths > 36) {
    parts.push('لكن فترة الاسترداد طويلة');
  }

  if (risk.level === 'high') {
    parts.push('مع ذلك، المخاطر مرتفعة وتحتاج إلى تخفيف');
  } else if (risk.level === 'low') {
    parts.push('المخاطر منخفضة نسبياً');
  }

  if (marketData.market_saturation_score > 70) {
    parts.push('السوق يعاني من إشباع عالٍ');
  } else if (marketData.market_saturation_score < 40) {
    parts.push('السوق يحمل فرصة جيدة');
  }

  return parts.join('، ') + '.';
}

module.exports = {
  calculate,
  recommend,
  calculateNPV,
  calculateIRR,
  calculateRiskScore,
  getAssumption
};
