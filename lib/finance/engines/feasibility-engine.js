'use strict';

const { finite, npv, irr, paybackPeriod, pct } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

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

  const hasDiscountRate = Object.prototype.hasOwnProperty.call(input, 'discount_rate');
  const discountRate = hasDiscountRate ? finite(input.discount_rate) : 0.10;
  if (discountRate === null || discountRate <= -1) required.push('discount_rate_gt_minus_one');
  if (initialInvestment === null) required.push('initial_investment');
  if (!cashFlows.length) required.push('cash_flows_or_annual_cash_flow');
  if (initialInvestment !== null && initialInvestment < 0) required.push('initial_investment_non_negative');
  const valid = required.length === 0 && validCashFlows();
  const value = valid ? npv(discountRate, cashFlows, initialInvestment) : null;
  const internalRate = valid ? irr(cashFlows, initialInvestment) : null;
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

  return envelope('feasibility', metrics, input, {}, required);
}

module.exports = { feasibilityAnalysis };
