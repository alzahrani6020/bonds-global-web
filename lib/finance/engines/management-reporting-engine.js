'use strict';

const { finite, safeDiv } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

const PACK_TYPES = new Set([
  'cfo',
  'board',
  'monthly_management',
  'kpi'
]);

function pctChange(current, reference) {
  const value = safeDiv(current - reference, Math.abs(reference));
  return value === null ? null : value * 100;
}

function varianceRow(metric, actual, budget, prior, materialityPct) {
  const budgetVariance = budget === null ? null : actual - budget;
  const budgetVariancePct = budget === null ? null : pctChange(actual, budget);
  const priorChange = prior === null ? null : actual - prior;
  const priorChangePct = prior === null ? null : pctChange(actual, prior);

  const material =
    budgetVariancePct !== null &&
    Math.abs(budgetVariancePct) >= materialityPct;

  return {
    metric,
    actual,
    budget,
    prior,
    budget_variance: budgetVariance,
    budget_variance_pct: budgetVariancePct,
    prior_change: priorChange,
    prior_change_pct: priorChangePct,
    material
  };
}

function deterministicCommentary(row) {
  if (row.budget === null || row.budget_variance_pct === null) {
    return null;
  }

  const direction = row.budget_variance > 0 ? 'above' :
    row.budget_variance < 0 ? 'below' : 'equal_to';

  return {
    metric: row.metric,
    direction,
    variance: row.budget_variance,
    variance_pct: row.budget_variance_pct,
    text:
      direction === 'equal_to'
        ? `${row.metric} equals budget.`
        : `${row.metric} is ${direction.replace('_',' ')} budget by ${Math.abs(row.budget_variance_pct).toFixed(2)}%.`
  };
}

