'use strict';

const { SimulationEngine } = require('../decision-os/simulation-engine');

const ENGINE_VERSION = '1.0.0';

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeDiv(a, b) {
  const x = finite(a);
  const y = finite(b);
  if (x === null || y === null || y === 0) return null;
  return x / y;
}

function sumValues(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + (finite(item) || 0), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, item) => sum + (finite(item) || 0), 0);
  }
  return finite(value) || 0;
}

function pct(value) {
  return value === null ? null : value * 100;
}

function npv(rate, cashFlows, initialInvestment = 0) {
  const r = finite(rate);
  if (r === null || r <= -1) return null;
  let value = -(finite(initialInvestment) || 0);
  (cashFlows || []).forEach((cashFlow, index) => {
    value += (finite(cashFlow) || 0) / Math.pow(1 + r, index + 1);
  });
  return value;
}

function irr(cashFlows, initialInvestment = 0) {
  const flows = [-(finite(initialInvestment) || 0), ...(cashFlows || []).map(v => finite(v) || 0)];
  const hasPositive = flows.some(v => v > 0);
  const hasNegative = flows.some(v => v < 0);
  if (!hasPositive || !hasNegative) return null;

  const valueAt = rate => flows.reduce(
    (sum, flow, index) => sum + flow / Math.pow(1 + rate, index),
    0
  );

  let low = -0.99;
  let high = 10;
  let lowValue = valueAt(low);
  let highValue = valueAt(high);
  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < 160; i++) {
    const mid = (low + high) / 2;
    const midValue = valueAt(mid);
    if (Math.abs(midValue) < 1e-7) return mid;
    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }
  return (low + high) / 2;
}

function paybackPeriod(initialInvestment, cashFlows) {
  const target = finite(initialInvestment);
  if (target === null || target <= 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < (cashFlows || []).length; i++) {
    const flow = finite(cashFlows[i]) || 0;
    const before = cumulative;
    cumulative += flow;
    if (cumulative >= target && flow > 0) {
      return i + (target - before) / flow;
    }
  }
  return null;
}

function evidence(engineCode, metrics, input) {
  return [{
    source: 'bonds_financial_engine',
    evidence_type: 'deterministic_computation',
    evidence_code: engineCode,
    value: metrics,
    confidence: 100,
    timestamp: new Date().toISOString(),
    metadata: {
      engine_version: ENGINE_VERSION,
      input_fields: Object.keys(input || {}).sort()
    }
  }];
}

function envelope(engineCode, metrics, input, diagnostics = {}, requiredInputs = []) {
  const missing = [...new Set(requiredInputs.filter(Boolean))];
  return {
    ok: missing.length === 0,
    executed: missing.length === 0,
    engine_code: engineCode,
    engine_version: ENGINE_VERSION,
    status: missing.length ? 'insufficient_inputs' : 'computed',
    metrics,
    diagnostics,
    required_inputs: missing,
    evidence: evidence(engineCode, metrics, input),
    provenance: {
      source: 'bonds_financial_engine',
      deterministic: true,
      ai_generated: false
    }
  };
}

