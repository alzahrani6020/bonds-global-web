'use strict';

const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

const PERIOD_STATUSES = new Set(['actual', 'forecast']);
const DIRECTIONS = new Set(['higher_is_better', 'lower_is_better']);

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function metricMap(raw, prefix, required) {
  const source = objectValue(raw);
  const result = {};
  for (const [metric, value] of Object.entries(source)) {
    const amount = finite(value);
    if (amount === null) required.push(`${prefix}.${metric}_numeric`);
    else result[metric] = amount;
  }
  return result;
}

function pctVariance(actual, reference) {
  if (reference === null || reference === 0) return null;
  return ((actual - reference) / Math.abs(reference)) * 100;
}

function planningBudgetingAnalysis(input = {}) {
  const required = [];
  const periods = Array.isArray(input.periods) ? input.periods : [];
  if (!periods.length) required.push('periods');

  const currency = String(input.currency || '').trim() || null;
  const fiscalYear = String(input.fiscal_year || '').trim() || null;
  const useBudgetAsForecast = input.use_budget_as_forecast === true;
  const materialityPct = finite(input.materiality_pct) ?? 0;
  if (materialityPct < 0) required.push('materiality_pct_non_negative');

  const directions = objectValue(input.metric_directions);
  for (const [metric, direction] of Object.entries(directions)) {
    if (!DIRECTIONS.has(String(direction || '').trim())) {
      required.push(`metric_directions.${metric}_higher_or_lower_is_better`);
    }
  }

  const seenPeriods = new Set();
  const normalized = periods.map((row, index) => {
    const period = String(row?.period || '').trim();
    const status = String(row?.status || '').trim();

    if (!period) required.push(`periods[${index}].period`);
    if (period && seenPeriods.has(period)) required.push(`periods[${index}].period_unique`);
    if (period) seenPeriods.add(period);
    if (!PERIOD_STATUSES.has(status)) required.push(`periods[${index}].status_actual_or_forecast`);

    const actual = metricMap(row?.actual, `periods[${index}].actual`, required);
    const budget = metricMap(row?.budget, `periods[${index}].budget`, required);
    const forecast = metricMap(row?.forecast, `periods[${index}].forecast`, required);

    if (status === 'actual' && Object.keys(actual).length === 0) {
      required.push(`periods[${index}].actual`);
    }
    if (
      status === 'forecast' &&
      Object.keys(forecast).length === 0 &&
      !(useBudgetAsForecast && Object.keys(budget).length > 0)
    ) {
      required.push(`periods[${index}].forecast_or_explicit_budget_fallback`);
    }

    return { period, status, actual, budget, forecast };
  });

  const diagnostics = {
    method: 'actual_budget_variance_plus_explicit_rolling_forecast',
    forecasting_method: 'actuals_plus_explicit_future_values',
    budget_fallback_requires_explicit_opt_in: true,
    use_budget_as_forecast: useBudgetAsForecast,
    materiality_pct: materialityPct,
    no_inferred_growth: true,
    no_inferred_seasonality: true,
    fail_closed: true
  };

  if (required.length) return envelope('planning_budgeting', {}, input, diagnostics, required);

  const metricNames = [...new Set(
    normalized.flatMap(row => [
      ...Object.keys(row.actual),
      ...Object.keys(row.budget),
      ...Object.keys(row.forecast)
    ])
  )].sort();

  if (!metricNames.length) {
    return envelope('planning_budgeting', {}, input, diagnostics, ['period_metrics']);
  }

  const rows = [];
  const summary = {};

  for (const metric of metricNames) {
    let actualToDate = 0;
    let budgetToDate = 0;
    let fullYearBudget = 0;
    let rollingForecast = 0;
    let actualPeriods = 0;
    let forecastPeriods = 0;
    let budgetPeriods = 0;
    let rollingCoverage = 0;

    for (const row of normalized) {
      const hasActual = Object.prototype.hasOwnProperty.call(row.actual, metric);
      const hasBudget = Object.prototype.hasOwnProperty.call(row.budget, metric);
      const hasForecast = Object.prototype.hasOwnProperty.call(row.forecast, metric);
      const actual = hasActual ? row.actual[metric] : null;
      const budget = hasBudget ? row.budget[metric] : null;
      const explicitForecast = hasForecast ? row.forecast[metric] : null;

      let rolling = null;
      let forecastSource = null;
      if (row.status === 'actual') {
        if (actual === null) required.push(`periods.${row.period}.actual.${metric}`);
        else {
          rolling = actual;
          forecastSource = 'actual';
          actualToDate += actual;
          actualPeriods += 1;
          if (budget !== null) budgetToDate += budget;
        }
      } else if (explicitForecast !== null) {
        rolling = explicitForecast;
        forecastSource = 'explicit_forecast';
        forecastPeriods += 1;
      } else if (useBudgetAsForecast && budget !== null) {
        rolling = budget;
        forecastSource = 'explicit_budget_fallback';
        forecastPeriods += 1;
      } else if (budget !== null || actual !== null || explicitForecast !== null) {
        required.push(`periods.${row.period}.forecast.${metric}`);
      }

      if (budget !== null) {
        fullYearBudget += budget;
        budgetPeriods += 1;
      }
      if (rolling !== null) {
        rollingForecast += rolling;
        rollingCoverage += 1;
      }

      const variance = actual !== null && budget !== null ? actual - budget : null;
      const variancePct = actual !== null && budget !== null ? pctVariance(actual, budget) : null;
      const direction = DIRECTIONS.has(directions[metric]) ? directions[metric] : null;
      const favorable =
        variance === null || direction === null
          ? null
          : variance === 0
            ? true
            : direction === 'higher_is_better'
              ? variance > 0
              : variance < 0;

      rows.push({
        period: row.period,
        status: row.status,
        metric,
        actual,
        budget,
        forecast: explicitForecast,
        rolling_forecast: rolling,
        forecast_source: forecastSource,
        actual_vs_budget_variance: variance,
        actual_vs_budget_variance_pct: variancePct,
        material: variancePct !== null && Math.abs(variancePct) >= materialityPct,
        direction,
        favorable
      });
    }

    const actualVariance = actualToDate - budgetToDate;
    const actualVariancePct = actualPeriods > 0 ? pctVariance(actualToDate, budgetToDate) : null;
    const forecastVariance = rollingForecast - fullYearBudget;
    const forecastVariancePct = rollingCoverage > 0 ? pctVariance(rollingForecast, fullYearBudget) : null;
    const direction = DIRECTIONS.has(directions[metric]) ? directions[metric] : null;
    const forecastFavorable =
      direction === null || forecastVariance === 0
        ? (direction === null ? null : true)
        : direction === 'higher_is_better'
          ? forecastVariance > 0
          : forecastVariance < 0;

    summary[metric] = {
      actual_to_date: actualToDate,
      budget_to_date: budgetToDate,
      actual_vs_budget_variance: actualVariance,
      actual_vs_budget_variance_pct: actualVariancePct,
      full_year_budget: fullYearBudget,
      rolling_forecast: rollingForecast,
      forecast_vs_budget_variance: forecastVariance,
      forecast_vs_budget_variance_pct: forecastVariancePct,
      actual_period_count: actualPeriods,
      forecast_period_count: forecastPeriods,
      budget_period_count: budgetPeriods,
      rolling_coverage_period_count: rollingCoverage,
      direction,
      forecast_favorable: forecastFavorable
    };
  }

  if (required.length) return envelope('planning_budgeting', {}, input, diagnostics, required);

  return envelope(
    'planning_budgeting',
    {
      fiscal_year: fiscalYear,
      currency,
      period_count: normalized.length,
      metric_count: metricNames.length,
      actual_period_count: normalized.filter(row => row.status === 'actual').length,
      forecast_period_count: normalized.filter(row => row.status === 'forecast').length,
      material_variance_count: rows.filter(row => row.material).length,
      rows,
      summary
    },
    input,
    diagnostics
  );
}

module.exports = { PERIOD_STATUSES, DIRECTIONS, planningBudgetingAnalysis };
