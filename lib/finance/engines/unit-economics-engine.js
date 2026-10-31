'use strict';

const { finite, safeDiv } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function pctRatio(numerator, denominator) {
  const value = safeDiv(numerator, denominator);
  return value === null ? null : value * 100;
}

function unitEconomicsAnalysis(input = {}) {
  const required = [];
  const analysisScope = String(input.analysis_scope || 'full').trim().toLowerCase();
  const ltvOnly = analysisScope === 'ltv';

  const acquisitionSpend = finite(input.acquisition_spend);
  const newCustomers = finite(input.new_customers);
  const activeCustomers = finite(input.active_customers);
  const revenue = finite(input.revenue);
  const grossProfit = finite(input.gross_profit);
  const explicitLtv = finite(input.ltv);
  const churnRatePct = finite(input.churn_rate_pct);
  const unitsSold = finite(input.units_sold);
  const variableCost = finite(input.variable_cost);

  if (!ltvOnly) {
    if (acquisitionSpend === null || acquisitionSpend < 0) {
      required.push('acquisition_spend_non_negative');
    }
    if (newCustomers === null || newCustomers <= 0) {
      required.push('new_customers_positive');
    }
    if (activeCustomers === null || activeCustomers <= 0) {
      required.push('active_customers_positive');
    }
    if (revenue === null) required.push('revenue_numeric');
    if (grossProfit === null) required.push('gross_profit_numeric');
  } else if (explicitLtv === null) {
    if (activeCustomers === null || activeCustomers <= 0) {
      required.push('active_customers_positive');
    }
    if (grossProfit === null) required.push('gross_profit_numeric');
  }

  if (explicitLtv === null) {
    if (churnRatePct === null || churnRatePct <= 0 || churnRatePct > 100) {
      required.push('ltv_or_churn_rate_pct_gt_0_lte_100');
    }
  } else if (explicitLtv < 0) {
    required.push('ltv_non_negative');
  }

  if (unitsSold !== null && unitsSold <= 0) {
    required.push('units_sold_positive');
  }
  if (variableCost !== null && variableCost < 0) {
    required.push('variable_cost_non_negative');
  }
  if ((unitsSold === null) !== (variableCost === null)) {
    required.push('units_sold_and_variable_cost_together');
  }

  if (required.length) {
    return envelope(
      'unit_economics',
      {},
      input,
      {
        method: 'customer_and_unit_economics',
        ltv_method: explicitLtv === null
          ? 'gross_profit_per_customer_divided_by_churn'
          : 'explicit_ltv',
        analysis_scope: analysisScope,
        fail_closed: true
      },
      required
    );
  }

  const cac = !ltvOnly ? acquisitionSpend / newCustomers : null;
  const revenuePerCustomer = revenue !== null && activeCustomers !== null && activeCustomers > 0
    ? revenue / activeCustomers
    : null;
  const grossProfitPerCustomer = grossProfit !== null && activeCustomers !== null && activeCustomers > 0
    ? grossProfit / activeCustomers
    : null;
  const grossMarginPct = revenue !== null && grossProfit !== null ? pctRatio(grossProfit, revenue) : null;

  const ltv = explicitLtv !== null
    ? explicitLtv
    : grossProfitPerCustomer / (churnRatePct / 100);

  const ltvToCac = cac === null || cac === 0 ? null : ltv / cac;
  const cacPaybackPeriods =
    cac !== null && grossProfitPerCustomer > 0 ? cac / grossProfitPerCustomer : null;

  let revenuePerUnit = null;
  let variableCostPerUnit = null;
  let contributionPerUnit = null;
  let contributionMarginPct = null;

  if (unitsSold !== null && variableCost !== null) {
    revenuePerUnit = revenue / unitsSold;
    variableCostPerUnit = variableCost / unitsSold;
    contributionPerUnit = (revenue - variableCost) / unitsSold;
    contributionMarginPct = pctRatio(revenue - variableCost, revenue);
  }

  return envelope(
    'unit_economics',
    {
      cac,
      ltv,
      ltv_to_cac: ltvToCac,
      cac_payback_periods: cacPaybackPeriods,
      revenue_per_customer: revenuePerCustomer,
      gross_profit_per_customer: grossProfitPerCustomer,
      gross_margin_pct: grossMarginPct,
      churn_rate_pct: churnRatePct,
      revenue_per_unit: revenuePerUnit,
      variable_cost_per_unit: variableCostPerUnit,
      contribution_per_unit: contributionPerUnit,
      contribution_margin_pct: contributionMarginPct
    },
    input,
    {
      method: 'customer_and_unit_economics',
      ltv_method: explicitLtv === null
        ? 'gross_profit_per_customer_divided_by_churn'
        : 'explicit_ltv',
      period_basis: String(input.period_basis || '').trim() || null,
      analysis_scope: analysisScope,
      fail_closed: true
    }
  );
}

module.exports = { unitEconomicsAnalysis };
