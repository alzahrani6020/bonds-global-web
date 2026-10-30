'use strict';

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function targetAttainment(actual, target, comparison) {
  const a = finite(actual), t = finite(target);
  if (a == null || t == null || t === 0) return null;
  if (comparison === 'lte') return a <= t ? 100 : Math.max(0, Math.min(100, (t / a) * 100));
  if (comparison === 'eq') return a === t ? 100 : Math.max(0, 100 - (Math.abs(a - t) / Math.abs(t)) * 100);
  return Math.max(0, Math.min(100, (a / t) * 100));
}

function computeBusinessHealth(metrics, targets) {
  const rows = Array.isArray(targets) ? targets : [];
  const scored = [];
  for (const row of rows) {
    const actual = metrics?.[row.metric_key];
    const score = targetAttainment(actual, row.target_value, row.comparison || 'gte');
    if (score == null) continue;
    scored.push({ metricKey: row.metric_key, actual: finite(actual), target: finite(row.target_value), score });
  }
  if (!scored.length) {
    return { status: 'unknown', score: null, confidence: 'unknown', reason: 'No measurable approved targets' };
  }
  const score = scored.reduce((s, x) => s + x.score, 0) / scored.length;
  return {
    status: 'computed',
    score: Math.round(Math.min(100, score) * 10) / 10,
    confidence: scored.length >= 5 ? 'high' : scored.length >= 3 ? 'medium' : 'low',
    components: scored
  };
}

function compare(actual, operator, threshold) {
  const a = finite(actual), t = finite(threshold);
  if (a == null || t == null) return null;
  if (operator === 'gt') return a > t;
  if (operator === 'gte') return a >= t;
  if (operator === 'lt') return a < t;
  if (operator === 'lte') return a <= t;
  if (operator === 'eq') return a === t;
  return null;
}

function evaluateAlertRules(metrics, rules) {
  return (Array.isArray(rules) ? rules : []).map(rule => {
    if (!rule?.enabled) return { id: rule?.id || null, status: 'disabled', triggered: false };
    if (['pct_drop','pct_rise','stale'].includes(rule.operator)) {
      return { id: rule.id || null, status: 'unknown', triggered: null, reason: 'Historical/freshness context required' };
    }
    const result = compare(metrics?.[rule.metric_key], rule.operator, rule.threshold);
    if (result == null) return { id: rule.id || null, status: 'unknown', triggered: null, reason: 'Metric unavailable' };
    return {
      id: rule.id || null,
      name: rule.name || rule.metric_key,
      metricKey: rule.metric_key,
      actual: finite(metrics?.[rule.metric_key]),
      threshold: finite(rule.threshold),
      severity: rule.severity || 'warning',
      status: 'evaluated',
      triggered: result
    };
  });
}

const SCENARIO_KEYS = new Set([
  'traffic','conversionRatePct','leads','closeRatePct','clients',
  'averageRevenuePerClient','revenue','pipelineValue'
]);

function simulateScenario(baseline, changes) {
  const base = {};
  for (const key of SCENARIO_KEYS) {
    const value = finite(baseline?.[key]);
    if (value != null) base[key] = value;
  }
  const applied = { ...base };
  for (const [key, change] of Object.entries(changes || {})) {
    if (!SCENARIO_KEYS.has(key)) continue;
    const pct = finite(change?.pct);
    const absolute = finite(change?.absolute);
    const current = finite(applied[key]);
    if (absolute != null) applied[key] = absolute;
    else if (pct != null && current != null) applied[key] = current * (1 + pct / 100);
  }

  if (finite(applied.traffic) != null && finite(applied.conversionRatePct) != null) {
    applied.leads = applied.traffic * applied.conversionRatePct / 100;
  }
  if (finite(applied.leads) != null && finite(applied.closeRatePct) != null) {
    applied.clients = applied.leads * applied.closeRatePct / 100;
  }
  if (finite(applied.clients) != null && finite(applied.averageRevenuePerClient) != null) {
    applied.revenue = applied.clients * applied.averageRevenuePerClient;
  }

  return {
    status: 'simulated',
    confidence: 'low',
    baseline: base,
    outputs: applied,
    disclaimer: 'Mechanical what-if only; no causal inference or forecast claim'
  };
}

module.exports = {
  finite,
  targetAttainment,
  computeBusinessHealth,
  evaluateAlertRules,
  simulateScenario
};
