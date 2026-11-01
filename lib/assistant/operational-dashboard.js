'use strict';

const { getAssistantEmergencyModeState } = require('./emergency-kill-switch');

const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 168;
const AUDIT_LIMIT = 1000;
const QUEUE_LIMIT = 500;
const ALERT_LIMIT = 500;

function boundedWindowHours(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_WINDOW_HOURS;
  return Math.min(MAX_WINDOW_HOURS, Math.max(1, n));
}

function countBy(rows, field, allowed = null) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row?.[field] ?? 'unknown');
    if (allowed && !allowed.includes(key)) continue;
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function sumKeys(counts, keys) {
  return keys.reduce((sum, key) => sum + Number(counts[key] || 0), 0);
}

function auditSummary(rows, limit) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const byEvent = countBy(safeRows, 'event_type');
  const terminal = sumKeys(byEvent, [
    'execution_succeeded',
    'execution_failed',
    'execution_denied'
  ]);
  const succeeded = Number(byEvent.execution_succeeded || 0);

  return {
    rows_examined: safeRows.length,
    truncated: safeRows.length >= limit,
    total_events: safeRows.length,
    execution_started: Number(byEvent.execution_started || 0),
    execution_succeeded: succeeded,
    execution_failed: Number(byEvent.execution_failed || 0),
    execution_denied: Number(byEvent.execution_denied || 0),
    denied_total: sumKeys(byEvent, ['denied','execution_denied','event_denied']),
    failed_total: sumKeys(byEvent, ['failed','execution_failed']),
    replay_total: sumKeys(byEvent, ['replayed','event_replayed']),
    write_uncertain: Number(byEvent.write_uncertain || 0),
    success_rate: terminal > 0 ? Number((succeeded / terminal).toFixed(4)) : null,
    last_event_at: safeRows[0]?.created_at || null
  };
}

const OUTCOME_EVENT_MAP = Object.freeze({
  execution_succeeded:'succeeded',
  write_succeeded:'succeeded',
  execution_failed:'failed',
  failed:'failed',
  execution_denied:'denied',
  denied:'denied',
  write_uncertain:'uncertain',
  replayed:'replayed',
  event_replayed:'replayed'
});

function outcomeAnalytics(rows, limit) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const distinctActions = new Map();
  const latestTerminalByAction = new Map();

  for (const row of safeRows) {
    const actionId = String(row?.action_id || '').trim();
    if (!actionId) continue;
    if (!distinctActions.has(actionId)) {
      distinctActions.set(actionId, {
        action_type:String(row?.action_type || 'unknown').slice(0,100)
      });
    }

    const normalized = OUTCOME_EVENT_MAP[String(row?.event_type || '')];
    if (!normalized || latestTerminalByAction.has(actionId)) continue;
    latestTerminalByAction.set(actionId, {
      outcome:normalized,
      action_type:String(row?.action_type || 'unknown').slice(0,100),
      created_at:row?.created_at || null
    });
  }

  const counts = { succeeded:0, failed:0, denied:0, uncertain:0, replayed:0 };
  const byType = new Map();

  for (const terminal of latestTerminalByAction.values()) {
    counts[terminal.outcome] = Number(counts[terminal.outcome] || 0) + 1;
    const type = terminal.action_type || 'unknown';
    const bucket = byType.get(type) || {
      action_type:type,
      measured_actions:0,
      succeeded:0,
      failed:0,
      denied:0,
      uncertain:0,
      replayed:0
    };
    bucket.measured_actions += 1;
    bucket[terminal.outcome] += 1;
    byType.set(type, bucket);
  }

  const measured = latestTerminalByAction.size;
  const totalActions = distinctActions.size;
  const actionTypes = [...byType.values()]
    .map(item => ({
      ...item,
      success_rate:item.measured_actions > 0
        ? Number((item.succeeded / item.measured_actions).toFixed(4))
        : null
    }))
    .sort((a,b) => b.measured_actions - a.measured_actions || a.action_type.localeCompare(b.action_type))
    .slice(0,25);

  return {
    status:measured > 0 ? 'measured' : 'unknown',
    rows_examined:safeRows.length,
    truncated:safeRows.length >= limit,
    distinct_actions:totalActions,
    measured_actions:measured,
    unmeasured_actions:Math.max(0,totalActions-measured),
    outcome_coverage:totalActions > 0 ? Number((measured/totalActions).toFixed(4)) : null,
    succeeded:counts.succeeded,
    failed:counts.failed,
    denied:counts.denied,
    uncertain:counts.uncertain,
    replayed:counts.replayed,
    success_rate:measured > 0 ? Number((counts.succeeded/measured).toFixed(4)) : null,
    by_action_type:actionTypes,
    methodology:'latest_terminal_audit_event_per_action',
    note:measured > 0
      ? 'Outcome Analytics is derived from immutable Assistant audit evidence only.'
      : 'UNKNOWN: no terminal Assistant action outcome exists in the selected window.'
  };
}

