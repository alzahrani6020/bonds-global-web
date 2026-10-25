'use strict';

const { finite, clamp, safeDiv } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function severityRank(value) {
  if (value === 'critical') return 3;
  if (value === 'warning') return 2;
  if (value === 'watch') return 1;
  return 0;
}

function earlyWarningAnalysis(input = {}, baseMetrics = {}) {
  const rules = Array.isArray(input.early_warning_rules)
    ? input.early_warning_rules
    : [];
  const explicitMetrics =
    input.metrics && typeof input.metrics === 'object' && !Array.isArray(input.metrics)
      ? input.metrics
      : {};
  const priorMetrics =
    input.prior_metrics && typeof input.prior_metrics === 'object' && !Array.isArray(input.prior_metrics)
      ? input.prior_metrics
      : {};
  const required = [];

  if (!rules.length) required.push('early_warning_rules');

  const alerts = rules.map((rule, index) => {
    const metric = String(rule?.metric || '').trim();
    const direction = String(rule?.direction || '').trim();
    const warning = finite(rule?.warning_threshold);
    const critical = finite(rule?.critical_threshold);
    const weight = finite(rule?.weight) ?? 1;

    if (!metric) required.push(`early_warning_rules[${index}].metric`);
    if (!['below', 'above'].includes(direction)) {
      required.push(`early_warning_rules[${index}].direction_below_or_above`);
    }
    if (warning === null) required.push(`early_warning_rules[${index}].warning_threshold_numeric`);
    if (critical === null) required.push(`early_warning_rules[${index}].critical_threshold_numeric`);
    if (weight <= 0) required.push(`early_warning_rules[${index}].weight_positive`);

    if (
      warning !== null &&
      critical !== null &&
      direction === 'below' &&
      critical > warning
    ) {
      required.push(`early_warning_rules[${index}].critical_lte_warning`);
    }
    if (
      warning !== null &&
      critical !== null &&
      direction === 'above' &&
      critical < warning
    ) {
      required.push(`early_warning_rules[${index}].critical_gte_warning`);
    }

    const current = finite(
      Object.prototype.hasOwnProperty.call(explicitMetrics, metric)
        ? explicitMetrics[metric]
        : baseMetrics[metric]
    );
    const prior = finite(priorMetrics[metric]);

    if (metric && current === null) {
      required.push(`metric_value:${metric}`);
    }

    let severity = 'normal';
    if (current !== null && warning !== null && critical !== null) {
      if (direction === 'below') {
        severity = current <= critical
          ? 'critical'
          : current <= warning
            ? 'warning'
            : 'normal';
      } else if (direction === 'above') {
        severity = current >= critical
          ? 'critical'
          : current >= warning
            ? 'warning'
            : 'normal';
      }
    }

    const deteriorating = current !== null && prior !== null
      ? direction === 'below'
        ? current < prior
        : current > prior
      : false;

    if (severity === 'normal' && deteriorating) severity = 'watch';

    const headroomToWarning = current === null || warning === null
      ? null
      : direction === 'below'
        ? current - warning
        : warning - current;

    return {
      metric,
      direction,
      current_value: current,
      prior_value: prior,
      warning_threshold: warning,
      critical_threshold: critical,
      headroom_to_warning: headroomToWarning,
      deteriorating,
      severity,
      weight
    };
  });

  if (required.length) {
    return envelope(
      'risk_analysis',
      {},
      input,
      {
        service_scope: 'early_warning_analysis',
        method: 'explicit_threshold_rules',
        fail_closed: true
      },
      required
    );
  }

  const totalWeight = alerts.reduce((sum, row) => sum + row.weight, 0);
  const score = totalWeight
    ? alerts.reduce((sum, row) => {
      const severityScore = row.severity === 'critical'
        ? 100
        : row.severity === 'warning'
          ? 60
          : row.severity === 'watch'
            ? 30
            : 0;
      return sum + severityScore * row.weight;
    }, 0) / totalWeight
    : 0;

  const highest = alerts.reduce(
    (best, row) => severityRank(row.severity) > severityRank(best)
      ? row.severity
      : best,
    'normal'
  );

  return envelope(
    'risk_analysis',
    {
      early_warning_score: Math.round(score),
      overall_severity: highest,
      alert_count: alerts.filter(row => row.severity !== 'normal').length,
      critical_count: alerts.filter(row => row.severity === 'critical').length,
      warning_count: alerts.filter(row => row.severity === 'warning').length,
      watch_count: alerts.filter(row => row.severity === 'watch').length,
      deteriorating_count: alerts.filter(row => row.deteriorating).length,
      alerts
    },
    input,
    {
      service_scope: 'early_warning_analysis',
      method: 'explicit_threshold_rules',
      fail_closed: true
    }
  );
}

function riskAnalysis(input = {}, options = {}) {
  const currentRatio = safeDiv(input.current_assets, input.current_liabilities);
  const leverage = safeDiv(input.total_debt, input.equity);
  const dscr = safeDiv(
    finite(input.operating_cash_flow) ?? finite(input.ebitda),
    input.annual_debt_service
  );
  const concentration = finite(input.customer_concentration_pct);
  const cashBufferMonths = finite(input.cash_buffer_months);

  const factors = [];
  if (currentRatio !== null) factors.push({ key: 'liquidity', risk: clamp(100 - currentRatio * 55, 0, 100), weight: 0.25 });
  if (leverage !== null) factors.push({ key: 'leverage', risk: clamp(leverage * 25, 0, 100), weight: 0.25 });
  if (dscr !== null) factors.push({ key: 'debt_service', risk: clamp(100 - dscr * 60, 0, 100), weight: 0.25 });
  if (concentration !== null) factors.push({ key: 'concentration', risk: clamp(concentration, 0, 100), weight: 0.15 });
  if (cashBufferMonths !== null) factors.push({ key: 'cash_buffer', risk: clamp(100 - cashBufferMonths * 16.67, 0, 100), weight: 0.10 });

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const score = totalWeight
    ? Math.round(factors.reduce((s, f) => s + f.risk * f.weight, 0) / totalWeight)
    : null;

  const metrics = {
    risk_score: score,
    risk_band: score === null ? 'unknown' : score < 25 ? 'low' : score < 50 ? 'moderate' : score < 75 ? 'high' : 'critical',
    current_ratio: currentRatio,
    debt_to_equity: leverage,
    dscr,
    customer_concentration_pct: concentration,
    cash_buffer_months: cashBufferMonths,
    factors
  };

  const serviceCode = String(options.serviceCode || '').trim();

  if (serviceCode === 'early_warning_analysis') {
    return earlyWarningAnalysis(input, metrics);
  }

  const required = factors.length ? [] : ['financial_risk_inputs'];
  return envelope(
    'risk_analysis',
    metrics,
    input,
    { service_scope: serviceCode || null },
    required
  );
}

module.exports = { riskAnalysis };