function managementReporting(input = {}) {
  const required = [];
  const packType = String(input.pack_type || '').trim();

  if (!PACK_TYPES.has(packType)) {
    required.push('pack_type_cfo_board_monthly_management_or_kpi');
  }

  const actual =
    input.actual && typeof input.actual === 'object' && !Array.isArray(input.actual)
      ? input.actual
      : null;

  if (!actual || Object.keys(actual).length === 0) {
    required.push('actual');
  }

  const budget =
    input.budget && typeof input.budget === 'object' && !Array.isArray(input.budget)
      ? input.budget
      : {};

  const prior =
    input.prior && typeof input.prior === 'object' && !Array.isArray(input.prior)
      ? input.prior
      : {};

  const materialityPct = finite(input.materiality_pct) ?? 0;
  if (materialityPct < 0) {
    required.push('materiality_pct_non_negative');
  }

  const kpis = Array.isArray(input.kpis) ? input.kpis : [];
  const risks = Array.isArray(input.risks) ? input.risks : [];
  const actions = Array.isArray(input.actions) ? input.actions : [];

  const actualMetrics = {};
  if (actual) {
    for (const [metric, raw] of Object.entries(actual)) {
      const value = finite(raw);
      if (value === null) {
        required.push(`actual.${metric}_numeric`);
      } else {
        actualMetrics[metric] = value;
      }
    }
  }

  const budgetMetrics = {};
  for (const [metric, raw] of Object.entries(budget)) {
    const value = finite(raw);
    if (value === null) {
      required.push(`budget.${metric}_numeric`);
    } else {
      budgetMetrics[metric] = value;
    }
  }

  const priorMetrics = {};
  for (const [metric, raw] of Object.entries(prior)) {
    const value = finite(raw);
    if (value === null) {
      required.push(`prior.${metric}_numeric`);
    } else {
      priorMetrics[metric] = value;
    }
  }

  if (required.length) {
    return envelope(
      'management_reporting',
      {},
      input,
      {
        method: 'deterministic_management_pack_composer',
        pack_type: packType || null,
        fail_closed: true
      },
      required
    );
  }

  const metrics = Object.keys(actualMetrics).sort();
  const variances = metrics.map(metric =>
    varianceRow(
      metric,
      actualMetrics[metric],
      Object.prototype.hasOwnProperty.call(budgetMetrics, metric)
        ? budgetMetrics[metric]
        : null,
      Object.prototype.hasOwnProperty.call(priorMetrics, metric)
        ? priorMetrics[metric]
        : null,
      materialityPct
    )
  );

  const materialVariances = variances.filter(row => row.material);
  const commentary = materialVariances
    .map(deterministicCommentary)
    .filter(Boolean);

  const normalizedKpis = kpis.map((item, index) => {
    const code = String(item?.code || '').trim();
    const name = String(item?.name || '').trim();
    const value = finite(item?.value);
    const target = finite(item?.target);
    if (!code) required.push(`kpis[${index}].code`);
    if (!name) required.push(`kpis[${index}].name`);
    if (value === null) required.push(`kpis[${index}].value_numeric`);

    return {
      code,
      name,
      value,
      target,
      target_variance: target === null || value === null ? null : value - target,
      target_variance_pct:
        target === null || value === null ? null : pctChange(value, target)
    };
  });

  if (required.length) {
    return envelope(
      'management_reporting',
      {},
      input,
      {
        method: 'deterministic_management_pack_composer',
        pack_type: packType,
        fail_closed: true
      },
      required
    );
  }

  const normalizedRisks = risks.map((risk, index) => ({
    id: String(risk?.id || `risk_${index + 1}`),
    title: String(risk?.title || '').trim() || null,
    severity: String(risk?.severity || '').trim() || null,
    owner: String(risk?.owner || '').trim() || null,
    due_date: String(risk?.due_date || '').trim() || null
  }));

  const normalizedActions = actions.map((action, index) => ({
    id: String(action?.id || `action_${index + 1}`),
    title: String(action?.title || '').trim() || null,
    owner: String(action?.owner || '').trim() || null,
    due_date: String(action?.due_date || '').trim() || null,
    status: String(action?.status || '').trim() || null
  }));

  const pack = {
    type: packType,
    period: String(input.period || '').trim() || null,
    currency: String(input.currency || '').trim() || null,
    financial_highlights: metrics.map(metric => ({
      metric,
      value: actualMetrics[metric]
    })),
    actual_vs_budget: variances,
    material_variances: materialVariances,
    variance_commentary: commentary,
    kpis: normalizedKpis,
    risks: normalizedRisks,
    actions_required: normalizedActions
  };

  if (packType === 'board') {
    pack.board_focus = {
      top_material_variances: materialVariances
        .slice()
        .sort((a, b) =>
          Math.abs(b.budget_variance_pct || 0) -
          Math.abs(a.budget_variance_pct || 0)
        )
        .slice(0, 5),
      risk_count: normalizedRisks.length,
      action_count: normalizedActions.length
    };
  }

  if (packType === 'cfo') {
    pack.cfo_focus = {
      metric_count: metrics.length,
      budget_coverage_count: variances.filter(row => row.budget !== null).length,
      prior_coverage_count: variances.filter(row => row.prior !== null).length,
      material_variance_count: materialVariances.length
    };
  }

  if (packType === 'monthly_management') {
    pack.monthly_focus = {
      material_variance_count: materialVariances.length,
      kpi_count: normalizedKpis.length,
      open_action_count: normalizedActions.filter(
        row => row.status !== 'completed'
      ).length
    };
  }

  if (packType === 'kpi') {
    pack.kpi_focus = {
      kpi_count: normalizedKpis.length,
      with_target_count: normalizedKpis.filter(row => row.target !== null).length
    };
  }

  return envelope(
    'management_reporting',
    {
      pack,
      metric_count: metrics.length,
      material_variance_count: materialVariances.length,
      kpi_count: normalizedKpis.length,
      risk_count: normalizedRisks.length,
      action_count: normalizedActions.length
    },
    input,
    {
      method: 'deterministic_management_pack_composer',
      pack_type: packType,
      materiality_pct: materialityPct,
      commentary_method: 'formula_based_no_ai',
      fail_closed: true
    }
  );
}

module.exports = {
  PACK_TYPES,
  managementReporting
};
