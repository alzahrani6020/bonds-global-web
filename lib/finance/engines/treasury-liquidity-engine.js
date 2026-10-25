'use strict';

const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function treasuryLiquidityAnalysis(input = {}) {
  const accounts = Array.isArray(input.accounts) ? input.accounts : [];
  const required = [];

  if (!accounts.length) required.push('accounts');

  const normalizedAccounts = accounts.map((account, index) => {
    const balance = finite(account?.balance);
    const restrictedCash = finite(account?.restricted_cash) ?? 0;
    const minimumOperatingCash = finite(account?.minimum_operating_cash) ?? 0;

    if (balance === null) required.push(`accounts[${index}].balance_numeric`);
    if (restrictedCash < 0) required.push(`accounts[${index}].restricted_cash_non_negative`);
    if (minimumOperatingCash < 0) required.push(`accounts[${index}].minimum_operating_cash_non_negative`);
    if (balance !== null && restrictedCash > balance) {
      required.push(`accounts[${index}].restricted_cash_lte_balance`);
    }

    const available = balance === null
      ? null
      : Math.max(0, balance - restrictedCash);
    const sweepable = available === null
      ? null
      : Math.max(0, available - minimumOperatingCash);

    return {
      id: String(account?.id || account?.code || `account_${index + 1}`),
      bank: String(account?.bank || '').trim() || null,
      currency: String(account?.currency || input.currency || '').trim() || null,
      balance,
      restricted_cash: restrictedCash,
      minimum_operating_cash: minimumOperatingCash,
      available_cash: available,
      sweepable_cash: sweepable
    };
  });

  const minimumLiquidityBuffer = finite(input.minimum_liquidity_buffer);
  if (minimumLiquidityBuffer === null || minimumLiquidityBuffer < 0) {
    required.push('minimum_liquidity_buffer_non_negative');
  }

  const expectedInflows = finite(input.expected_short_term_inflows) ?? 0;
  const expectedOutflows = finite(input.expected_short_term_outflows) ?? 0;
  const availableFacilities = finite(input.available_short_term_facilities) ?? 0;

  if (expectedInflows < 0) required.push('expected_short_term_inflows_non_negative');
  if (expectedOutflows < 0) required.push('expected_short_term_outflows_non_negative');
  if (availableFacilities < 0) required.push('available_short_term_facilities_non_negative');

  if (required.length) {
    return envelope(
      'treasury_liquidity',
      {},
      input,
      {
        method: 'cash_position_plus_near_term_flows',
        fail_closed: true
      },
      required
    );
  }

  const grossCash = normalizedAccounts.reduce((sum, row) => sum + row.balance, 0);
  const restrictedCash = normalizedAccounts.reduce((sum, row) => sum + row.restricted_cash, 0);
  const availableCash = normalizedAccounts.reduce((sum, row) => sum + row.available_cash, 0);
  const sweepableCash = normalizedAccounts.reduce((sum, row) => sum + row.sweepable_cash, 0);

  const projectedCashBeforeFacilities =
    availableCash + expectedInflows - expectedOutflows;
  const liquidityHeadroom =
    projectedCashBeforeFacilities - minimumLiquidityBuffer;
  const fundingGap = Math.max(0, -liquidityHeadroom);
  const investableSurplus = Math.max(0, liquidityHeadroom);
  const postFacilityLiquidity =
    projectedCashBeforeFacilities + availableFacilities;
  const facilityCoverage = fundingGap > 0
    ? availableFacilities / fundingGap
    : null;

  const bankTotals = new Map();
  for (const account of normalizedAccounts) {
    const key = account.bank || account.id;
    bankTotals.set(key, (bankTotals.get(key) || 0) + account.available_cash);
  }

  const bankPositions = [...bankTotals.entries()]
    .map(([bank, cash]) => ({
      bank,
      available_cash: cash,
      concentration_pct: availableCash > 0 ? (cash / availableCash) * 100 : null
    }))
    .sort((a, b) => b.available_cash - a.available_cash);

  const largestBank = bankPositions[0] || null;
  const largestAccount = normalizedAccounts.reduce(
    (best, row) => !best || row.available_cash > best.available_cash ? row : best,
    null
  );

  const forecastCashBalance = finite(input.forecast_cash_balance);
  const actualCashBalance = finite(input.actual_cash_balance) ?? availableCash;
  const forecastVariance = forecastCashBalance === null
    ? null
    : actualCashBalance - forecastCashBalance;
  const forecastVariancePct =
    forecastCashBalance === null || forecastCashBalance === 0
      ? null
      : (forecastVariance / Math.abs(forecastCashBalance)) * 100;

  const limits =
    input.treasury_limits &&
    typeof input.treasury_limits === 'object' &&
    !Array.isArray(input.treasury_limits)
      ? input.treasury_limits
      : {};

  const limitChecks = [];

  const minLiquidityLimit = finite(limits.minimum_projected_liquidity);
  if (minLiquidityLimit !== null) {
    limitChecks.push({
      limit: 'minimum_projected_liquidity',
      actual: projectedCashBeforeFacilities,
      threshold: minLiquidityLimit,
      compliant: projectedCashBeforeFacilities >= minLiquidityLimit,
      headroom: projectedCashBeforeFacilities - minLiquidityLimit
    });
  }

  const maxBankConcentration = finite(limits.max_bank_concentration_pct);
  if (maxBankConcentration !== null) {
    if (maxBankConcentration < 0 || maxBankConcentration > 100) {
      return envelope(
        'treasury_liquidity',
        {},
        input,
        { method: 'cash_position_plus_near_term_flows', fail_closed: true },
        ['treasury_limits.max_bank_concentration_pct_0_to_100']
      );
    }
    const actual = largestBank?.concentration_pct ?? 0;
    limitChecks.push({
      limit: 'max_bank_concentration_pct',
      actual,
      threshold: maxBankConcentration,
      compliant: actual <= maxBankConcentration,
      headroom: maxBankConcentration - actual
    });
  }

  const maxSingleAccount = finite(limits.max_single_account_balance);
  if (maxSingleAccount !== null) {
    if (maxSingleAccount < 0) {
      return envelope(
        'treasury_liquidity',
        {},
        input,
        { method: 'cash_position_plus_near_term_flows', fail_closed: true },
        ['treasury_limits.max_single_account_balance_non_negative']
      );
    }
    const actual = largestAccount?.available_cash ?? 0;
    limitChecks.push({
      limit: 'max_single_account_balance',
      actual,
      threshold: maxSingleAccount,
      compliant: actual <= maxSingleAccount,
      headroom: maxSingleAccount - actual
    });
  }

  const breaches = limitChecks.filter(row => !row.compliant);

  return envelope(
    'treasury_liquidity',
    {
      gross_cash: grossCash,
      restricted_cash: restrictedCash,
      available_cash: availableCash,
      sweepable_cash: sweepableCash,
      expected_short_term_inflows: expectedInflows,
      expected_short_term_outflows: expectedOutflows,
      projected_cash_before_facilities: projectedCashBeforeFacilities,
      minimum_liquidity_buffer: minimumLiquidityBuffer,
      liquidity_headroom: liquidityHeadroom,
      funding_gap: fundingGap,
      available_short_term_facilities: availableFacilities,
      facility_coverage_of_gap: facilityCoverage,
      post_facility_liquidity: postFacilityLiquidity,
      investable_surplus: investableSurplus,
      largest_bank: largestBank,
      largest_account: largestAccount
        ? {
            id: largestAccount.id,
            bank: largestAccount.bank,
            available_cash: largestAccount.available_cash,
            concentration_pct:
              availableCash > 0
                ? (largestAccount.available_cash / availableCash) * 100
                : null
          }
        : null,
      forecast_cash_balance: forecastCashBalance,
      actual_cash_balance: actualCashBalance,
      forecast_variance: forecastVariance,
      forecast_variance_pct: forecastVariancePct,
      limit_breach_count: breaches.length,
      limits_status: breaches.length ? 'breach' : 'compliant',
      limit_checks: limitChecks,
      bank_positions: bankPositions,
      accounts: normalizedAccounts
    },
    input,
    {
      method: 'cash_position_plus_near_term_flows',
      currency: String(input.currency || '').trim() || null,
      fail_closed: true
    }
  );
}

module.exports = { treasuryLiquidityAnalysis };
