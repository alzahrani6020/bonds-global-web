'use strict';

const crypto = require('crypto');
const { loadWorkflowState } = require('./workflow-state');
const { enqueueAgentInboxItem } = require('./agent-inbox-queue');

const HUMAN_ESCALATION_VERSION = 1;
const HUMAN_ESCALATION_REASONS = Object.freeze([
  'user_requested',
  'assistant_blocked',
  'needs_expert_review',
  'sensitive_action_review',
  'data_conflict',
  'unsupported_request'
]);
const HUMAN_ESCALATION_PRIORITIES = Object.freeze(['medium','high','critical']);
const ACTIVE_ESCALATION_STATUSES = Object.freeze(['open','assigned','in_review','waiting_user']);

function clean(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function normalizeIdempotencyKey(value) {
  const key = clean(value, 160);
  if (!key || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(key)) {
    throw new Error('HUMAN_ESCALATION_IDEMPOTENCY_KEY_INVALID');
  }
  return key;
}

function normalizeReason(value) {
  const reason = clean(value, 100);
  if (!reason || !HUMAN_ESCALATION_REASONS.includes(reason)) {
    throw new Error('HUMAN_ESCALATION_REASON_INVALID');
  }
  return reason;
}

function normalizePriority(value) {
  const priority = clean(value, 30) || 'high';
  if (!HUMAN_ESCALATION_PRIORITIES.includes(priority)) {
    throw new Error('HUMAN_ESCALATION_PRIORITY_INVALID');
  }
  return priority;
}

function escalationItemKey({ userId, workflowKey, idempotencyKey }) {
  const digest = crypto
    .createHash('sha256')
    .update([userId, workflowKey, idempotencyKey].join('|'))
    .digest('hex')
    .slice(0, 40);
  return `human-escalation:${digest}`;
}

function publicEscalation(row, replayed = false) {
  if (!row) return null;
  return {
    id:row.id || null,
    workflow_key:clean(row.workflow_key, 160),
    boundary:clean(row.boundary, 500),
    reason_code:clean(row.reason_code, 100),
    priority:clean(row.priority, 30),
    status:clean(row.status, 40),
    title_ar:clean(row.title_ar, 300),
    title_en:clean(row.title_en, 300),
    summary_ar:clean(row.summary_ar, 500),
    created_at:row.created_at || null,
    updated_at:row.updated_at || null,
    waiting_on_human:ACTIVE_ESCALATION_STATUSES.includes(row.status),
    replayed:Boolean(replayed),
    execution_authorized:false,
    auto_execute:false
  };
}

async function findEscalationByKey({ supabase, itemKey, userId }) {
  const { data, error } = await supabase
    .from('assistant_agent_inbox')
    .select('id,item_key,user_id,workflow_key,boundary,reason_code,title_ar,title_en,summary_ar,priority,status,created_at,updated_at')
    .eq('item_key', itemKey)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('HUMAN_ESCALATION_LOOKUP_FAILED');
  return data || null;
}

async function createHumanEscalation({
  supabase,
  userId,
  workflowKey,
  boundary,
  expectedVersion,
  reasonCode,
  summary,
  priority = 'high',
  idempotencyKey
}) {
  if (!supabase || typeof supabase.from !== 'function' || typeof supabase.rpc !== 'function') {
    throw new Error('HUMAN_ESCALATION_UNAVAILABLE');
  }
  if (!userId) throw new Error('HUMAN_ESCALATION_USER_REQUIRED');

  const cleanBoundary = clean(boundary, 500);
  if (!cleanBoundary) throw new Error('HUMAN_ESCALATION_BOUNDARY_REQUIRED');
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error('HUMAN_ESCALATION_VERSION_REQUIRED');
  }

  const reason = normalizeReason(reasonCode);
  const safePriority = normalizePriority(priority);
  const key = normalizeIdempotencyKey(idempotencyKey);
  const workflow = await loadWorkflowState({ supabase, userId, workflowKey });

  if (!workflow) throw new Error('WORKFLOW_NOT_FOUND');
  if (workflow.boundary !== cleanBoundary) throw new Error('HUMAN_ESCALATION_BOUNDARY_CONFLICT');
  if (workflow.version !== expectedVersion) throw new Error('WORKFLOW_VERSION_CONFLICT');
  if (!['active','paused'].includes(workflow.status)) {
    throw new Error('HUMAN_ESCALATION_WORKFLOW_STATUS_BLOCKED');
  }

  const itemKey = escalationItemKey({
    userId,
    workflowKey:workflow.workflow_key,
    idempotencyKey:key
  });

  const existing = await findEscalationByKey({ supabase, itemKey, userId });
  if (existing) {
    return {
      version:HUMAN_ESCALATION_VERSION,
      escalation:publicEscalation(existing, true),
      queued:false,
      replayed:true,
      authorization:{ granted:false, source:'human_review_only' },
      execution_triggered:false
    };
  }

  const safeSummary = clean(summary, 500);
  const item = {
    item_key:itemKey,
    source_type:'workflow',
    source_event_id:null,
    event_type:'human_escalation_requested',
    user_id:userId,
    workflow_key:workflow.workflow_key,
    boundary:workflow.boundary,
    resource_id:null,
    reason_code:`human_escalation_${reason}`,
    title_ar:'طلب مراجعة بشرية',
    title_en:'Human review requested',
    summary_ar:safeSummary,
    summary_en:null,
    priority:safePriority,
    metadata:{
      origin:'assistant_human_escalation',
      workflow_version:workflow.version,
      requested_reason:reason
    }
  };

  const queued = await enqueueAgentInboxItem({ supabase, item });
  const persisted = await findEscalationByKey({ supabase, itemKey, userId });
  if (!persisted) throw new Error('HUMAN_ESCALATION_ENQUEUE_FAILED');

  return {
    version:HUMAN_ESCALATION_VERSION,
    escalation:publicEscalation(persisted, !queued.queued),
    queued:Boolean(queued.queued),
    replayed:!queued.queued,
    authorization:{ granted:false, source:'human_review_only' },
    execution_triggered:false
  };
}

async function listUserHumanEscalations({ supabase, userId, activeOnly = false, limit = 25 }) {
  if (!supabase || typeof supabase.from !== 'function') throw new Error('HUMAN_ESCALATION_UNAVAILABLE');
  if (!userId) throw new Error('HUMAN_ESCALATION_USER_REQUIRED');

  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
  let query = supabase
    .from('assistant_agent_inbox')
    .select('id,user_id,workflow_key,boundary,reason_code,title_ar,title_en,summary_ar,priority,status,created_at,updated_at')
    .eq('user_id', userId)
    .eq('source_type', 'workflow')
    .like('reason_code', 'human_escalation_%')
    .order('created_at', { ascending:false })
    .limit(safeLimit);

  if (activeOnly) query = query.in('status', ACTIVE_ESCALATION_STATUSES);

  const { data, error } = await query;
  if (error) throw new Error('HUMAN_ESCALATION_LIST_FAILED');

  return (data || []).map(row => publicEscalation(row, false));
}

module.exports = {
  HUMAN_ESCALATION_VERSION,
  HUMAN_ESCALATION_REASONS,
  HUMAN_ESCALATION_PRIORITIES,
  ACTIVE_ESCALATION_STATUSES,
  normalizeIdempotencyKey,
  normalizeReason,
  normalizePriority,
  escalationItemKey,
  publicEscalation,
  createHumanEscalation,
  listUserHumanEscalations
};
