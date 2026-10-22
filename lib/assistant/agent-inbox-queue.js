'use strict';

const AGENT_INBOX_VERSION = 1;
const ACTIVE_STATUSES = Object.freeze(['open','assigned','in_review','waiting_user']);
const ALL_STATUSES = Object.freeze([...ACTIVE_STATUSES,'resolved','dismissed']);
const REVIEW_STATUS_SET = new Set(['review_required','conflict','unsupported','on_hold','declined','additional_information_required']);

function clean(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function deriveAgentInboxItem({ event, workflow, userId }) {
  if (!event || !event.id || !event.type) return null;

  const data = event.data || {};
  let reasonCode = null;
  let priority = 'high';
  let titleAr = null;
  let titleEn = null;

  if (event.type === 'document_analyzed') {
    const verificationState = clean(data.verification_state, 100);
    if (bool(data.review_required) || bool(data.conflict) || REVIEW_STATUS_SET.has(verificationState)) {
      reasonCode = bool(data.conflict) || verificationState === 'conflict'
        ? 'document_conflict'
        : 'document_review_required';
      priority = reasonCode === 'document_conflict' ? 'critical' : 'high';
      titleAr = reasonCode === 'document_conflict'
        ? 'تعارض في مستند يحتاج مراجعة'
        : 'مستند يحتاج مراجعة بشرية';
      titleEn = reasonCode === 'document_conflict'
        ? 'Document conflict requires review'
        : 'Document requires human review';
    }
  }

  if (event.type === 'funding_case_status_changed') {
    const status = clean(data.status, 100);
    if (bool(data.human_review_required) || REVIEW_STATUS_SET.has(status)) {
      reasonCode = 'funding_case_review_required';
      priority = status === 'declined' ? 'critical' : 'high';
      titleAr = 'طلب تمويل يحتاج متابعة بشرية';
      titleEn = 'Funding case requires human follow-up';
    }
  }

  if (!reasonCode) return null;

  const workflowKey = clean(workflow?.workflow_key, 160);
  const boundary = clean(event.boundary || workflow?.boundary, 500);
  const resourceId = clean(event.resource_id, 160);
  if (!resourceId) return null;
  const summary = clean(data.reason || data.message || data.note, 500);

  return {
    item_key:`review:${workflowKey || 'no-workflow'}:${reasonCode}:${resourceId || 'no-resource'}`,
    source_type:'assistant_event',
    source_event_id:clean(event.id, 160),
    event_type:clean(event.type, 100),
    user_id:userId || null,
    workflow_key:workflowKey,
    boundary,
    resource_id:resourceId,
    reason_code:reasonCode,
    title_ar:titleAr,
    title_en:titleEn,
    summary_ar:summary,
    summary_en:null,
    priority,
    metadata:{
      event_source:clean(event.source, 100),
      event_occurred_at:clean(event.occurred_at, 100),
      workflow_version:workflow?.version ?? null
    }
  };
}


async function verifyAgentInboxItemOwnership({ supabase, userId, event, item }) {
  if (!item || !userId || !event?.resource_id) return false;

  if (event.type === 'document_analyzed') {
    const { data, error } = await supabase
      .from('client_documents')
      .select('id,advisory_clients!inner(auth_user_id)')
      .eq('id', event.resource_id)
      .eq('advisory_clients.auth_user_id', userId)
      .maybeSingle();
    if (error) throw new Error('AGENT_INBOX_SOURCE_VERIFY_FAILED');
    return Boolean(data);
  }

  if (event.type === 'funding_case_status_changed') {
    const { data, error } = await supabase
      .from('funding_cases')
      .select('id,user_id')
      .eq('id', event.resource_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('AGENT_INBOX_SOURCE_VERIFY_FAILED');
    return Boolean(data);
  }

  return false;
}

async function enqueueAgentInboxItem({ supabase, item }) {
  if (!item) return { queued:false, skipped:true };
  const { data, error } = await supabase
    .from('assistant_agent_inbox')
    .upsert(item, { onConflict:'item_key', ignoreDuplicates:true })
    .select('id,item_key,status,priority')
    .maybeSingle();

  if (error) throw new Error('AGENT_INBOX_ENQUEUE_FAILED');
  return {
    queued:Boolean(data),
    skipped:!data,
    item:data || null
  };
}

function sanitizeFilter(value, allowed) {
  const text = clean(value, 100);
  return text && allowed.includes(text) ? text : null;
}

async function listAgentInbox({
  supabase,
  status = null,
  priority = null,
  assignedTo = null,
  limit = 50
}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  let query = supabase
    .from('assistant_agent_inbox')
    .select('id,item_key,source_type,source_event_id,event_type,user_id,workflow_key,boundary,resource_id,reason_code,title_ar,title_en,summary_ar,summary_en,priority,status,assigned_to,assigned_by,assigned_at,resolved_by,resolved_at,resolution_note,metadata,created_at,updated_at')
    .order('created_at', { ascending:false })
    .limit(safeLimit);

  const safeStatus = sanitizeFilter(status, ALL_STATUSES);
  const safePriority = sanitizeFilter(priority, ['low','medium','high','critical']);
  if (safeStatus) query = query.eq('status', safeStatus);
  else query = query.in('status', ACTIVE_STATUSES);
  if (safePriority) query = query.eq('priority', safePriority);
  if (assignedTo) query = query.eq('assigned_to', assignedTo);

  const { data, error } = await query;
  if (error) throw new Error('AGENT_INBOX_LIST_FAILED');

  return {
    version:AGENT_INBOX_VERSION,
    items:data || [],
    policy:{
      employee_only:true,
      auto_execute:false,
      execution_authorized:false
    }
  };
}

async function updateAgentInboxItem({
  supabase,
  itemId,
  actorUserId,
  assignedTo,
  status,
  resolutionNote
}) {
  const id = clean(itemId, 100);
  if (!id) throw new Error('AGENT_INBOX_ITEM_REQUIRED');

  const patch = { updated_at:new Date().toISOString() };

  if (assignedTo !== undefined) {
    if (assignedTo) {
      const { data:assignee, error:assigneeError } = await supabase
        .from('admin_roles')
        .select('user_id,role')
        .eq('user_id', assignedTo)
        .in('role', ['super_admin','admin','support'])
        .maybeSingle();
      if (assigneeError || !assignee) throw new Error('AGENT_INBOX_ASSIGNEE_INVALID');
    }
    patch.assigned_to = assignedTo || null;
    patch.assigned_by = actorUserId || null;
    patch.assigned_at = assignedTo ? new Date().toISOString() : null;
    if (assignedTo && !status) patch.status = 'assigned';
  }

  if (status !== undefined) {
    const safeStatus = sanitizeFilter(status, ALL_STATUSES);
    if (!safeStatus) throw new Error('AGENT_INBOX_STATUS_INVALID');
    patch.status = safeStatus;
    if (['resolved','dismissed'].includes(safeStatus)) {
      patch.resolved_by = actorUserId || null;
      patch.resolved_at = new Date().toISOString();
      patch.resolution_note = clean(resolutionNote, 1000);
    } else {
      patch.resolved_by = null;
      patch.resolved_at = null;
      patch.resolution_note = null;
    }
  }

  const { data, error } = await supabase
    .from('assistant_agent_inbox')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error('AGENT_INBOX_UPDATE_FAILED');
  if (!data) throw new Error('AGENT_INBOX_NOT_FOUND');
  return data;
}

async function listAgentAssignees({ supabase }) {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('user_id,role')
    .in('role', ['super_admin','admin','support'])
    .order('role');

  if (error) throw new Error('AGENT_INBOX_ASSIGNEES_FAILED');
  return (data || []).map(row => ({
    user_id:row.user_id,
    role:row.role
  }));
}

module.exports = {
  AGENT_INBOX_VERSION,
  ACTIVE_STATUSES,
  ALL_STATUSES,
  deriveAgentInboxItem,
  verifyAgentInboxItemOwnership,
  enqueueAgentInboxItem,
  listAgentInbox,
  updateAgentInboxItem,
  listAgentAssignees
};
