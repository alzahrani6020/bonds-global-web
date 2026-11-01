'use strict';

const { runFinancialEngine } = require('../finance/financial-engine-registry');

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function targetMap(targets = []) {
  const map = new Map();
  for (const row of targets) {
    if (row?.scenario !== 'base') continue;
    const value = finite(row.target_value);
    if (value === null) continue;
    map.set(String(row.metric_key || '').trim(), value);
  }
  return map;
}

function buildBoardPack(governance = {}, operations = {}, options = {}) {
  const metrics = Array.isArray(governance.metrics) ? governance.metrics : [];
  const targets = Array.isArray(governance.targets) ? governance.targets : [];
  const baseTargets = targetMap(targets);

  const actual = {};
  const kpis = [];
  for (const metric of metrics) {
    const code = String(metric?.metric_key || '').trim();
    const value = finite(metric?.actual);
    if (!code || value === null) continue;
    actual[code] = value;
    kpis.push({
      code,
      name: String(metric?.display_name_ar || metric?.display_name_en || code).trim(),
      value,
      target: baseTargets.has(code) ? baseTargets.get(code) : null
    });
  }

  const budget = {};
  for (const [key, value] of baseTargets.entries()) {
    if (Object.prototype.hasOwnProperty.call(actual, key)) budget[key] = value;
  }

  const alertEvaluations = Array.isArray(governance.alertEvaluations)
    ? governance.alertEvaluations
    : [];
  const risks = alertEvaluations
    .filter(row => row?.triggered === true)
    .map(row => ({
      id: row.id || null,
      title: row.name || row.metricKey || 'Triggered analytics alert',
      severity: row.severity || 'warning',
      owner: null,
      due_date: null
    }));

  const actions = (Array.isArray(operations.actions) ? operations.actions : [])
    .map(row => ({
      id: row.id || null,
      title: row.title || null,
      owner: row.owner_user_id || null,
      due_date: row.due_at || null,
      status: row.status || null
    }));

  const engineResult = runFinancialEngine('management_reporting', {
    pack_type: 'board',
    period: String(options.period || governance.asOfDate || '').trim() || null,
    currency: null,
    actual,
    budget,
    prior: {},
    materiality_pct: finite(options.materiality_pct) ?? 10,
    kpis,
    risks,
    actions
  });

  if (!engineResult?.ok) {
    return {
      status: 'unknown',
      generated: false,
      reason: 'Board Pack is unavailable because governed current-period metrics are insufficient.',
      requiredInputs: engineResult?.required_inputs || [],
      engine: 'management_reporting'
    };
  }

  const decisions = (Array.isArray(operations.decisions) ? operations.decisions : [])
    .slice(0, 20)
    .map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      confidence: row.confidence,
      expected_outcome: row.expected_outcome || {},
      measured_outcome: row.measured_outcome || {}
    }));

  const scenarios = (Array.isArray(operations.scenarios) ? operations.scenarios : [])
    .slice(0, 10)
    .map(row => ({
      id: row.id,
      name: row.name,
      scenario_type: row.scenario_type,
      confidence: row.confidence,
      outputs: row.outputs || {}
    }));

  return {
    status: 'active',
    generated: true,
    generatedAt: new Date().toISOString(),
    asOfDate: governance.asOfDate || null,
    engine: 'management_reporting',
    methodology: 'deterministic_governed_board_pack_no_ai',
    pack: {
      ...engineResult.metrics.pack,
      business_health: governance.businessHealth || null,
      decisions,
      scenarios,
      evidence_coverage: {
        actual_metric_count: Object.keys(actual).length,
        target_covered_metric_count: Object.keys(budget).length,
        kpi_count: kpis.length,
        triggered_risk_count: risks.length,
        action_count: actions.length,
        decision_count: decisions.length,
        scenario_count: scenarios.length
      }
    },
    diagnostics: engineResult.diagnostics || {}
  };
}

module.exports = { buildBoardPack };
