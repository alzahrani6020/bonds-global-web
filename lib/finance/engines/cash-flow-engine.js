'use strict';

const { finite, sumValues } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

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

module.exports = { cashFlowAnalysis };
