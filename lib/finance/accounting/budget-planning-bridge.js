'use strict';

const CREDIT_NORMAL = new Set([
  'liability','equity','revenue','contra_asset','contra_expense'
]);

function money(value) {
  const out = Number(value);
  if (!Number.isFinite(out)) throw new Error('ACCOUNTING_BUDGET_AMOUNT_INVALID');
  return Math.round((out + Number.EPSILON) * 100) / 100;
}

function metricKey(row = {}) {
  const code = String(row.account_code || '').trim();
  if (!code) throw new Error('ACCOUNTING_BUDGET_ACCOUNT_CODE_REQUIRED');
  const dimensions = row.dimensions && typeof row.dimensions === 'object' &&
    !Array.isArray(row.dimensions) ? row.dimensions : {};
  const suffix = Object.keys(dimensions).sort()
    .map(key => `${key}=${String(dimensions[key])}`)
    .join('|');
  return suffix ? `${code}|${suffix}` : code;
}

function actualAmount(row = {}) {
  const debit = money(row.debit || 0);
  const credit = money(row.credit || 0);
  const type = String(row.account_type || '').trim();
  return CREDIT_NORMAL.has(type)
    ? money(credit - debit)
    : money(debit - credit);
}

function addMetric(target, key, amount) {
  target[key] = money((target[key] || 0) + amount);
}

function rowsByPeriod(rows = [], amountResolver) {
  const out = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const period = String(row.period || '').trim();
    if (!period) throw new Error('ACCOUNTING_BUDGET_PERIOD_CODE_REQUIRED');
    if (!out.has(period)) out.set(period, {});
    addMetric(out.get(period), metricKey(row), amountResolver(row));
  }
  return out;
}

function buildPlanningInputFromBudgetSnapshot(snapshot = {}, options = {}) {
  if (!snapshot || snapshot.ok !== true) {
    throw new Error('ACCOUNTING_BUDGET_SNAPSHOT_REQUIRED');
  }

  const actualThrough = String(options.actualThrough || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(actualThrough)) {
    throw new Error('ACCOUNTING_BUDGET_ACTUAL_THROUGH_REQUIRED');
  }

  const budgetByPeriod = rowsByPeriod(
    snapshot.budget_lines,
    row => money(row.amount)
  );
  const forecastByPeriod = rowsByPeriod(
    snapshot.forecast_lines,
    row => money(row.amount)
  );
  const actualByPeriod = rowsByPeriod(
    snapshot.actual_lines,
    actualAmount
  );

  const periods = (Array.isArray(snapshot.periods) ? snapshot.periods : [])
    .slice()
    .sort((a,b) => String(a.starts_on).localeCompare(String(b.starts_on)))
    .map(row => {
      const period = String(row.period || '').trim();
      const endsOn = String(row.ends_on || '').slice(0,10);
      const isActual = endsOn && endsOn <= actualThrough;
      return {
        period,
        status:isActual ? 'actual' : 'forecast',
        actual:isActual ? (actualByPeriod.get(period) || {}) : {},
        budget:budgetByPeriod.get(period) || {},
        forecast:isActual ? {} : (forecastByPeriod.get(period) || {})
      };
    });

  return {
    fiscal_year:String(snapshot.fiscal_year_start || '').slice(0,4) || null,
    currency:snapshot.currency || null,
    actual_through:actualThrough,
    use_budget_as_forecast:options.useBudgetAsForecast === true,
    materiality_pct:options.materialityPct == null ? 0 : Number(options.materialityPct),
    metric_directions:options.metricDirections && typeof options.metricDirections === 'object' &&
      !Array.isArray(options.metricDirections) ? options.metricDirections : {},
    periods
  };
}

module.exports = {
  CREDIT_NORMAL,
  money,
  metricKey,
  actualAmount,
  buildPlanningInputFromBudgetSnapshot
};