function financialAnalysis(input = {}, options = {}) {
  const revenue = finite(input.revenue);
  const cogs = finite(input.cogs);
  const operatingExpenses = finite(input.operating_expenses);
  const ebitda = finite(input.ebitda) ??
    (revenue !== null && cogs !== null && operatingExpenses !== null
      ? revenue - cogs - operatingExpenses
      : null);
  const netIncome = finite(input.net_income);
  const currentAssets = finite(input.current_assets);
  const currentLiabilities = finite(input.current_liabilities);
  const cash = finite(input.cash);
  const inventory = finite(input.inventory) || 0;
  const totalAssets = finite(input.total_assets);
  const totalLiabilities = finite(input.total_liabilities);
  const equity = finite(input.equity) ??
    (totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null);
  const debt = finite(input.total_debt);
  const interest = finite(input.interest_expense);
  const receivables = finite(input.receivables);
  const workingCapital = currentAssets !== null && currentLiabilities !== null
    ? currentAssets - currentLiabilities
    : null;
  const assetTurnover = safeDiv(revenue, totalAssets);
  const netDebt = debt !== null && cash !== null ? debt - cash : null;
  const netDebtToEbitda = safeDiv(netDebt, ebitda);

  const metrics = {
    gross_profit: revenue !== null && cogs !== null ? revenue - cogs : null,
    gross_margin_pct: revenue && cogs !== null ? pct((revenue - cogs) / revenue) : null,
    ebitda,
    ebitda_margin_pct: revenue && ebitda !== null ? pct(ebitda / revenue) : null,
    net_margin_pct: revenue && netIncome !== null ? pct(netIncome / revenue) : null,
    current_ratio: safeDiv(currentAssets, currentLiabilities),
    quick_ratio: safeDiv(
      currentAssets !== null ? currentAssets - inventory : null,
      currentLiabilities
    ),
    cash_ratio: safeDiv(cash, currentLiabilities),
    debt_to_equity: safeDiv(debt, equity),
    debt_to_assets: safeDiv(debt, totalAssets),
    liabilities_to_assets: safeDiv(totalLiabilities, totalAssets),
    interest_coverage: safeDiv(ebitda, interest),
    roa_pct: totalAssets && netIncome !== null ? pct(netIncome / totalAssets) : null,
    roe_pct: equity && netIncome !== null ? pct(netIncome / equity) : null,
    receivables_turnover: receivables ? safeDiv(revenue, receivables) : null,
    working_capital: workingCapital,
    asset_turnover: assetTurnover,
    net_debt: netDebt,
    net_debt_to_ebitda: netDebtToEbitda
  };

  const required = [];
  const serviceCode = String(options.serviceCode || '').trim();

  switch (serviceCode) {
    case 'working_capital_analysis':
      if (currentAssets === null) required.push('current_assets');
      if (currentLiabilities === null) required.push('current_liabilities');
      break;
    case 'asset_turnover_analysis':
      if (revenue === null) required.push('revenue');
      if (totalAssets === null) required.push('total_assets');
      else if (totalAssets === 0) required.push('non_zero_total_assets');
      break;
    case 'net_debt_analysis':
      if (debt === null) required.push('total_debt');
      if (cash === null) required.push('cash');
      break;
    case 'net_debt_ebitda':
      if (debt === null) required.push('total_debt');
      if (cash === null) required.push('cash');
      if (ebitda === null) required.push('ebitda_or_revenue_cogs_operating_expenses');
      else if (ebitda === 0) required.push('non_zero_ebitda');
      break;
    case 'gross_margin_analysis':
      if (revenue === null) required.push('revenue');
      else if (revenue === 0) required.push('non_zero_revenue');
      if (cogs === null) required.push('cogs');
      break;
    case 'net_margin_analysis':
      if (revenue === null) required.push('revenue');
      else if (revenue === 0) required.push('non_zero_revenue');
      if (netIncome === null) required.push('net_income');
      break;
    case 'debt_to_equity_analysis':
      if (debt === null) required.push('total_debt');
      if (equity === null) required.push('equity_or_total_assets_and_total_liabilities');
      else if (equity === 0) required.push('non_zero_equity');
      break;
    case 'interest_coverage_analysis':
      if (ebitda === null) required.push('ebitda_or_revenue_cogs_operating_expenses');
      if (interest === null) required.push('interest_expense');
      else if (interest === 0) required.push('non_zero_interest_expense');
      break;
    default:
      if (revenue === null) required.push('revenue');
      if (currentAssets === null) required.push('current_assets');
      if (currentLiabilities === null) required.push('current_liabilities');
      break;
  }

  return envelope('financial_analysis', metrics, input, {
    available_metric_count: Object.values(metrics).filter(v => v !== null).length,
    service_scope: serviceCode || null
  }, required);
}

