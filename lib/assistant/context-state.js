'use strict';

const ASSISTANT_STATE_VERSION = 1;
const MAX_LIST_ITEMS = 50;
const MAX_FACTS = 100;

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim().slice(0, 300))
    .slice(0, MAX_LIST_ITEMS);
}

function cleanScalarObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.entries(value).slice(0, MAX_FACTS).forEach(([key, item]) => {
    const cleanKey = cleanString(key, 100);
    if (!cleanKey) return;
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) {
      out[cleanKey] = typeof item === 'string' ? item.slice(0, 500) : item;
    }
  });
  return out;
}

function sanitizeAssistantState(value, { expectedBoundary = null } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const boundary = cleanString(value.boundary, 500);
  if (!boundary) return null;
  if (expectedBoundary && boundary !== expectedBoundary) return null;

  return {
    version: ASSISTANT_STATE_VERSION,
    boundary,
    goal: cleanString(value.goal, 500),
    active_topic: cleanString(value.active_topic || value.goal, 500),
    active_service: cleanString(value.active_service, 120),
    active_entity: cleanString(value.active_entity, 200),
    current_stage: cleanString(value.current_stage, 200),
    last_intent: cleanString(value.last_intent, 120),
    unresolved_question: cleanString(value.unresolved_question, 500),
    sensitive_state: cleanString(value.sensitive_state, 32),
    open_tasks: cleanStringArray(value.open_tasks),
    required_data: cleanStringArray(value.required_data),
    processed_event_ids: cleanStringArray(value.processed_event_ids),
    confirmed_facts: cleanScalarObject(value.confirmed_facts),
    important_confirmed_facts: cleanScalarObject(value.important_confirmed_facts || value.confirmed_facts),
    pending_confirmation: value.pending_confirmation && typeof value.pending_confirmation === 'object'
      ? cleanScalarObject(value.pending_confirmation)
      : null,
    last_action: value.last_action && typeof value.last_action === 'object'
      ? cleanScalarObject(value.last_action)
      : null,
    updated_at: cleanString(value.updated_at, 100)
  };
}

function conversationalStateView(state) {
  if (!state) return null;
  return {
    boundary: state.boundary,
    goal: state.goal,
    active_topic: state.active_topic,
    active_service: state.active_service,
    active_entity: state.active_entity,
    current_stage: state.current_stage,
    last_intent: state.last_intent,
    unresolved_question: state.unresolved_question,
    open_tasks: state.open_tasks,
    required_data: state.required_data,
    user_confirmed_context: state.confirmed_facts,
    important_confirmed_facts: state.important_confirmed_facts,
    pending_confirmation: state.pending_confirmation,
    last_action: state.last_action
  };
}

module.exports = {
  ASSISTANT_STATE_VERSION,
  sanitizeAssistantState,
  conversationalStateView
};
