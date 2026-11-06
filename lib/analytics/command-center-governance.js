'use strict';

const { computeBusinessHealth, evaluateAlertRules } = require('./command-center-engine');

const TARGET_COMPARISONS = new Set(['gte','lte','eq']);
const TARGET_SCENARIOS = new Set(['base','upside','downside']);
const ALERT_OPERATORS = new Set(['gt','gte','lt','lte','eq','pct_drop','pct_rise','stale']);
const ALERT_SEVERITIES = new Set(['info','warning','high','critical']);

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function riyadhDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function currentMonthKey(date = new Date()) {
  return riyadhDate(date).slice(0, 7);
}

function buildMetricSnapshot(executiveData = {}, firstPartyData = {}, ga4Data = {}) {
  const executive = executiveData.executive || {};
  const traffic = firstPartyData.traffic || {};
  const leads = firstPartyData.leads || {};
  const gaHealthy = ga4Data?.configured === true && ga4Data?.status === 'healthy';
  const month = currentMonthKey();
  const monthlyRevenueRow = (executive.revenueSeries || []).find(row => row?.month === month);

  const visitorsToday = gaHealthy
    ? finite(ga4Data?.today?.activeUsers)
    : finite(traffic.visitorsToday);
  const activeUsersNow = gaHealthy
    ? finite(ga4Data?.realtime?.activeUsers)
    : finite(traffic.onlineNow);

  return {
    visitors_today: visitorsToday,
    active_users_now: activeUsersNow,
    leads_today: finite(leads.today),
    funding_requests_30d: finite(leads.fundingRequests30d),
    monthly_revenue: finite(monthlyRevenueRow?.value) ?? 0,
    pipeline_value: finite(executive.pipelineValue),
    conversion_rate: finite(leads.aggregateLeadConversionPct30d)
  };
}

function validateMetricKey(metricKey) {
  const value = String(metricKey || '').trim();
  if (!/^[a-z0-9_]{2,80}$/.test(value)) throw new Error('invalid metric_key');
  return value;
}

function validateDate(value, field) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(field + ' must be YYYY-MM-DD');
  const time = Date.parse(text + 'T00:00:00Z');
  if (!Number.isFinite(time)) throw new Error('invalid ' + field);
  return text;
}

function validateTargetInput(body = {}) {
  const metricKey = validateMetricKey(body.metric_key);
  const periodStart = validateDate(body.period_start, 'period_start');
  const periodEnd = validateDate(body.period_end, 'period_end');
  if (periodEnd < periodStart) throw new Error('period_end must be on or after period_start');
  const targetValue = finite(body.target_value);
  if (targetValue == null) throw new Error('target_value must be numeric');
  const comparison = String(body.comparison || '').trim();
  if (!TARGET_COMPARISONS.has(comparison)) throw new Error('invalid comparison');
  const scenario = String(body.scenario || '').trim();
  if (!TARGET_SCENARIOS.has(scenario)) throw new Error('invalid scenario');
  return {
    metric_key: metricKey,
    period_start: periodStart,
    period_end: periodEnd,
    target_value: targetValue,
    comparison,
    scenario,
    notes: body.notes == null ? null : String(body.notes).trim().slice(0, 1000)
  };
}

function validateAlertInput(body = {}) {
  const name = String(body.name || '').trim().slice(0, 160);
  if (!name) throw new Error('name required');
  const metricKey = validateMetricKey(body.metric_key);
  const operator = String(body.operator || '').trim();
  if (!ALERT_OPERATORS.has(operator)) throw new Error('invalid operator');
  const severity = String(body.severity || '').trim();
  if (!ALERT_SEVERITIES.has(severity)) throw new Error('invalid severity');
  const threshold = finite(body.threshold);
  if (threshold == null) throw new Error('threshold must be numeric');
  const cooldown = Math.trunc(Number(body.cooldown_minutes));
  if (!Number.isFinite(cooldown) || cooldown < 0 || cooldown > 43200) {
    throw new Error('cooldown_minutes must be between 0 and 43200');
  }
  return {
    name,
    metric_key: metricKey,
    operator,
    threshold,
    severity,
    cooldown_minutes: cooldown,
    enabled: body.enabled !== false,
    owner_role: body.owner_role == null ? null : String(body.owner_role).trim().slice(0, 80),
    escalation: body.escalation && typeof body.escalation === 'object' && !Array.isArray(body.escalation)
      ? body.escalation
      : {}
  };
}

