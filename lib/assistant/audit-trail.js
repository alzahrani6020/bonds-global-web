'use strict';

const crypto = require('crypto');

const ALLOWED_EVENTS = new Set([
  'planned',
  'confirmation_prepared',
  'confirmation_resolved',
  'idempotency_claimed',
  'replayed',
  'write_succeeded',
  'write_uncertain',
  'denied',
  'failed',
  'execution_started',
  'execution_succeeded',
  'execution_failed',
  'execution_denied',
  'event_received',
  'event_applied',
  'event_replayed',
  'event_denied'
]);

function clip(value, max) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text ? text.slice(0, max) : null;
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 50)) {
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) continue;
    if (item === null || ['string','number','boolean'].includes(typeof item)) {
      out[key] = typeof item === 'string' ? item.slice(0, 500) : item;
    }
  }
  return out;
}

function hashOpaque(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeAssistantAuditEvent({
  action = {},
  eventType,
  outcome = null,
  userId,
  sessionId = null,
  boundary = null,
  idempotencyKey = null,
  resourceId = null,
  metadata = {}
} = {}) {
  if (!userId) throw new Error('AUDIT_USER_REQUIRED');
  if (!ALLOWED_EVENTS.has(eventType)) throw new Error('AUDIT_EVENT_INVALID');

  return {
    p_user_id:userId,
    p_session_id:clip(sessionId, 200),
    p_boundary:clip(boundary, 500),
    p_action_id:clip(action.id, 200),
    p_action_type:clip(action.type || 'unknown', 100),
    p_target:clip(action.target, 200),
    p_event_type:eventType,
    p_outcome:clip(outcome, 100),
    p_risk:clip(action.risk, 50),
    p_requires_confirmation:action.requires_confirmation === true,
    p_idempotency_key_hash:hashOpaque(idempotencyKey),
    p_resource_id:clip(resourceId, 200),
    p_metadata:sanitizeMetadata(metadata)
  };
}

async function appendAssistantAudit({
  supabase,
  ...event
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('AUDIT_DATABASE_REQUIRED');
  }

  const payload = normalizeAssistantAuditEvent(event);
  const { data, error } = await supabase.rpc('assistant_append_action_audit', payload);
  if (error) throw error;

  return {
    ok:true,
    audit_id:data || null
  };
}

async function appendAssistantAuditBestEffort(options = {}) {
  try {
    return await appendAssistantAudit(options);
  } catch (err) {
    return {
      ok:false,
      error:String(err?.message || 'AUDIT_APPEND_FAILED')
    };
  }
}

module.exports = {
  ALLOWED_EVENTS,
  sanitizeMetadata,
  hashOpaque,
  normalizeAssistantAuditEvent,
  appendAssistantAudit,
  appendAssistantAuditBestEffort
};
