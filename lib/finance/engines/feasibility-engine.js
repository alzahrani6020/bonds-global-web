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
  const validCashFlows = () => cashFlows.length > 0 && cashFlows.every(v => v !== null);

  if (!cashFlows.length) {
    const annualCashFlow = finite(input.annual_cash_flow);
    const years = Math.max(1, Math.round(finite(input.years) || 5));
    if (annualCashFlow !== null) cashFlows = Array(years).fill(annualCashFlow);
  }

  const discountRate = finite(input.discount_rate) ?? 0.10;
  if (initialInvestment === null) required.push('initial_investment');
  if (!cashFlows.length) required.push('cash_flows_or_annual_cash_flow');
  if (initialInvestment !== null && initialInvestment < 0) required.push('initial_investment_non_negative');
  if (discountRate <= -1) required.push('discount_rate_gt_minus_one');
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
    total_cash_inflows: cashFlows.reduce((s, v) => s + v, 0),
    cash_flows: cashFlows
  };

  return envelope('feasibility', metrics, input, {}, required);
}

module.exports = { feasibilityAnalysis };
