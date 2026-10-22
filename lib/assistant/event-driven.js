'use strict';

const EVENT_DRIVEN_ASSISTANT_VERSION = 1;

const ALLOWED_EVENTS = Object.freeze({
  form_saved: {
    suggestion_type:'resume_workflow',
    next_capability:'form_load'
  },
  document_uploaded: {
    suggestion_type:'review_document',
    next_capability:'document_find'
  },
  case_status_changed: {
    suggestion_type:'review_case_next_step',
    next_capability:'funding_next_step'
  },
  page_changed: {
    suggestion_type:'refresh_context',
    next_capability:null
  }
});

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanScalarMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    const cleanKey = cleanString(key, 80);
    if (!cleanKey) continue;
    if (item === null || ['string','number','boolean'].includes(typeof item)) {
      out[cleanKey] = typeof item === 'string' ? item.slice(0, 300) : item;
    }
  }
  return out;
}

function normalizeAssistantEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ASSISTANT_EVENT_INVALID');
  }

  const type = cleanString(input.type, 80);
  if (!type || !Object.prototype.hasOwnProperty.call(ALLOWED_EVENTS, type)) {
    throw new Error('ASSISTANT_EVENT_TYPE_NOT_ALLOWED');
  }

  const boundary = cleanString(input.boundary, 500);
  const resourceId = cleanString(input.resource_id, 160);
  const source = cleanString(input.source, 80) || 'user_session';

  return {
    version: EVENT_DRIVEN_ASSISTANT_VERSION,
    type,
    boundary,
    resource_id: resourceId,
    source,
    metadata: cleanScalarMetadata(input.metadata)
  };
}

function suggestFromAssistantEvent(input) {
  const event = normalizeAssistantEvent(input);
  const rule = ALLOWED_EVENTS[event.type];

  return {
    version: EVENT_DRIVEN_ASSISTANT_VERSION,
    event,
    suggestion:{
      type:rule.suggestion_type,
      capability:rule.next_capability,
      resource_id:event.resource_id,
      boundary:event.boundary,
      status:'suggested',
      requires_user_action:true
    },
    auto_execute:false,
    auto_write:false,
    execution_authorized:false
  };
}

module.exports = {
  EVENT_DRIVEN_ASSISTANT_VERSION,
  ALLOWED_EVENTS,
  normalizeAssistantEvent,
  suggestFromAssistantEvent
};
