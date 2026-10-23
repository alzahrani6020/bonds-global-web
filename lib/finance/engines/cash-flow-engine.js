'use strict';

const { finite, sumValues } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function numericCollection(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => Number.isFinite(Number(item)));
  if (value && typeof value === 'object') {
    return Object.values(value).every(item => Number.isFinite(Number(item)));
  }
  return false;
}

function cashFlowAnalysis(input = {}, options = {}) {
  const serviceCode = String(options.serviceCode || '').trim();
  const liquidityGapScoped = serviceCode === 'liquidity_gap_analysis';
  const openingBalanceInput = finite(input.opening_balance);
  const openingBalance = openingBalanceInput ?? 0;
  const periods = Array.isArray(input.periods) ? input.periods : [];

  const required = [];
  if (!periods.length) required.push('periods');
  if (openingBalanceInput === null) {
    required.push('opening_balance');
  }

  periods.forEach((period, index) => {
      if (!period || typeof period !== 'object' || Array.isArray(period)) {
        required.push(`periods[${index}]_valid_object`);
        return;
      }
      if (!hasOwn(period, 'inflows')) {
        required.push(`periods[${index}].inflows`);
      } else if (!numericCollection(period.inflows)) {
        required.push(`periods[${index}].inflows_numeric`);
      }
      if (!hasOwn(period, 'outflows')) {
        required.push(`periods[${index}].outflows`);
      } else if (!numericCollection(period.outflows)) {
        required.push(`periods[${index}].outflows_numeric`);
      }
  });

  if (!periods.length || required.length) {
    return envelope(
      'cash_flow_analysis',
      {},
      input,
      { service_scope: serviceCode || null },
      required
    );
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
      closing_balance: balance,
      liquidity_gap: Math.max(0, -balance)
    };
  });

  const negativeNet = computed.filter(row => row.net_cash_flow < 0);
  const averageBurn = negativeNet.length
    ? Math.abs(negativeNet.reduce((s, row) => s + row.net_cash_flow, 0) / negativeNet.length)
    : 0;

  const deficitRows = computed.filter(row => row.closing_balance < 0);
  const firstDeficitIndex = computed.findIndex(row => row.closing_balance < 0);
  const peakGapRow = computed.reduce(
    (peak, row) => row.liquidity_gap > (peak?.liquidity_gap || 0) ? row : peak,
    null
  );
  const recoveryRow = firstDeficitIndex < 0
    ? null
    : computed.slice(firstDeficitIndex + 1).find(row => row.closing_balance >= 0) || null;
  const peakLiquidityGap = Math.max(0, -minimumBalance);

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
    peak_liquidity_gap: peakLiquidityGap,
    funding_required_to_maintain_non_negative_balance: peakLiquidityGap,
    first_deficit_period: firstDeficitIndex < 0 ? null : computed[firstDeficitIndex].period,
    peak_gap_period: peakLiquidityGap > 0 ? peakGapRow?.period ?? null : null,
    recovery_period: recoveryRow?.period ?? null,
    deficit_period_count: deficitRows.length,
    unrecovered_at_horizon: deficitRows.length > 0 && balance < 0,
    periods: computed
  };

  return envelope(
    'cash_flow_analysis',
    metrics,
    input,
    {
      service_scope: serviceCode || null,
      liquidity_gap_method: liquidityGapScoped
        ? 'peak_cumulative_cash_deficit'
        : null
    },
    required
  );
}

module.exports = { cashFlowAnalysis };
