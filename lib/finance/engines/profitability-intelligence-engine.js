'use strict';

const { finite, safeDiv } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

const SUPPORTED_SCOPES = new Set([
  'customer',
  'product',
  'branch',
  'project',
  'segment',
  'cost_center'
]);

function pctRatio(numerator, denominator) {
  const value = safeDiv(numerator, denominator);
  return value === null ? null : value * 100;
}

function profitabilityIntelligence(input = {}) {
  const units = Array.isArray(input.units) ? input.units : [];
  const required = [];

  if (!units.length) required.push('units');

  const rows = units.map((unit, index) => {
    const id = String(unit?.id || unit?.code || '').trim();
    const name = String(unit?.name || '').trim() || null;
    const scopeType = String(unit?.scope_type || '').trim();
    const revenue = finite(unit?.revenue);
    const variableCost = finite(unit?.variable_cost) ?? 0;
    const directFixedCost = finite(unit?.direct_fixed_cost) ?? 0;
    const allocatedCost = finite(unit?.allocated_cost) ?? 0;

    if (!id) required.push(`units[${index}].id`);
    if (!SUPPORTED_SCOPES.has(scopeType)) {
      required.push(`units[${index}].scope_type_supported`);
    }
    if (revenue === null) required.push(`units[${index}].revenue_numeric`);
    if (variableCost < 0) required.push(`units[${index}].variable_cost_non_negative`);
    if (directFixedCost < 0) required.push(`units[${index}].direct_fixed_cost_non_negative`);
    if (allocatedCost < 0) required.push(`units[${index}].allocated_cost_non_negative`);

    const contributionMargin = revenue === null ? null : revenue - variableCost;
    const totalCost = variableCost + directFixedCost + allocatedCost;
    const operatingProfit = revenue === null ? null : revenue - totalCost;
    const contributionMarginPct = revenue === null ? null : pctRatio(contributionMargin, revenue);
    const operatingMarginPct = revenue === null ? null : pctRatio(operatingProfit, revenue);
    const costToRevenuePct = revenue === null ? null : pctRatio(totalCost, revenue);
    const fixedCostBase = directFixedCost + allocatedCost;
    const contributionRatio = revenue === null || revenue === 0
      ? null
      : contributionMargin / revenue;
    const breakEvenRevenue =
      contributionRatio !== null && contributionRatio > 0
        ? fixedCostBase / contributionRatio
        : null;

    return {
      id,
      name,
      scope_type: scopeType,
      revenue,
      variable_cost: variableCost,
      direct_fixed_cost: directFixedCost,
      allocated_cost: allocatedCost,
      total_cost: totalCost,
      contribution_margin: contributionMargin,
      contribution_margin_pct: contributionMarginPct,
      operating_profit: operatingProfit,
      operating_margin_pct: operatingMarginPct,
      cost_to_revenue_pct: costToRevenuePct,
      break_even_revenue: breakEvenRevenue
    };
  });

  if (required.length) {
    return envelope(
      'profitability_intelligence',
      {},
      input,
      {
        method: 'explicit_dimensional_profitability',
        supported_scopes: [...SUPPORTED_SCOPES],
        allocated_cost_supported: true,
        fail_closed: true
      },
      required
    );
  }

  const totals = rows.reduce((acc, row) => {
    acc.revenue += row.revenue;
    acc.variable_cost += row.variable_cost;
    acc.direct_fixed_cost += row.direct_fixed_cost;
    acc.allocated_cost += row.allocated_cost;
    acc.total_cost += row.total_cost;
    acc.contribution_margin += row.contribution_margin;
    acc.operating_profit += row.operating_profit;
    return acc;
  }, {
    revenue: 0,
    variable_cost: 0,
    direct_fixed_cost: 0,
    allocated_cost: 0,
    total_cost: 0,
    contribution_margin: 0,
    operating_profit: 0
  });

  const rankedByProfit = [...rows].sort(
    (a, b) => b.operating_profit - a.operating_profit
  );
  const rankedByMargin = [...rows].sort((a, b) => {
    const av = a.operating_margin_pct ?? Number.NEGATIVE_INFINITY;
    const bv = b.operating_margin_pct ?? Number.NEGATIVE_INFINITY;
    return bv - av;
  });

  return envelope(
    'profitability_intelligence',
    {
      unit_count: rows.length,
      scope_types: [...new Set(rows.map(row => row.scope_type))].sort(),
      total_revenue: totals.revenue,
      total_variable_cost: totals.variable_cost,
      total_direct_fixed_cost: totals.direct_fixed_cost,
      total_allocated_cost: totals.allocated_cost,
      total_cost: totals.total_cost,
      total_contribution_margin: totals.contribution_margin,
      total_contribution_margin_pct: pctRatio(
        totals.contribution_margin,
        totals.revenue
      ),
      total_operating_profit: totals.operating_profit,
      total_operating_margin_pct: pctRatio(
        totals.operating_profit,
        totals.revenue
      ),
      allocated_cost_share_pct: pctRatio(
        totals.allocated_cost,
        totals.total_cost
      ),
      profitable_unit_count: rows.filter(row => row.operating_profit > 0).length,
      loss_making_unit_count: rows.filter(row => row.operating_profit < 0).length,
      break_even_unit_count: rows.filter(row => row.operating_profit === 0).length,
      highest_profit_unit: rankedByProfit[0] || null,
      lowest_profit_unit: rankedByProfit[rankedByProfit.length - 1] || null,
      highest_margin_unit: rankedByMargin[0] || null,
      units: rankedByProfit.map((row, index) => ({
        profitability_rank: index + 1,
        ...row
      }))
    },
    input,
    {
      method: 'explicit_dimensional_profitability',
      supported_scopes: [...SUPPORTED_SCOPES],
      allocated_cost_supported: true,
      cost_allocation_source: String(input.cost_allocation_source || '').trim() || null,
      fail_closed: true
    }
  );
}

module.exports = {
  SUPPORTED_SCOPES,
  profitabilityIntelligence
};