function cashFlowAnalysis(input = {}) {
  const openingBalance = finite(input.opening_balance) || 0;
  const periods = Array.isArray(input.periods) ? input.periods : [];
  if (!periods.length) {
    return envelope('cash_flow_analysis', {}, input, {}, ['periods']);
  }

  let balance = openingBalance;
  let totalInflows = 0;
  let totalOutflows = 0;
  let minimumBalance = balance;
  let negativePeriods = 0;
  let longestNegativeRun = 0;
  let currentNegativeRun = 0;

  const computed = periods.map((period, index) => {
    const inflows = sumValues(period?.inflows);
    const outflows = sumValues(period?.outflows);
    const net = inflows - outflows;
    const opening = balance;
    balance += net;
    totalInflows += inflows;
    totalOutflows += outflows;
    minimumBalance = Math.min(minimumBalance, balance);

    if (balance < 0) {
      negativePeriods++;
      currentNegativeRun++;
      longestNegativeRun = Math.max(longestNegativeRun, currentNegativeRun);
    } else {
      currentNegativeRun = 0;
    }

    return {
      period: period?.period || index + 1,
      opening_balance: opening,
      inflows,
      outflows,
      net_cash_flow: net,
      closing_balance: balance
    };
  });

  const negativeNet = computed.filter(row => row.net_cash_flow < 0);
  const averageBurn = negativeNet.length
    ? Math.abs(negativeNet.reduce((s, row) => s + row.net_cash_flow, 0) / negativeNet.length)
    : 0;

  const metrics = {
    opening_balance: openingBalance,
    closing_balance: balance,
    total_inflows: totalInflows,
    total_outflows: totalOutflows,
    net_cash_flow: totalInflows - totalOutflows,
    minimum_balance: minimumBalance,
    negative_periods: negativePeriods,
    longest_negative_run: longestNegativeRun,
    average_burn: averageBurn,
    cash_runway_periods: averageBurn > 0 && balance > 0 ? balance / averageBurn : null,
    periods: computed
  };

  return envelope('cash_flow_analysis', metrics, input);
}

function fundingReadiness(input = {}) {
  const ebitda = finite(input.ebitda);
  const annualDebtService = finite(input.annual_debt_service);
  const currentAssets = finite(input.current_assets);
  const currentLiabilities = finite(input.current_liabilities);
  const debt = finite(input.total_debt);
  const equity = finite(input.equity);
  const operatingCashFlow = finite(input.operating_cash_flow);
  const requestedAmount = finite(input.requested_amount);

  const dscr = safeDiv(operatingCashFlow ?? ebitda, annualDebtService);
  const currentRatio = safeDiv(currentAssets, currentLiabilities);
  const leverage = safeDiv(debt, equity);
  const amountToCashFlow = safeDiv(requestedAmount, operatingCashFlow ?? ebitda);

  const components = [];
  if (dscr !== null) components.push({ key: 'dscr', weight: 0.40, score: clamp((dscr / 1.5) * 100, 0, 100) });
  if (currentRatio !== null) components.push({ key: 'liquidity', weight: 0.25, score: clamp((currentRatio / 1.5) * 100, 0, 100) });
  if (leverage !== null) components.push({ key: 'leverage', weight: 0.25, score: clamp(100 - leverage * 25, 0, 100) });
  if (amountToCashFlow !== null) components.push({ key: 'requested_amount', weight: 0.10, score: clamp(100 - amountToCashFlow * 12, 0, 100) });

  const totalWeight = components.reduce((s, row) => s + row.weight, 0);
  const score = totalWeight
    ? Math.round(components.reduce((s, row) => s + row.score * row.weight, 0) / totalWeight)
    : null;

  const metrics = {
    readiness_score: score,
    readiness_band: score === null ? 'unknown' : score >= 80 ? 'strong' : score >= 65 ? 'moderate' : score >= 50 ? 'weak' : 'not_ready',
    dscr,
    current_ratio: currentRatio,
    debt_to_equity: leverage,
    requested_amount_to_cash_flow: amountToCashFlow,
    components
  };

  const required = [];
  if (ebitda === null && operatingCashFlow === null) required.push('ebitda_or_operating_cash_flow');
  if (annualDebtService === null) required.push('annual_debt_service');

  return envelope('funding_readiness', metrics, input, {}, required);
}

function creditworthiness(input = {}) {
  const readiness = fundingReadiness(input);
  const netIncome = finite(input.net_income);
  const revenue = finite(input.revenue);
  const profitability = revenue && netIncome !== null ? netIncome / revenue : null;

  let score = readiness.metrics.readiness_score;
  if (score !== null && profitability !== null) {
    score = Math.round(clamp(score * 0.85 + clamp((profitability + 0.05) / 0.25 * 100, 0, 100) * 0.15, 0, 100));
  }

  const metrics = {
    credit_score: score,
    rating_band: score === null ? 'unrated' : score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'E',
    risk_band: score === null ? 'unknown' : score >= 75 ? 'low' : score >= 60 ? 'moderate' : score >= 45 ? 'high' : 'very_high',
    dscr: readiness.metrics.dscr,
    current_ratio: readiness.metrics.current_ratio,
    debt_to_equity: readiness.metrics.debt_to_equity,
    net_margin_pct: profitability === null ? null : pct(profitability)
  };

  return envelope('creditworthiness', metrics, input, {}, readiness.required_inputs);
}