async function loadCommandCenterGovernance(sb, metricSnapshot = {}) {
  const today = riyadhDate();
  const [definitionsRes, targetsRes, rulesRes] = await Promise.all([
    sb.from('analytics_metric_definitions')
      .select('metric_key,display_name_ar,display_name_en,description,unit,source_key,formula,owner_role,refresh_minutes,version,status')
      .eq('status', 'active')
      .order('metric_key', { ascending: true }),
    sb.from('analytics_targets')
      .select('id,metric_key,period_start,period_end,target_value,comparison,scenario,owner_user_id,notes,created_at')
      .lte('period_start', today)
      .gte('period_end', today)
      .order('period_start', { ascending: false }),
    sb.from('analytics_alert_rules')
      .select('id,name,metric_key,operator,threshold,severity,cooldown_minutes,enabled,owner_role,escalation,created_at,updated_at')
      .order('created_at', { ascending: false })
  ]);
  for (const result of [definitionsRes, targetsRes, rulesRes]) {
    if (result.error) throw result.error;
  }

  const definitions = definitionsRes.data || [];
  const targets = targetsRes.data || [];
  const baseTargets = targets.filter(row => row.scenario === 'base');
  const health = computeBusinessHealth(metricSnapshot, baseTargets);
  const snapshot = {
    ...metricSnapshot,
    business_health: health.score
  };
  const alertEvaluations = evaluateAlertRules(snapshot, rulesRes.data || []);

  return {
    success: true,
    capabilityStatus: {
      kpiGovernance: 'active',
      targetVsActual: 'active',
      alertThresholdEngine: 'active'
    },
    asOfDate: today,
    metrics: definitions.map(def => ({
      ...def,
      actual: Object.prototype.hasOwnProperty.call(snapshot, def.metric_key)
        ? snapshot[def.metric_key]
        : null
    })),
    targets,
    businessHealth: health,
    alertRules: rulesRes.data || [],
    alertEvaluations,
    generatedAt: new Date().toISOString()
  };
}

async function saveTarget(sb, body, userId) {
  const row = validateTargetInput(body);
  row.owner_user_id = userId || null;
  const { data, error } = await sb.from('analytics_targets')
    .upsert([row], { onConflict: 'metric_key,period_start,period_end,scenario' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTarget(sb, id) {
  const value = String(id || '').trim();
  if (!value) throw new Error('id required');
  const { data, error } = await sb.from('analytics_targets').delete().eq('id', value).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('target not found');
  return data;
}

async function saveAlertRule(sb, body) {
  const row = validateAlertInput(body);
  let query;
  if (body.id) {
    query = sb.from('analytics_alert_rules').update(row).eq('id', String(body.id)).select().single();
  } else {
    query = sb.from('analytics_alert_rules').insert([row]).select().single();
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function deleteAlertRule(sb, id) {
  const value = String(id || '').trim();
  if (!value) throw new Error('id required');
  const { data, error } = await sb.from('analytics_alert_rules').delete().eq('id', value).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('alert rule not found');
  return data;
}

module.exports = {
  riyadhDate,
  buildMetricSnapshot,
  validateTargetInput,
  validateAlertInput,
  loadCommandCenterGovernance,
  saveTarget,
  deleteTarget,
  saveAlertRule,
  deleteAlertRule
};
