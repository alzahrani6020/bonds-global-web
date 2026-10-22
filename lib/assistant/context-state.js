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
    current_stage: cleanString(value.current_stage, 200),
    open_tasks: cleanStringArray(value.open_tasks),
    required_data: cleanStringArray(value.required_data),
    confirmed_facts: cleanScalarObject(value.confirmed_facts),
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
    current_stage: state.current_stage,
    open_tasks: state.open_tasks,
    required_data: state.required_data,
    user_confirmed_context: state.confirmed_facts,
    pending_confirmation: state.pending_confirmation,
    last_action: state.last_action
  };
}

module.exports = {
  ASSISTANT_STATE_VERSION,
  sanitizeAssistantState,
  conversationalStateView
};