function feasibilityAnalysis(input = {}) {
  const initialInvestment = finite(input.initial_investment);
  let cashFlows = Array.isArray(input.cash_flows)
    ? input.cash_flows.map(v => finite(v) || 0)
    : [];

  if (!cashFlows.length) {
    const annualCashFlow = finite(input.annual_cash_flow);
    const years = Math.max(1, Math.round(finite(input.years) || 5));
    if (annualCashFlow !== null) cashFlows = Array(years).fill(annualCashFlow);
  }

  const discountRate = finite(input.discount_rate) ?? 0.10;
  const value = initialInvestment === null || !cashFlows.length
    ? null
    : npv(discountRate, cashFlows, initialInvestment);
  const internalRate = initialInvestment === null || !cashFlows.length
    ? null
    : irr(cashFlows, initialInvestment);
  const payback = initialInvestment === null || !cashFlows.length
    ? null
    : paybackPeriod(initialInvestment, cashFlows);

  const metrics = {
    initial_investment: initialInvestment,
    discount_rate: discountRate,
    npv: value,
    irr: internalRate,
    irr_pct: internalRate === null ? null : pct(internalRate),
    payback_periods: payback,
    profitability_index: initialInvestment && value !== null
      ? (value + initialInvestment) / initialInvestment
      : null,
    total_cash_inflows: cashFlows.reduce((s, v) => s + v, 0),
    cash_flows: cashFlows
  };

  const required = [];
  if (initialInvestment === null) required.push('initial_investment');
  if (!cashFlows.length) required.push('cash_flows_or_annual_cash_flow');

  return envelope('feasibility', metrics, input, {}, required);
}

function valuationAnalysis(input = {}) {
  const freeCashFlows = Array.isArray(input.free_cash_flows)
    ? input.free_cash_flows.map(v => finite(v) || 0)
    : [];
  const discountRate = finite(input.discount_rate);
  const terminalGrowth = finite(input.terminal_growth_rate) ?? 0;
  const netDebt = finite(input.net_debt) || 0;

  const required = [];
  if (!freeCashFlows.length) required.push('free_cash_flows');
  if (discountRate === null) required.push('discount_rate');
  if (discountRate !== null && terminalGrowth >= discountRate) required.push('terminal_growth_rate_below_discount_rate');

  let enterpriseValue = null;
  let terminalValue = null;
  if (!required.length) {
    const explicit = freeCashFlows.reduce(
      (sum, flow, index) => sum + flow / Math.pow(1 + discountRate, index + 1),
      0
    );
    const last = freeCashFlows[freeCashFlows.length - 1] || 0;
    terminalValue = last * (1 + terminalGrowth) / (discountRate - terminalGrowth);
    enterpriseValue = explicit + terminalValue / Math.pow(1 + discountRate, freeCashFlows.length);
  }

  const metrics = {
    method: 'dcf',
    discount_rate: discountRate,
    terminal_growth_rate: terminalGrowth,
    terminal_value: terminalValue,
    enterprise_value: enterpriseValue,
    net_debt: netDebt,
    equity_value: enterpriseValue === null ? null : enterpriseValue - netDebt
  };

  return envelope('valuation', metrics, input, {}, required);
}

function riskAnalysis(input = {}) {
  const currentRatio = safeDiv(input.current_assets, input.current_liabilities);
  const leverage = safeDiv(input.total_debt, input.equity);
  const dscr = safeDiv(
    finite(input.operating_cash_flow) ?? finite(input.ebitda),
    input.annual_debt_service
  );
  const concentration = finite(input.customer_concentration_pct);
  const cashBufferMonths = finite(input.cash_buffer_months);

  const factors = [];
  if (currentRatio !== null) factors.push({ key: 'liquidity', risk: clamp(100 - currentRatio * 55, 0, 100), weight: 0.25 });
  if (leverage !== null) factors.push({ key: 'leverage', risk: clamp(leverage * 25, 0, 100), weight: 0.25 });
  if (dscr !== null) factors.push({ key: 'debt_service', risk: clamp(100 - dscr * 60, 0, 100), weight: 0.25 });
  if (concentration !== null) factors.push({ key: 'concentration', risk: clamp(concentration, 0, 100), weight: 0.15 });
  if (cashBufferMonths !== null) factors.push({ key: 'cash_buffer', risk: clamp(100 - cashBufferMonths * 16.67, 0, 100), weight: 0.10 });

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const score = totalWeight
    ? Math.round(factors.reduce((s, f) => s + f.risk * f.weight, 0) / totalWeight)
    : null;

  const metrics = {
    risk_score: score,
    risk_band: score === null ? 'unknown' : score < 25 ? 'low' : score < 50 ? 'moderate' : score < 75 ? 'high' : 'critical',
    current_ratio: currentRatio,
    debt_to_equity: leverage,
    dscr,
    customer_concentration_pct: concentration,
    cash_buffer_months: cashBufferMonths,
    factors
  };

  const required = factors.length ? [] : ['financial_risk_inputs'];
  return envelope('risk_analysis', metrics, input, {}, required);
}

