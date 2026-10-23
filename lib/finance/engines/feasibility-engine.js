'use strict';

const { finite, npv, irr, paybackPeriod, pct } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

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

module.exports = { feasibilityAnalysis };
