/**
 * BONDS UCP Backward-Compatibility Adapters
 *
 * Maps legacy calculator inputs/outputs to/from the Universal Calculation Platform.
 */

function number(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Adapter for the legacy break-even calculator.
 */
function breakEvenToUcp(legacy) {
  return {
    fixed_costs: number(legacy.fixedCosts || legacy.fixed_costs),
    variable_cost_per_unit: number(legacy.variableCostPerUnit || legacy.variable_cost_per_unit),
    unit_price: number(legacy.unitPrice || legacy.unit_price)
  };
}

function breakEvenFromUcp(outputs) {
  return {
    breakEvenUnits: outputs.break_even_units?.value ?? outputs.break_even_units,
    contributionMargin: outputs.contribution_margin?.value ?? outputs.contribution_margin,
    contributionMarginRatio: outputs.contribution_margin_ratio?.value ?? outputs.contribution_margin_ratio,
    breakEvenRevenue: outputs.break_even_revenue?.value ?? outputs.break_even_revenue
  };
}

/**
 * Adapter for the legacy loan calculator.
 */
function loanToUcp(legacy) {
  return {
    loan_amount: number(legacy.amount || legacy.loan_amount),
    interest_rate: number(legacy.rate || legacy.interest_rate) / 100,
    loan_term_months: number(legacy.termMonths || legacy.loan_term_months)
  };
}

function loanFromUcp(outputs) {
  return {
    monthlyPayment: outputs.monthly_payment?.value ?? outputs.monthly_payment,
    totalInterest: outputs.total_interest?.value ?? outputs.total_interest,
    totalPayment: outputs.total_payment?.value ?? outputs.total_payment
  };
}

/**
 * Adapter for the legacy cash-flow / company calculator.
 */
function cashFlowToUcp(legacy) {
  return {
    revenue: number(legacy.revenue),
    cogs: number(legacy.cogs || 0),
    operating_expenses: number(legacy.operatingExpenses || legacy.operating_expenses || 0),
    initial_investment: number(legacy.initialInvestment || legacy.initial_investment || 0),
    annual_net_cash_flow: number(legacy.annualNetCashFlow || legacy.annual_net_cash_flow || 0),
    loan_amount: number(legacy.loanAmount || legacy.loan_amount || 0),
    asset_value: number(legacy.assetValue || legacy.asset_value || 0)
  };
}

function cashFlowFromUcp(outputs) {
  return {
    grossProfit: outputs.gross_profit?.value ?? outputs.gross_profit,
    operatingProfit: outputs.operating_profit?.value ?? outputs.operating_profit,
    netProfit: outputs.net_profit?.value ?? outputs.net_profit,
    grossMargin: outputs.gross_margin?.value ?? outputs.gross_margin,
    netProfitMargin: outputs.net_profit_margin?.value ?? outputs.net_profit_margin,
    roi: outputs.roi?.value ?? outputs.roi,
    paybackPeriod: outputs.payback_period?.value ?? outputs.payback_period,
    dscr: outputs.dscr?.value ?? outputs.dscr,
    ltv: outputs.ltv?.value ?? outputs.ltv
  };
}

/**
 * Adapter for the legacy pricing calculator.
 */
function pricingToUcp(legacy) {
  return {
    cogs: number(legacy.cogs || legacy.cost),
    operating_expenses: number(legacy.operatingExpenses || 0),
    revenue: number(legacy.revenue || legacy.targetRevenue || 0),
    unit_price: number(legacy.price || legacy.unit_price || 0),
    fixed_costs: number(legacy.fixedCosts || legacy.fixed_costs || 0)
  };
}

function pricingFromUcp(outputs) {
  return {
    grossMargin: outputs.gross_margin?.value ?? outputs.gross_margin,
    netProfitMargin: outputs.net_profit_margin?.value ?? outputs.net_profit_margin,
    netProfit: outputs.net_profit?.value ?? outputs.net_profit,
    grossProfit: outputs.gross_profit?.value ?? outputs.gross_profit
  };
}

const ADAPTER_MAP = {
  'break-even': { toUcp: breakEvenToUcp, fromUcp: breakEvenFromUcp, sector: 'company' },
  loan: { toUcp: loanToUcp, fromUcp: loanFromUcp, sector: 'company' },
  'cash-flow': { toUcp: cashFlowToUcp, fromUcp: cashFlowFromUcp, sector: 'company' },
  pricing: { toUcp: pricingToUcp, fromUcp: pricingFromUcp, sector: 'company' }
};

function adaptToUcp(calculatorType, legacyInputs) {
  const adapter = ADAPTER_MAP[calculatorType];
  if (!adapter) throw new Error(`Unknown legacy calculator type: ${calculatorType}`);
  return { sector: adapter.sector, inputs: adapter.toUcp(legacyInputs) };
}

function adaptFromUcp(calculatorType, ucpOutputs) {
  const adapter = ADAPTER_MAP[calculatorType];
  if (!adapter) throw new Error(`Unknown legacy calculator type: ${calculatorType}`);
  return adapter.fromUcp(ucpOutputs);
}

module.exports = {
  ADAPTER_MAP,
  adaptToUcp,
  adaptFromUcp,
  breakEvenToUcp,
  breakEvenFromUcp,
  loanToUcp,
  loanFromUcp,
  cashFlowToUcp,
  cashFlowFromUcp,
  pricingToUcp,
  pricingFromUcp
};
