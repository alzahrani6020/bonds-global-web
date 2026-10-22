'use strict';

const { loadWorkflowState, saveWorkflowState } = require('./workflow-state');

const SENSITIVE_WORKFLOW_STATE_VERSION = 1;
const SENSITIVE_WORKFLOW_STATES = Object.freeze([
  'draft','ready','confirmed','submitted','completed','failed'
]);

const SENSITIVE_WORKFLOW_TRANSITIONS = Object.freeze({
  draft:Object.freeze(['ready']),
  ready:Object.freeze(['draft','confirmed']),
  confirmed:Object.freeze(['ready','submitted']),
  submitted:Object.freeze(['completed','failed']),
  failed:Object.freeze(['ready']),
  completed:Object.freeze([])
});

function cleanString(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const text=value.trim();
  return text ? text.slice(0,maxLength) : null;
}

function normalizeSensitiveWorkflowState(value, fallback = 'draft') {
  const state=cleanString(value,32) || fallback;
  if (!SENSITIVE_WORKFLOW_STATES.includes(state)) {
    throw new Error('INVALID_SENSITIVE_WORKFLOW_STATE');
  }
  return state;
}

function transitionAllowed(fromState,toState) {
  const from=normalizeSensitiveWorkflowState(fromState);
  const to=normalizeSensitiveWorkflowState(toState);
  return from===to || SENSITIVE_WORKFLOW_TRANSITIONS[from].includes(to);
}

function assertSensitiveTransition(fromState,toState) {
  const from=normalizeSensitiveWorkflowState(fromState);
  const to=normalizeSensitiveWorkflowState(toState);
  if (from===to) return { from,to,replayed:true };
  if (!SENSITIVE_WORKFLOW_TRANSITIONS[from].includes(to)) {
    throw new Error('SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED');
  }
  return { from,to,replayed:false };
}

function normalizeExpectedVersion(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('SENSITIVE_WORKFLOW_VERSION_REQUIRED');
  }
  return value;
}

async function transitionSensitiveWorkflowState({
  supabase,
  userId,
  workflowKey,
  toState,
  expectedVersion,
  boundary = null,
  reason = null
}) {
  if (!userId) throw new Error('SENSITIVE_WORKFLOW_USER_REQUIRED');
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('SENSITIVE_WORKFLOW_STORE_UNAVAILABLE');
  }

  const version=normalizeExpectedVersion(expectedVersion);
  const workflow=await loadWorkflowState({
    supabase,
    userId,
    workflowKey
  });
  if (!workflow) throw new Error('WORKFLOW_NOT_FOUND');
  if (['completed','cancelled'].includes(workflow.status)) {
    throw new Error('SENSITIVE_WORKFLOW_STATUS_BLOCKED');
  }

  const expectedBoundary=cleanString(boundary,500);
  if (expectedBoundary && expectedBoundary!==workflow.boundary) {
    throw new Error('SENSITIVE_WORKFLOW_BOUNDARY_CONFLICT');
  }

  const current=normalizeSensitiveWorkflowState(
    workflow.state?.sensitive_state || 'draft'
  );
  const transition=assertSensitiveTransition(current,toState);

  if (transition.replayed) {
    return {
      workflow,
      transition,
      execution_triggered:false,
      business_submission_triggered:false,
      authorization:{ granted:false, source:'workflow_state_metadata_only' }
    };
  }

  const nextState={
    ...(workflow.state || {}),
    boundary:workflow.boundary,
    sensitive_state:transition.to,
    last_action:{
      type:'sensitive_workflow_transition',
      from_state:transition.from,
      to_state:transition.to,
      reason:cleanString(reason,300) || ''
    },
    updated_at:new Date().toISOString()
  };

  const saved=await saveWorkflowState({
    supabase,
    userId,
    workflowKey:workflow.workflow_key,
    boundary:workflow.boundary,
    state:nextState,
    status:workflow.status,
    expectedVersion:version
  });

  return {
    workflow:saved,
    transition,
    execution_triggered:false,
    business_submission_triggered:false,
    authorization:{ granted:false, source:'workflow_state_metadata_only' }
  };
}

module.exports={
  SENSITIVE_WORKFLOW_STATE_VERSION,
  SENSITIVE_WORKFLOW_STATES,
  SENSITIVE_WORKFLOW_TRANSITIONS,
  normalizeSensitiveWorkflowState,
  transitionAllowed,
  assertSensitiveTransition,
  transitionSensitiveWorkflowState
};