function agentInboxSummary(rows, limit) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const byStatus = countBy(safeRows, 'status', ['open','assigned','in_review','waiting_user']);
  const byPriority = countBy(safeRows, 'priority', ['low','medium','high','critical']);
  return {
    active_total: safeRows.length,
    by_status: byStatus,
    high_priority: Number(byPriority.high || 0),
    critical_priority: Number(byPriority.critical || 0),
    truncated: safeRows.length >= limit
  };
}

function approvalsSummary(rows, limit) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const byRisk = countBy(safeRows, 'risk', ['high','critical']);
  return {
    pending_total: safeRows.length,
    high_risk: Number(byRisk.high || 0),
    critical_risk: Number(byRisk.critical || 0),
    truncated: safeRows.length >= limit
  };
}

function anomalyAlertSummary(rows, limit) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const bySeverity = countBy(safeRows, 'severity', ['info','warning','high','critical']);
  const byStatus = countBy(safeRows, 'status', ['open','acknowledged']);
  return {
    active_total: safeRows.length,
    by_severity: bySeverity,
    by_status: byStatus,
    truncated: safeRows.length >= limit
  };
}

async function loadRows(query, errorCode) {
  const { data, error } = await query;
  if (error) throw new Error(errorCode);
  return Array.isArray(data) ? data : [];
}

async function buildAssistantOperationalDashboard({
  supabase,
  windowHours = DEFAULT_WINDOW_HOURS,
  nowMs = Date.now()
} = {}) {
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('ASSISTANT_OPERATIONAL_DASHBOARD_DATABASE_REQUIRED');
  }

  const hours = boundedWindowHours(windowHours);
  const cutoff = new Date(nowMs - hours * 60 * 60 * 1000).toISOString();

  const auditQuery = supabase
    .from('assistant_action_audit')
    .select('action_id,action_type,event_type,risk,requires_confirmation,created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending:false })
    .limit(AUDIT_LIMIT);

  const inboxQuery = supabase
    .from('assistant_agent_inbox')
    .select('status,priority,created_at')
    .in('status', ['open','assigned','in_review','waiting_user'])
    .order('created_at', { ascending:false })
    .limit(QUEUE_LIMIT);

  const approvalsQuery = supabase
    .from('admin_approval_requests')
    .select('status,risk,created_at')
    .eq('permission', 'assistant.human_approval')
    .eq('status', 'pending')
    .order('created_at', { ascending:false })
    .limit(QUEUE_LIMIT);

  const alertsQuery = supabase
    .from('admin_alerts')
    .select('severity,status,created_at')
    .eq('category', 'assistant_anomaly')
    .in('status', ['open','acknowledged'])
    .order('created_at', { ascending:false })
    .limit(ALERT_LIMIT);

  const [auditRows,inboxRows,approvalRows,alertRows,emergencyMode] = await Promise.all([
    loadRows(auditQuery, 'ASSISTANT_OPERATIONAL_AUDIT_READ_FAILED'),
    loadRows(inboxQuery, 'ASSISTANT_OPERATIONAL_INBOX_READ_FAILED'),
    loadRows(approvalsQuery, 'ASSISTANT_OPERATIONAL_APPROVALS_READ_FAILED'),
    loadRows(alertsQuery, 'ASSISTANT_OPERATIONAL_ALERTS_READ_FAILED'),
    getAssistantEmergencyModeState({ supabase, nowMs })
  ]);

  return {
    version:1,
    generated_at:new Date(nowMs).toISOString(),
    window_hours:hours,
    activity:auditSummary(auditRows, AUDIT_LIMIT),
    outcomes:outcomeAnalytics(auditRows, AUDIT_LIMIT),
    queues:{
      agent_inbox:agentInboxSummary(inboxRows, QUEUE_LIMIT),
      human_approvals:approvalsSummary(approvalRows, QUEUE_LIMIT)
    },
    safety:{
      anomaly_alerts:anomalyAlertSummary(alertRows, ALERT_LIMIT),
      emergency_mode:{
        feature:emergencyMode?.feature || null,
        disabled:emergencyMode?.disabled === true,
        mode:emergencyMode?.mode || 'unknown',
        expires_at:emergencyMode?.expires_at || null
      }
    },
    shadow_authorization:{
      telemetry_persistence:'response_only',
      drift_metric_available:false,
      note_code:'SHADOW_AUTHORIZATION_TELEMETRY_NOT_PERSISTED'
    },
    policy:{
      read_only:true,
      raw_user_identifiers:false,
      raw_audit_metadata:false,
      internal_kill_switch_reason:false,
      secrets_exposed:false,
      execution_authorized:false,
      auto_execute:false
    }
  };
}

module.exports = {
  DEFAULT_WINDOW_HOURS,
  MAX_WINDOW_HOURS,
  AUDIT_LIMIT,
  QUEUE_LIMIT,
  ALERT_LIMIT,
  boundedWindowHours,
  auditSummary,
  outcomeAnalytics,
  agentInboxSummary,
  approvalsSummary,
  anomalyAlertSummary,
  buildAssistantOperationalDashboard
};
