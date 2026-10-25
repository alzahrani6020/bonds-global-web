'use strict';

const { finite } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

const OPERATORS = new Set(['>=', '>', '<=', '<']);

function evaluate(actual, operator, threshold) {
  if (operator === '>=') return actual >= threshold;
  if (operator === '>') return actual > threshold;
  if (operator === '<=') return actual <= threshold;
  if (operator === '<') return actual < threshold;
  return false;
}

function headroom(actual, operator, threshold) {
  return operator === '>=' || operator === '>'
    ? actual - threshold
    : threshold - actual;
}

function covenantAnalysis(input = {}) {
  const covenants = Array.isArray(input.covenants) ? input.covenants : [];
  const actuals = input.actuals && typeof input.actuals === 'object' && !Array.isArray(input.actuals)
    ? input.actuals
    : {};
  const forecasts = Array.isArray(input.forecasts) ? input.forecasts : [];
  const required = [];

  if (!covenants.length) required.push('covenants');

  const normalized = covenants.map((item, index) => {
    const metric = String(item?.metric || '').trim();
    const operator = String(item?.operator || '').trim();
    const threshold = finite(item?.threshold);

    if (!metric) required.push(`covenants[${index}].metric`);
    if (!OPERATORS.has(operator)) required.push(`covenants[${index}].operator_supported`);
    if (threshold === null) required.push(`covenants[${index}].threshold_numeric`);

    return {
      id: String(item?.id || item?.code || `covenant_${index + 1}`),
      metric,
      operator,
      threshold
    };
  });

  if (required.length) {
    return envelope('covenant_monitoring', {}, input, {
      supported_operators: [...OPERATORS]
    }, required);
  }

  const results = normalized.map(covenant => {
    const actual = finite(actuals[covenant.metric]);
    const currentStatus = actual === null
      ? 'unknown'
      : evaluate(actual, covenant.operator, covenant.threshold) ? 'compliant' : 'breach';
    const currentHeadroom = actual === null
      ? null
      : headroom(actual, covenant.operator, covenant.threshold);
    const headroomPct = actual === null || covenant.threshold === 0
      ? null
      : (currentHeadroom / Math.abs(covenant.threshold)) * 100;

    let firstBreachPeriod = null;
    let minimumForecastHeadroom = null;

    for (const forecast of forecasts) {
      const value = finite(forecast?.metrics?.[covenant.metric]);
      if (value === null) continue;
      const h = headroom(value, covenant.operator, covenant.threshold);
      minimumForecastHeadroom = minimumForecastHeadroom === null
        ? h
        : Math.min(minimumForecastHeadroom, h);
      if (firstBreachPeriod === null && !evaluate(value, covenant.operator, covenant.threshold)) {
        firstBreachPeriod = forecast.period ?? null;
      }
    }

    return {
      covenant_id: covenant.id,
      metric: covenant.metric,
      operator: covenant.operator,
      threshold: covenant.threshold,
      actual,
      status: currentStatus,
      headroom: currentHeadroom,
      headroom_pct: headroomPct,
      first_forecast_breach_period: firstBreachPeriod,
      minimum_forecast_headroom: minimumForecastHeadroom
    };
  });

  const known = results.filter(x => x.status !== 'unknown');
  const breaches = results.filter(x => x.status === 'breach');
  const forecastBreaches = results.filter(x => x.first_forecast_breach_period !== null);

  return envelope('covenant_monitoring', {
    covenant_count: results.length,
    evaluated_count: known.length,
    current_breach_count: breaches.length,
    forecast_breach_count: forecastBreaches.length,
    overall_status: breaches.length
      ? 'breach'
      : known.length === results.length ? 'compliant' : 'incomplete',
    covenants: results
  }, input, {
    supported_operators: [...OPERATORS],
    fail_closed_on_missing_actuals: true
  });
}

module.exports = { covenantAnalysis };
