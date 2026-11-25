'use strict';

const { finite, npv, paybackPeriod, pct } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

// Compute a unique conventional IRR only. Non-conventional cash-flow sequences
// may have multiple roots and must not yield an arbitrary investment decision.
function governedIrr(cashFlows, initialInvestment) {
  const values = [-initialInvestment, ...cashFlows];
  const signs = values.filter(v => v !== 0).map(v => Math.sign(v));
  const changes = signs.slice(1).filter((sign, index) => sign !== signs[index]).length;
  if (changes !== 1) return { value: null, issue: changes > 1 ? 'multiple_irr_possible' : 'irr_not_defined' };
  const at = rate => npv(rate, cashFlows, initialInvestment);
  let low = -0.999999;
  let high = 1;
  const lowValue = at(low);
  let highValue = at(high);
  // An IRR above 1000% must not be silently discarded.
  while (Number.isFinite(highValue) && Math.sign(lowValue) === Math.sign(highValue) && high < 1e8) {
    high = high * 2 + 1;
    highValue = at(high);
  }
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) ||
      Math.sign(lowValue) === Math.sign(highValue)) {
    return { value: null, issue: 'irr_root_outside_supported_range' };
  }
  for (let i = 0; i < 200; i++) {
    const middle = (low + high) / 2;
    const value = at(middle);
    if (!Number.isFinite(value)) return { value: null, issue: 'irr_numeric_failure' };
    if (Math.abs(value) <= 1e-8 || high - low < 1e-12 * Math.max(1, Math.abs(middle))) {
      return { value: middle, issue: null };
    }
    if (Math.sign(value) === Math.sign(lowValue)) low = middle;
    else high = middle;
  }
  return { value: (low + high) / 2, issue: null };
}

function feasibilityAnalysis(input = {}) {
  const initialInvestment = finite(input.initial_investment);
  let cashFlows = Array.isArray(input.cash_flows)
    ? input.cash_flows.map(v => finite(v))
    : [];
  // A missing year cannot be interpreted as an actual zero cash flow.
  const required = cashFlows.flatMap((v, index) => v === null
    ? [`cash_flows[${index}]_numeric`] : []);
  if (cashFlows.length > 60) required.push('cash_flows_max_60_periods');
  const hasYears = Object.prototype.hasOwnProperty.call(input, 'years');
  const years = hasYears ? finite(input.years) : 5;
  if (hasYears && (!Number.isInteger(years) || years < 1 || years > 60)) {
    required.push('years_integer_1_to_60');
  }
  const validCashFlows = () => cashFlows.length > 0 && cashFlows.every(v => v !== null);

  if (!cashFlows.length) {
    const annualCashFlow = finite(input.annual_cash_flow);
    if (annualCashFlow !== null && Number.isInteger(years) && years >= 1 && years <= 60) {
      cashFlows = Array(years).fill(annualCashFlow);
    }
  }

  // A governed investment conclusion must never assume an unapproved 10% cost of capital.
  const discountRate = finite(input.discount_rate);
  if (discountRate === null || discountRate <= -1 || discountRate > 1) required.push('discount_rate_required_0_to_1');
  if (Array.isArray(input.cash_flows) && hasYears && Number.isInteger(years) && cashFlows.length !== years) {
    required.push('cash_flows_years_mismatch');
  }
  if (initialInvestment === null) required.push('initial_investment');
  if (!cashFlows.length) required.push('cash_flows_or_annual_cash_flow');
  if (initialInvestment !== null && initialInvestment <= 0) required.push('initial_investment_positive');
  const valid = required.length === 0 && validCashFlows();
  const value = valid ? npv(discountRate, cashFlows, initialInvestment) : null;
  const irrCheck = valid ? governedIrr(cashFlows, initialInvestment) : { value: null, issue: null };
  const internalRate = irrCheck.value;
  const payback = valid ? paybackPeriod(initialInvestment, cashFlows) : null;

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
    total_cash_inflows: valid ? cashFlows.reduce((s, v) => s + Math.max(0, v), 0) : null,
    total_cash_outflows: valid ? cashFlows.reduce((s, v) => s + Math.max(0, -v), 0) : null,
    net_cash_flows: valid ? cashFlows.reduce((s, v) => s + v, 0) : null,
    cash_flows: cashFlows
  };

  return envelope('feasibility', metrics, input, { irr_issue: irrCheck.issue }, required);
}

module.exports = { feasibilityAnalysis };
