'use strict';

const { hasForbiddenField } = require('./protocol');
const { sanitizeAssistantState } = require('./context-state');
const { loadWorkflowState, saveWorkflowState } = require('./workflow-state');
const { notificationsFromAssistantEvent } = require('./notification-engine');

const ASSISTANT_EVENT_VERSION = 1;
const ALLOWED_EVENT_TYPES = new Set([
  'form_saved',
  'document_uploaded',
  'document_analyzed',
  'funding_case_status_changed',
  'page_changed',
  'workflow_resumed'
]);

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanScalarObject(value, maxEntries = 30) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, maxEntries)) {
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(key)) continue;
    if (item === null || ['string','number','boolean'].includes(typeof item)) {
      out[key] = typeof item === 'string' ? item.slice(0, 500) : item;
    }
  }
  return out;
}

function normalizeAssistantEvent(value, { expectedBoundary = null } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_ASSISTANT_EVENT');
  }
  if (hasForbiddenField(value)) throw new Error('FORBIDDEN_EVENT_FIELD');

  const type = cleanString(value.type, 100);
  if (!type || !ALLOWED_EVENT_TYPES.has(type)) throw new Error('ASSISTANT_EVENT_NOT_ALLOWED');

  const boundary = cleanString(value.boundary, 500);
  if (!boundary) throw new Error('ASSISTANT_EVENT_BOUNDARY_REQUIRED');
  if (expectedBoundary && boundary !== expectedBoundary) {
    throw new Error('ASSISTANT_EVENT_BOUNDARY_CONFLICT');
  }

  return {
    version:ASSISTANT_EVENT_VERSION,
    id:cleanString(value.id, 160),
    type,
    boundary,
    resource_id:cleanString(value.resource_id, 160),
    source:cleanString(value.source, 100) || 'system',
    occurred_at:cleanString(value.occurred_at, 100) || null,
    data:cleanScalarObject(value.data)
  };
}

function uniqueList(items, max = 50) {
  const out = [];
  const seen = new Set();
  for (const value of items || []) {
    const item = cleanString(value, 300);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function deriveEventPatch(event, state) {
  const current = state || {};
  const openTasks = Array.isArray(current.open_tasks) ? current.open_tasks : [];
  const requiredData = Array.isArray(current.required_data) ? current.required_data : [];
  const patch = {
    current_stage:current.current_stage || null,
    open_tasks:openTasks,
    required_data:requiredData,
    last_action:{
      type:'assistant_event',
      event_type:event.type,
      resource_id:event.resource_id || ''
    }
  };
  const suggestions = [];

  switch (event.type) {
    case 'form_saved':
      patch.current_stage = 'form_saved';
      patch.open_tasks = uniqueList(openTasks.filter(item => item !== 'save_form_draft'));
      suggestions.push({
        type:'funding_next_step',
        reason:'form_saved_recheck_next_step',
        execution_authorized:false
      });
      break;

    case 'document_uploaded':
      patch.current_stage = 'document_uploaded';
      patch.open_tasks = uniqueList([...openTasks, 'analyze_uploaded_document']);
      suggestions.push({
        type:'document_find',
        reason:'document_uploaded_ready_for_analysis',
        execution_authorized:false
      });
      break;

    case 'document_analyzed':
      patch.current_stage = 'document_analyzed';
      patch.open_tasks = uniqueList(openTasks.filter(item => item !== 'analyze_uploaded_document'));
      suggestions.push({
        type:'document_find',
        reason:'document_analysis_ready_for_review',
        execution_authorized:false
      });
      break;

    case 'funding_case_status_changed':
      patch.current_stage = cleanString(event.data.status, 100) || 'funding_status_changed';
      suggestions.push({
        type:'funding_next_step',
        reason:'funding_case_status_changed',
        execution_authorized:false
      });
      break;

    case 'page_changed':
      patch.current_stage = current.current_stage || 'browsing';
      break;

    case 'workflow_resumed':
      patch.current_stage = current.current_stage || 'resumed';
      suggestions.push({
        type:'funding_next_step',
        reason:'workflow_resumed',
        execution_authorized:false
      });
      break;
  }

  return {
    patch,
    suggestions,
    authorization:{
      granted:false,
      source:'event_context_only'
    }
  };
}

function mergeAssistantState(current, event, derived) {
  const merged = {
    ...(current || {}),
    boundary:event.boundary,
    current_stage:derived.patch.current_stage,
    open_tasks:derived.patch.open_tasks,
    required_data:derived.patch.required_data,
    last_action:derived.patch.last_action,
    updated_at:new Date().toISOString()
  };
  return sanitizeAssistantState(merged, { expectedBoundary:event.boundary });
}

async function applyAssistantEvent({
  supabase,
  userId,
  workflowKey,
  event,
  expectedVersion
}) {
  if (!userId) throw new Error('WORKFLOW_USER_REQUIRED');

  const workflow = await loadWorkflowState({ supabase, userId, workflowKey });
  if (!workflow) throw new Error('WORKFLOW_NOT_FOUND');
  if (workflow.status !== 'active' && workflow.status !== 'paused') {
    throw new Error('WORKFLOW_EVENT_STATUS_BLOCKED');
  }

  const normalized = normalizeAssistantEvent(event, {
    expectedBoundary:workflow.boundary
  });
  const derived = deriveEventPatch(normalized, workflow.state);
  const nextState = mergeAssistantState(workflow.state, normalized, derived);
  if (!nextState) throw new Error('WORKFLOW_STATE_INVALID');

  const version = expectedVersion === undefined || expectedVersion === null
    ? workflow.version
    : expectedVersion;

  const saved = await saveWorkflowState({
    supabase,
    userId,
    workflowKey,
    boundary:workflow.boundary,
    state:nextState,
    status:workflow.status,
    expectedVersion:version
  });

  const notifications = notificationsFromAssistantEvent({
    event:normalized,
    workflow:saved,
    suggestions:derived.suggestions
  });

  return {
    event:normalized,
    workflow:saved,
    suggestions:derived.suggestions,
    notifications,
    authorization:derived.authorization,
    execution_triggered:false
  };
}

module.exports = {
  ASSISTANT_EVENT_VERSION,
  ALLOWED_EVENT_TYPES,
  normalizeAssistantEvent,
  deriveEventPatch,
  mergeAssistantState,
  applyAssistantEvent
};