function scenarioForecast(input = {}) {
  const simulation = new SimulationEngine();
  const simulationResult = simulation.run({
    values: input,
    simulationConfig: input.simulation_config || {}
  });

  const revenue = finite(input.revenue) ?? finite(input.annual_revenue);
  const costs = finite(input.costs) ?? finite(input.annual_costs);
  const growth = finite(input.growth_rate) ?? 0;
  const years = Math.max(1, Math.min(30, Math.round(finite(input.years) || 5)));

  const forecast = [];
  if (revenue !== null || costs !== null) {
    let rev = revenue || 0;
    let cost = costs || 0;
    for (let year = 1; year <= years; year++) {
      rev *= 1 + growth;
      cost *= 1 + (finite(input.cost_growth_rate) ?? growth);
      forecast.push({ year, revenue: rev, costs: cost, operating_result: rev - cost });
    }
  }

  const metrics = {
    forecast,
    simulation: simulationResult.executed ? simulationResult.output : null,
    simulation_status: simulationResult.status,
    simulation_confidence: simulationResult.confidence
  };

  if (!forecast.length && !simulationResult.executed) {
    return envelope(
      'scenario_forecast',
      metrics,
      input,
      { simulation_required_inputs: simulationResult.requiredInputs || [] },
      ['revenue_or_simulation_inputs']
    );
  }

  return envelope('scenario_forecast', metrics, input, {
    simulation_required_inputs: simulationResult.requiredInputs || []
  });
}

const ENGINES = Object.freeze({
  financial_analysis: financialAnalysis,
  cash_flow_analysis: cashFlowAnalysis,
  funding_readiness: fundingReadiness,
  creditworthiness,
  feasibility: feasibilityAnalysis,
  valuation: valuationAnalysis,
  risk_analysis: riskAnalysis,
  scenario_forecast: scenarioForecast
});

const ENGINE_DEFINITIONS = Object.freeze({
  financial_analysis: { deterministic: true, category: 'financial_analysis' },
  cash_flow_analysis: { deterministic: true, category: 'cash_flow' },
  funding_readiness: { deterministic: true, category: 'funding' },
  creditworthiness: { deterministic: true, category: 'credit' },
  feasibility: { deterministic: true, category: 'feasibility' },
  valuation: { deterministic: true, category: 'valuation' },
  risk_analysis: { deterministic: true, category: 'risk' },
  scenario_forecast: { deterministic: true, category: 'scenario' }
});

function runFinancialEngine(engineCode, input = {}, options = {}) {
  const code = String(engineCode || '').trim();
  const engine = ENGINES[code];
  if (!engine) {
    return {
      ok: false,
      executed: false,
      engine_code: code || null,
      status: 'unknown_engine',
      error: { code: 'FINANCIAL_ENGINE_NOT_REGISTERED' },
      available_engines: Object.keys(ENGINES)
    };
  }
  return engine(
    input && typeof input === 'object' && !Array.isArray(input) ? input : {},
    options && typeof options === 'object' && !Array.isArray(options) ? options : {}
  );
}

function listFinancialEngines() {
  return Object.entries(ENGINE_DEFINITIONS).map(([code, definition]) => ({
    code,
    version: ENGINE_VERSION,
    ...definition
  }));
}

module.exports = {
  ENGINE_VERSION,
  ENGINE_DEFINITIONS,
  runFinancialEngine,
  listFinancialEngines,
  helpers: { finite, clamp, safeDiv, npv, irr, paybackPeriod }
};
