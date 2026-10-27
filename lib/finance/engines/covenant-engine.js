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

function resolveDscr(metrics = {}, required = [], path = 'actuals') {
  const explicit = finite(metrics.dscr);
  if (explicit !== null) return { value: explicit, source: 'explicit' };

  const operatingCashFlow = finite(metrics.operating_cash_flow);
  const ebitda = finite(metrics.ebitda);
  const debtService = finite(metrics.debt_service);

  if (operatingCashFlow === null && ebitda === null) {
    required.push(`${path}.operating_cash_flow_or_ebitda`);
  }
  if (debtService === null || debtService <= 0) {
    required.push(`${path}.debt_service_positive`);
  }

  if ((operatingCashFlow === null && ebitda === null) || debtService === null || debtService <= 0) {
    return { value: null, source: null };
  }

  return {
    value: (operatingCashFlow ?? ebitda) / debtService,
    source: operatingCashFlow !== null
      ? 'derived_operating_cash_flow_over_debt_service'
      : 'derived_ebitda_over_debt_service'
  };
}

function covenantAnalysis(input = {}) {
  const covenants = Array.isArray(input.covenants) ? input.covenants : [];
  const actuals = input.actuals && typeof input.actuals === 'object' && !Array.isArray(input.actuals)
    ? input.actuals
    : {};
  const forecasts = Array.isArray(input.forecasts) ? input.forecasts : [];
  const required = [];
  const deriveDscr = input.derive_dscr === true;

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

  const dscrRequested = deriveDscr && normalized.some(covenant => covenant.metric === 'dscr');
  const actualDscr = dscrRequested
    ? resolveDscr(actuals, required, 'actuals')
    : null;
  const forecastDscr = dscrRequested
    ? forecasts.map((forecast, index) =>
      resolveDscr(forecast?.metrics || {}, required, `forecasts[${index}].metrics`)
    )
    : [];

  if (required.length) {
    return envelope('covenant_monitoring', {}, input, {
      supported_operators: [...OPERATORS],
      derived_dscr_enabled: deriveDscr,
      derived_dscr_method: dscrRequested
        ? 'operating_cash_flow_or_ebitda_over_positive_debt_service'
        : null,
      fail_closed: dscrRequested
    }, required);
  }

  const results = normalized.map(covenant => {
    const actualResolved = covenant.metric === 'dscr' && dscrRequested
      ? actualDscr
      : { value: finite(actuals[covenant.metric]), source: 'explicit' };
    const actual = actualResolved.value;
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
    const forecastEvaluations = [];

    forecasts.forEach((forecast, index) => {
      const resolved = covenant.metric === 'dscr' && dscrRequested
        ? forecastDscr[index]
        : { value: finite(forecast?.metrics?.[covenant.metric]), source: 'explicit' };
      const value = resolved.value;
      if (value === null) return;

      const h = headroom(value, covenant.operator, covenant.threshold);
      const compliant = evaluate(value, covenant.operator, covenant.threshold);
      minimumForecastHeadroom = minimumForecastHeadroom === null
        ? h
        : Math.min(minimumForecastHeadroom, h);
      if (firstBreachPeriod === null && !compliant) {
        firstBreachPeriod = forecast.period ?? null;
      }
      forecastEvaluations.push({
        period: forecast.period ?? null,
        value,
        source: resolved.source,
        headroom: h,
        status: compliant ? 'compliant' : 'breach'
      });
    });

    return {
      covenant_id: covenant.id,
      metric: covenant.metric,
      operator: covenant.operator,
      threshold: covenant.threshold,
      actual,
      actual_source: actualResolved.source,
      status: currentStatus,
      headroom: currentHeadroom,
      headroom_pct: headroomPct,
      first_forecast_breach_period: firstBreachPeriod,
      minimum_forecast_headroom: minimumForecastHeadroom,
      forecast_evaluations: forecastEvaluations
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
    derived_dscr_enabled: deriveDscr,
    derived_dscr_method: dscrRequested
      ? 'operating_cash_flow_or_ebitda_over_positive_debt_service'
      : null,
    fail_closed_on_derived_dscr_inputs: dscrRequested
  });
}

module.exports = { covenantAnalysis };
