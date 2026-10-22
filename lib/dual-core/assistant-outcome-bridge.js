'use strict';

const { DynamicIntelligenceBus } = require('./intelligence-bus');
const { EVENT_TYPES } = require('./event-taxonomy');
const { LearningLoop } = require('../learning/learning-loop');

const bus = new DynamicIntelligenceBus({ maxHistory: 500 });

function cleanScalar(value, maxLength = 300) {
  if (value === null || ['number','boolean'].includes(typeof value)) return value;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function sanitizeMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const key of ['service_code','workflow_key','error_code','source','resource_id','http_status','event_type']) {
    const value = cleanScalar(input[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function learningActionForType(type) {
  if (type === EVENT_TYPES.USER_CORRECTED) return 'modified';
  return 'observed';
}

function attachCoreBLearningConsumer({ supabase }) {
  if (!supabase) throw new Error('DUAL_CORE_SUPABASE_REQUIRED');
  const learning = new LearningLoop(supabase);
  const unsubscribers = [];

  for (const type of [
    EVENT_TYPES.CAPABILITY_MISSING,
    EVENT_TYPES.CAPABILITY_FAILED,
    EVENT_TYPES.ASSISTANT_INTENT_FAILED,
    EVENT_TYPES.ASSISTANT_LOW_CONFIDENCE,
    EVENT_TYPES.USER_CORRECTED,
    EVENT_TYPES.WORKFLOW_ABANDONED,
    EVENT_TYPES.CALCULATION_MISMATCH,
    EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED,
    EVENT_TYPES.PRODUCTION_REGRESSION
  ]) {
    unsubscribers.push(bus.subscribe(type, async event => {
      const metadata = sanitizeMetadata(event.metadata);
      return learning.record({
        userId: event.metadata?.user_id || null,
        projectId: event.metadata?.project_id || null,
        eventType: type,
        action: learningActionForType(type),
        feedback: null,
        confidenceBefore: null,
        confidenceAfter: null,
        metadata: {
          ...metadata,
          dual_core_event_id: event.id,
          occurred_at: event.occurred_at
        }
      });
    }));
  }

  return () => unsubscribers.forEach(fn => fn());
}

async function publishAssistantOutcomeBestEffort({
  supabase,
  type,
  userId = null,
  projectId = null,
  payload = {},
  metadata = {}
}) {
  try {
    const detach = attachCoreBLearningConsumer({ supabase });
    try {
      const event = bus.createEvent(type, payload, {
        ...sanitizeMetadata(metadata),
        user_id:userId,
        project_id:projectId
      });
      const result = await bus.publish(event);
      return { ok:true, event_id:event.id, delivered:result.delivered };
    } finally {
      detach();
    }
  } catch (err) {
    console.warn('[dual-core-outcome]', err.message);
    return { ok:false, error:'DUAL_CORE_OUTCOME_RECORD_FAILED' };
  }
}

function getAssistantOutcomeBus() {
  return bus;
}

module.exports = {
  sanitizeMetadata,
  learningActionForType,
  attachCoreBLearningConsumer,
  publishAssistantOutcomeBestEffort,
  getAssistantOutcomeBus
};
