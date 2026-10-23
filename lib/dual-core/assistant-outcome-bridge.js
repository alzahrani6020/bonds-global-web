'use strict';

const { DynamicIntelligenceBus } = require('./intelligence-bus');
const { EVENT_TYPES } = require('./event-taxonomy');
const { LearningLoop } = require('../learning/learning-loop');
const { aggregateEvolutionSignal } = require('./evolution-proposal-aggregator');
const { enqueueEvolutionProposalForReview } = require('../learning/evolution-agent-inbox');

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

async function consumeCoreBOutcome({ supabase, event, userId = null, projectId = null }) {
  if (!supabase) throw new Error('DUAL_CORE_SUPABASE_REQUIRED');
  const learning = new LearningLoop(supabase);
  return learning.record({
    userId,
    projectId,
    eventType:event.type,
    action:learningActionForType(event.type),
    feedback:null,
    confidenceBefore:null,
    confidenceAfter:null,
    metadata:{
      ...sanitizeMetadata(event.metadata),
      dual_core_event_id:event.id,
      occurred_at:event.occurred_at
    }
  });
}

async function aggregateCoreBProposalBestEffort({ supabase, event }) {
  try {
    const proposal = await aggregateEvolutionSignal({ supabase, event });
    let inboxQueued = false;
    try {
      const inbox = await enqueueEvolutionProposalForReview({
        supabase,
        proposal,
        eventId:event.id
      });
      inboxQueued = Boolean(inbox?.queued);
    } catch (err) {
      console.warn('[dual-core-evolution-inbox]', err.message);
    }
    return { ok:true, proposal, inboxQueued };
  } catch (err) {
    console.warn('[dual-core-proposal]', err.message);
    return { ok:false, error:'EVOLUTION_PROPOSAL_AGGREGATION_FAILED', inboxQueued:false };
  }
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
    const event = bus.createEvent(type, payload, sanitizeMetadata(metadata));
    const routed = await bus.publish(event);

    let learned = false;
    try {
      await consumeCoreBOutcome({ supabase, event, userId, projectId });
      learned = true;
    } catch (err) {
      console.warn('[dual-core-learning]', err.message);
    }

    const aggregation = await aggregateCoreBProposalBestEffort({ supabase, event });

    return {
      ok:true,
      event_id:event.id,
      delivered:routed.delivered,
      learned,
      aggregated:aggregation.ok,
      proposal_status:aggregation.proposal?.status || null,
      review_queued:Boolean(aggregation.inboxQueued)
    };
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
  consumeCoreBOutcome,
  aggregateCoreBProposalBestEffort,
  publishAssistantOutcomeBestEffort,
  getAssistantOutcomeBus
};
