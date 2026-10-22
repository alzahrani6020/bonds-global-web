'use strict';

const {
  normalizeWorkflowKey,
  normalizeWorkflowRow
} = require('./workflow-state');

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

function mapTransitionError(error) {
  const message=String(error?.message || '');
  for(const code of [
    'WORKFLOW_VERSION_CONFLICT',
    'SENSITIVE_WORKFLOW_BOUNDARY_CONFLICT',
    'SENSITIVE_WORKFLOW_STATUS_BLOCKED',
    'WORKFLOW_NOT_FOUND',
    'SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED',
    'INVALID_SENSITIVE_WORKFLOW_STATE',
    'SENSITIVE_WORKFLOW_VERSION_REQUIRED',
    'SENSITIVE_WORKFLOW_USER_REQUIRED',
    'INVALID_WORKFLOW_KEY'
  ]) {
    if(message.includes(code)) return new Error(code);
  }
  return new Error('SENSITIVE_WORKFLOW_TRANSITION_FAILED');
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
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('SENSITIVE_WORKFLOW_STORE_UNAVAILABLE');
  }
  if (!userId) throw new Error('SENSITIVE_WORKFLOW_USER_REQUIRED');

  const key=normalizeWorkflowKey(workflowKey);
  const to=normalizeSensitiveWorkflowState(toState);
  const version=normalizeExpectedVersion(expectedVersion);
  const cleanBoundary=cleanString(boundary,500);
  const cleanReason=cleanString(reason,300);

  const { data,error }=await supabase.rpc(
    'assistant_transition_sensitive_workflow_state',
    {
      p_user_id:userId,
      p_workflow_key:key,
      p_to_state:to,
      p_expected_version:version,
      p_boundary:cleanBoundary,
      p_reason:cleanReason
    }
  );

  if(error) throw mapTransitionError(error);
  if(!data || typeof data!=='object' || !data.workflow) {
    throw new Error('SENSITIVE_WORKFLOW_TRANSITION_FAILED');
  }

  const workflow=normalizeWorkflowRow(
    data.workflow,
    cleanBoundary || null
  );
  const from=normalizeSensitiveWorkflowState(data.from_state);
  const returnedTo=normalizeSensitiveWorkflowState(data.to_state);
  const replayed=Boolean(data.replayed);

  return {
    workflow,
    transition:{ from,to:returnedTo,replayed },
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
