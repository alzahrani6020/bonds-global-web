'use strict';

const { saveWorkflowState, loadWorkflowState } = require('./workflow-state');

const CASE_ENGINE_VERSION = 1;
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
  userMessage = null,
  serviceCode = null,
  intent = 'information',
  missingRequirements = [],
  executed = false
}) {
  const stage = stageForIntent(intent, {
    missingRequired: missingRequirements.length,
    executed
  });
  const next = nextBestAction({
    serviceCode,
    missingRequirements,
    intent,
    executed
  });

  return {
    version: 1,
    boundary,
    goal: previousState?.goal || clean(userMessage, 500),
    current_stage: stage,
    open_tasks: next?.label_ar ? [next.label_ar] : [],
    required_data: missingRequirements.slice(0, 50),
    processed_event_ids: previousState?.processed_event_ids || [],
    confirmed_facts: previousState?.confirmed_facts || {},
    pending_confirmation: previousState?.pending_confirmation || null,
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
  normalizeCaseStage,
  stageForIntent,
  nextBestAction,
  buildCaseState,
  persistCaseState
};
