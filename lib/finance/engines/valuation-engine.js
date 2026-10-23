'use strict';

const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

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

module.exports = { valuationAnalysis };
