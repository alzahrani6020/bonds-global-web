'use strict';

const { runFinancialEngine } = require('../finance/financial-engine-registry');

const SCENARIO_TYPES = new Set(['what_if', 'forecast', 'stress']);

function text(value, max = 200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function finite(value, field, { min = -Infinity, max = Infinity, required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error(field + ' required');
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(field + ' must be numeric');
  if (n < min || n > max) throw new Error(field + ' out of range');
  return n;
}

function integer(value, field, options = {}) {
  const n = finite(value, field, options);
  if (n === null) return null;
  if (!Number.isInteger(n)) throw new Error(field + ' must be integer');
  return n;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined)
  );
}

function confidenceLabel(engineResult) {
  const score = Number(engineResult?.metrics?.simulation_confidence);
  if (Number.isFinite(score) && score >= 75) return 'high';
  if (Number.isFinite(score) && score >= 45) return 'medium';
  if (engineResult?.ok) return 'low';
  return 'unknown';
}

function validateAndRunScenario(body = {}) {
  const name = text(body.name, 160);
  if (!name) throw new Error('name required');

  const scenarioType = text(body.scenario_type || 'what_if', 40);
  if (!SCENARIO_TYPES.has(scenarioType)) throw new Error('invalid scenario_type');

  const raw = body.inputs && typeof body.inputs === 'object' && !Array.isArray(body.inputs)
    ? body.inputs
    : {};

  const annualRevenue = finite(raw.annual_revenue, 'annual_revenue', { min: 0 });
  const annualCosts = finite(raw.annual_costs, 'annual_costs', { min: 0 });
  const initialInvestment = finite(raw.initial_investment, 'initial_investment', { min: 0 });
  const annualNetCashFlow = finite(raw.annual_net_cash_flow, 'annual_net_cash_flow');
  const totalDebtService = finite(raw.total_debt_service, 'total_debt_service', { min: 0 });
  const growthRatePct = finite(raw.growth_rate_pct, 'growth_rate_pct', { min: -100, max: 1000 });
  const costGrowthRatePct = finite(raw.cost_growth_rate_pct, 'cost_growth_rate_pct', { min: -100, max: 1000 });
  const discountRatePct = finite(raw.discount_rate_pct, 'discount_rate_pct', { min: -50, max: 100 });
  const years = integer(raw.years, 'years', { min: 1, max: 30 });

  const assumptions = body.assumptions && typeof body.assumptions === 'object' && !Array.isArray(body.assumptions)
    ? body.assumptions
    : {};

  const iterations = integer(assumptions.iterations, 'iterations', { min: 100, max: 50000 });
  const revenueVolatilityPct = finite(assumptions.revenue_volatility_pct, 'revenue_volatility_pct', { min: 0, max: 100 });
  const costVolatilityPct = finite(assumptions.cost_volatility_pct, 'cost_volatility_pct', { min: 0, max: 100 });
  const shockCorrelation = finite(assumptions.shock_correlation, 'shock_correlation', { min: -1, max: 1 });
  const seed = integer(assumptions.seed, 'seed', { min: 1, max: 4294967295 });

  if (
    annualRevenue === null &&
    annualCosts === null &&
    (initialInvestment === null || annualNetCashFlow === null)
  ) {
    throw new Error('scenario requires annual revenue/cost forecast inputs or initial investment plus annual net cash flow');
  }

  const normalizedInputs = compactObject({
    annual_revenue: annualRevenue,
    annual_costs: annualCosts,
    growth_rate: growthRatePct === null ? null : growthRatePct / 100,
    cost_growth_rate: costGrowthRatePct === null ? null : costGrowthRatePct / 100,
    years,
    initial_investment: initialInvestment,
    annual_net_cash_flow: annualNetCashFlow,
    total_debt_service: totalDebtService,
    discount_rate: discountRatePct === null ? null : discountRatePct / 100
  });

  const simulationConfig = compactObject({
    iterations,
    years,
    discountRate: discountRatePct === null ? null : discountRatePct / 100,
    revenueVolatility: revenueVolatilityPct === null ? null : revenueVolatilityPct / 100,
    costVolatility: costVolatilityPct === null ? null : costVolatilityPct / 100,
    shockCorrelation,
    seed
  });

  const engineInput = {
    ...normalizedInputs,
    simulation_config: simulationConfig
  };
  const engineResult = runFinancialEngine('scenario_forecast', engineInput);

  if (!engineResult?.ok) {
    const required = Array.isArray(engineResult?.required_inputs)
      ? engineResult.required_inputs.join(',')
      : 'scenario_inputs';
    throw new Error('scenario engine requires: ' + required);
  }

  return {
    name,
    scenario_type: scenarioType,
    inputs: {
      annual_revenue: annualRevenue,
      annual_costs: annualCosts,
      growth_rate_pct: growthRatePct,
      cost_growth_rate_pct: costGrowthRatePct,
      years,
      initial_investment: initialInvestment,
      annual_net_cash_flow: annualNetCashFlow,
      total_debt_service: totalDebtService,
      discount_rate_pct: discountRatePct
    },
    assumptions: {
      source: 'manual_explicit',
      iterations,
      revenue_volatility_pct: revenueVolatilityPct,
      cost_volatility_pct: costVolatilityPct,
      shock_correlation: shockCorrelation,
      seed
    },
    outputs: {
      engine: 'scenario_forecast',
      forecast: engineResult.metrics?.forecast || [],
      simulation: engineResult.metrics?.simulation || null,
      simulation_status: engineResult.metrics?.simulation_status || null,
      simulation_confidence: engineResult.metrics?.simulation_confidence ?? null,
      diagnostics: engineResult.diagnostics || {}
    },
    confidence: confidenceLabel(engineResult),
    engineResult
  };
}

module.exports = {
  SCENARIO_TYPES,
  validateAndRunScenario
};
