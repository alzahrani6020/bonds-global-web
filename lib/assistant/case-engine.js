'use strict';

const { saveWorkflowState, loadWorkflowState } = require('./workflow-state');

const CASE_ENGINE_VERSION = 1;
const MAX_CONVERSATION_TURNS = 12;
const CASE_STAGES = Object.freeze([
  'discovery',
  'data_collection',
  'validation',
  'analysis',
  'review',
  'execution',
  'completed'
]);

function clean(value, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function sanitizeConversationTail(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(turn => turn && typeof turn === 'object' && ['user', 'assistant'].includes(turn.role))
    .map(turn => ({
      role: turn.role,
      content: clean(turn.content, 1200) || ''
    }))
    .filter(turn => turn.content)
    .slice(-MAX_CONVERSATION_TURNS);
}

function mergeConversationTail(...tails) {
  const merged = [];
  for (const tail of tails) {
    for (const turn of sanitizeConversationTail(tail)) {
      const previous = merged[merged.length - 1];
      if (previous && previous.role === turn.role && previous.content === turn.content) continue;
      merged.push(turn);
    }
  }
  return merged.slice(-MAX_CONVERSATION_TURNS);
}

function mergeCaseContinuity(previousState, seedState) {
  const previous = previousState && typeof previousState === 'object' ? previousState : {};
  const seed = seedState && typeof seedState === 'object' ? seedState : {};
  return {
    goal: previous.goal || seed.goal || null,
    current_stage: previous.current_stage || seed.current_stage || null,
    processed_event_ids: Array.from(new Set([
      ...(Array.isArray(seed.processed_event_ids) ? seed.processed_event_ids : []),
      ...(Array.isArray(previous.processed_event_ids) ? previous.processed_event_ids : [])
    ])).slice(-50),
    confirmed_facts: {
      ...(seed.confirmed_facts && typeof seed.confirmed_facts === 'object' ? seed.confirmed_facts : {}),
      ...(previous.confirmed_facts && typeof previous.confirmed_facts === 'object' ? previous.confirmed_facts : {})
    },
    pending_confirmation: previous.pending_confirmation || seed.pending_confirmation || null,
    conversation_tail: mergeConversationTail(seed.conversation_tail, previous.conversation_tail)
  };
}

function normalizeCaseStage(value, fallback = 'discovery') {
  const stage = clean(value, 64) || fallback;
  if (!CASE_STAGES.includes(stage)) throw new Error('INVALID_CASE_STAGE');
  return stage;
}

function stageForIntent(intent, { missingRequired = 0, executed = false } = {}) {
  if (executed) return 'review';
  if (missingRequired > 0) return 'data_collection';
  if (intent === 'calculation' || intent === 'analysis') return 'analysis';
  if (intent === 'execution') return 'execution';
  if (intent === 'document') return 'validation';
  if (intent === 'escalation') return 'review';
  if (intent === 'follow_up') return 'review';
  return 'discovery';
}

function nextBestAction({ serviceCode = null, missingRequirements = [], intent = 'information', executed = false } = {}) {
  const missing = Array.isArray(missingRequirements) ? missingRequirements.filter(Boolean) : [];
  if (missing.length) {
    return {
      type: 'requirements',
      code: 'COLLECT_REQUIRED_DATA',
      service_code: serviceCode,
      label_ar: 'استكمال البيانات أو المستندات الناقصة',
      label_en: 'Complete missing data or documents',
      missing: missing.slice(0, 12)
    };
  }
  if (executed) {
    return {
      type: 'review',
      code: 'REVIEW_RESULT',
      service_code: serviceCode,
      label_ar: 'مراجعة النتيجة والتحقق من الافتراضات',
      label_en: 'Review result and validate assumptions'
    };
  }
  if (intent === 'calculation' || intent === 'analysis') {
    return {
      type: 'execution',
      code: 'RUN_REGISTERED_ENGINE',
      service_code: serviceCode,
      label_ar: 'تشغيل المحرك المسجل عند توفر المدخلات',
      label_en: 'Run the registered engine when inputs are available'
    };
  }
  if (intent === 'escalation') {
    return {
      type: 'escalation',
      code: 'HUMAN_REVIEW',
      service_code: serviceCode,
      label_ar: 'إحالة الحالة إلى المراجعة البشرية',
      label_en: 'Escalate the case for human review'
    };
  }
  return {
    type: 'guidance',
    code: 'CONTINUE_DISCOVERY',
    service_code: serviceCode,
    label_ar: 'تحديد الهدف والبيانات التالية',
    label_en: 'Clarify the goal and next data'
  };
}

function buildCaseState({
  boundary,
  previousState = null,
  seedState = null,
  conversationTail = [],
  userMessage = null,
  serviceCode = null,
  intent = 'information',
  missingRequirements = [],
  executed = false
}) {
  const continuity = mergeCaseContinuity(previousState, seedState);
  const computedStage = stageForIntent(intent, {
    missingRequired: missingRequirements.length,
    executed
  });
  const stage = intent === 'follow_up' && CASE_STAGES.includes(continuity.current_stage)
    ? continuity.current_stage
    : computedStage;
  const next = nextBestAction({
    serviceCode,
    missingRequirements,
    intent,
    executed
  });

  return {
    version: 1,
    boundary,
    goal: continuity.goal || clean(userMessage, 500),
    current_stage: stage,
    open_tasks: next?.label_ar ? [next.label_ar] : [],
    required_data: missingRequirements.slice(0, 50),
    processed_event_ids: continuity.processed_event_ids,
    confirmed_facts: continuity.confirmed_facts,
    pending_confirmation: continuity.pending_confirmation,
    conversation_tail: mergeConversationTail(continuity.conversation_tail, conversationTail),
    last_action: {
      type: next?.type || 'guidance',
      code: next?.code || 'CONTINUE_DISCOVERY',
      service_code: serviceCode || null
    },
    updated_at: new Date().toISOString()
  };
}

async function persistCaseState({
  supabase,
  userId,
  workflowKey,
  boundary,
  userMessage,
  seedState = null,
  conversationTail = [],
  serviceCode,
  intent,
  missingRequirements = [],
  executed = false
}) {
  if (!supabase || !userId || !workflowKey || !boundary) return null;

  let existing = null;
  try {
    existing = await loadWorkflowState({ supabase, userId, workflowKey });
  } catch (error) {
    if (!String(error.message || '').includes('WORKFLOW_LOAD_FAILED')) throw error;
  }

  const state = buildCaseState({
    boundary,
    previousState: existing?.state || null,
    seedState,
    conversationTail,
    userMessage,
    serviceCode,
    intent,
    missingRequirements,
    executed
  });

  return saveWorkflowState({
    supabase,
    userId,
    workflowKey,
    boundary,
    state,
    status: existing?.status || 'active',
    expectedVersion: existing?.version ?? null
  });
}

module.exports = {
  CASE_ENGINE_VERSION,
  CASE_STAGES,
  sanitizeConversationTail,
  mergeConversationTail,
  mergeCaseContinuity,
  normalizeCaseStage,
  stageForIntent,
  nextBestAction,
  buildCaseState,
  persistCaseState
};
