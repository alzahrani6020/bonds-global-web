'use strict';

const { sanitizeAssistantState } = require('./context-state');
const { listOwnedDrafts } = require('./draft-center');
const { listAssistantNotifications } = require('./notification-store');
const { listUserHumanEscalations } = require('./human-escalation');

const AGENT_INBOX_VERSION = 1;
const ACTIVE_WORKFLOW_STATUSES = Object.freeze(['active','paused']);
const PRIORITY_RANK = Object.freeze({ critical:4, high:3, medium:2, low:1 });

function cleanString(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function workflowInboxItems(row) {
  if (!row || typeof row !== 'object') return [];
  const workflowKey = cleanString(row.workflow_key, 160);
  const boundary = cleanString(row.boundary, 500);
  if (!workflowKey || !boundary) return [];

  const state = sanitizeAssistantState(row.state, { expectedBoundary:boundary });
  if (!state) return [];

  const base = {
    workflow_key:workflowKey,
    boundary,
    workflow_status:ACTIVE_WORKFLOW_STATUSES.includes(row.status) ? row.status : 'active',
    workflow_version:Number.isFinite(Number(row.version)) ? Number(row.version) : null,
    goal:state.goal,
    current_stage:state.current_stage,
    updated_at:row.updated_at || state.updated_at || row.created_at || null,
    waiting_on_user:true,
    execution_authorized:false
  };

  const items = [];
  if (state.pending_confirmation && Object.keys(state.pending_confirmation).length > 0) {
    items.push({
      id:`workflow:${workflowKey}:confirmation`,
      type:'confirmation',
      priority:'high',
      label_ar:'يوجد إجراء ينتظر تأكيدك',
      label_en:'An action is waiting for your confirmation',
      ...base
    });
  }

  state.required_data.forEach((label,index) => {
    items.push({
      id:`workflow:${workflowKey}:required_data:${index}`,
      type:'required_data',
      priority:'high',
      label,
      ...base
    });
  });

  state.open_tasks.forEach((label,index) => {
    items.push({
      id:`workflow:${workflowKey}:open_task:${index}`,
      type:'open_task',
      priority:'medium',
      label,
      ...base
    });
  });

  return items;
}

async function listWorkflowInboxItems({ supabase, userId, limit = 50 }) {
  if (!supabase || typeof supabase.from !== 'function') throw new Error('AGENT_INBOX_UNAVAILABLE');
  if (!userId) throw new Error('AGENT_INBOX_USER_REQUIRED');

  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 50;
  const { data, error } = await supabase
    .from('assistant_workflow_state')
    .select('workflow_key,boundary,status,version,state,created_at,updated_at')
    .eq('user_id', userId)
    .in('status', ACTIVE_WORKFLOW_STATUSES)
    .order('updated_at', { ascending:false })
    .limit(safeLimit);

  if (error) throw new Error('AGENT_INBOX_WORKFLOW_SOURCE_FAILED');

  return (Array.isArray(data) ? data : []).flatMap(workflowInboxItems);
}

function draftInboxItems(draftCenter) {
  return (draftCenter?.drafts || []).map(draft => ({
    id:`draft:${draft.form_code}:${draft.id || 'unknown'}`,
    type:'draft',
    priority:'medium',
    form_code:draft.form_code,
    record_id:draft.id,
    status:draft.status,
    client_id:draft.client_id,
    funding_case_id:draft.funding_case_id,
    navigation_target:draft.navigation_target,
    updated_at:draft.updated_at,
    waiting_on_user:true,
    execution_authorized:false
  }));
}

function unreadNotificationSignals(notifications) {
  return (notifications || []).filter(item => !item.read).map(item => ({
    id:item.id,
    priority:item.priority,
    event_type:item.event_type,
    workflow_key:item.workflow_key,
    boundary:item.boundary,
    resource_id:item.resource_id,
    title_ar:item.title_ar,
    title_en:item.title_en,
    created_at:item.created_at,
    action:item.action
      ? {
          type:cleanString(item.action.type, 100),
          target:cleanString(item.action.target, 160),
          execution_authorized:false
        }
      : null,
    informational_only:true,
    execution_authorized:false
  }));
}

function humanEscalationInboxItems(escalations) {
  return (escalations || []).map(item => ({
    id:`human-escalation:${item.id || item.workflow_key || 'unknown'}`,
    type:'human_escalation',
    priority:item.priority || 'high',
    workflow_key:item.workflow_key,
    boundary:item.boundary,
    reason_code:item.reason_code,
    status:item.status,
    label_ar:item.title_ar || 'طلب مراجعة بشرية',
    label_en:item.title_en || 'Human review requested',
    summary:item.summary_ar || null,
    updated_at:item.updated_at || item.created_at || null,
    waiting_on_user:false,
    waiting_on_human:true,
    execution_authorized:false
  }));
}

function sortInboxItems(items) {
  return [...items].sort((a,b) => {
    const priority = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
    if (priority !== 0) return priority;
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  });
}

async function buildAgentInbox({
  supabase,
  userId,
  workflowLimit = 50,
  draftLimitPerSource = 10,
  notificationLimit = 25
}) {
  if (!userId) throw new Error('AGENT_INBOX_USER_REQUIRED');
  if (!supabase || typeof supabase.from !== 'function') throw new Error('AGENT_INBOX_UNAVAILABLE');

  const sourceStatus = [];
  let items = [];
  let notificationSignals = [];

  try {
    items.push(...await listWorkflowInboxItems({
      supabase,
      userId,
      limit:workflowLimit
    }));
    sourceStatus.push({ source:'workflows', status:'ok' });
  } catch (err) {
    sourceStatus.push({ source:'workflows', status:'unavailable', error:err.message });
  }

  try {
    const drafts = await listOwnedDrafts({
      supabase,
      userId,
      limitPerSource:draftLimitPerSource
    });
    items.push(...draftInboxItems(drafts));
    sourceStatus.push({
      source:'drafts',
      status:drafts.partial ? 'partial' : 'ok'
    });
  } catch (err) {
    sourceStatus.push({ source:'drafts', status:'unavailable', error:err.message });
  }

  try {
    const notifications = await listAssistantNotifications({
      supabase,
      userId,
      unreadOnly:true,
      limit:notificationLimit
    });
    notificationSignals = unreadNotificationSignals(notifications);
    sourceStatus.push({ source:'notifications', status:'ok' });
  } catch (err) {
    sourceStatus.push({ source:'notifications', status:'unavailable', error:err.message });
  }

  try {
    const escalations = await listUserHumanEscalations({
      supabase,
      userId,
      activeOnly:true,
      limit:workflowLimit
    });
    items.push(...humanEscalationInboxItems(escalations));
    sourceStatus.push({ source:'human_escalations', status:'ok' });
  } catch (err) {
    sourceStatus.push({ source:'human_escalations', status:'unavailable', error:err.message });
  }

  items = sortInboxItems(items);
  const counts = items.reduce((out,item) => {
    out[item.type] = (out[item.type] || 0) + 1;
    return out;
  }, {});

  return {
    version:AGENT_INBOX_VERSION,
    items,
    counts,
    unread_notifications:notificationSignals,
    unread_notification_count:notificationSignals.length,
    partial:sourceStatus.some(item => item.status !== 'ok'),
    source_status:sourceStatus,
    policy:{
      read_only:true,
      write_allowed:false,
      submit_allowed:false,
      auto_execute:false,
      execution_authorized:false
    }
  };
}

module.exports = {
  AGENT_INBOX_VERSION,
  ACTIVE_WORKFLOW_STATUSES,
  workflowInboxItems,
  listWorkflowInboxItems,
  draftInboxItems,
  unreadNotificationSignals,
  humanEscalationInboxItems,
  buildAgentInbox
};
