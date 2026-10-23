'use strict';

const { sanitizeAssistantState } = require('./context-state');

const WORKFLOW_STATE_SCHEMA_VERSION = 1;
const WORKFLOW_STATUSES = new Set(['active', 'paused', 'completed', 'cancelled']);

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeWorkflowKey(value) {
  const key = cleanString(value, 160);
  if (!key || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(key)) {
    throw new Error('INVALID_WORKFLOW_KEY');
  }
  return key;
}

function normalizeWorkflowStatus(value, fallback = 'active') {
  const status = cleanString(value, 32) || fallback;
  if (!WORKFLOW_STATUSES.has(status)) throw new Error('INVALID_WORKFLOW_STATUS');
  return status;
}

function normalizeExpectedVersion(value) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0) throw new Error('INVALID_WORKFLOW_VERSION');
  return value;
}

function normalizeWorkflowRow(row, expectedBoundary = null) {
  if (!row || typeof row !== 'object') return null;
  const state = sanitizeAssistantState(row.state, { expectedBoundary });
  if (!state) throw new Error('WORKFLOW_STATE_INVALID');
  return {
    id: row.id || null,
    workflow_key: normalizeWorkflowKey(row.workflow_key),
    boundary: state.boundary,
    status: normalizeWorkflowStatus(row.status),
    version: Number.isInteger(row.version) ? row.version : Number(row.version || 0),
    state,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

async function saveWorkflowState({ supabase, userId, workflowKey, boundary, state, status = 'active', expectedVersion = null }) {
  if (!supabase || typeof supabase.rpc !== 'function') throw new Error('WORKFLOW_STORE_UNAVAILABLE');
  if (!userId) throw new Error('WORKFLOW_USER_REQUIRED');

  const key = normalizeWorkflowKey(workflowKey);
  const cleanBoundary = cleanString(boundary, 500);
  if (!cleanBoundary) throw new Error('WORKFLOW_BOUNDARY_REQUIRED');

  const safeState = sanitizeAssistantState(state, { expectedBoundary: cleanBoundary });
  if (!safeState) throw new Error('WORKFLOW_STATE_INVALID');

  // Sensitive workflow state is governed by a dedicated atomic transition RPC.
  // General context saves must never write or clear it directly.
  const persistableState = { ...safeState };
  delete persistableState.sensitive_state;

  const cleanStatus = normalizeWorkflowStatus(status);
  const version = normalizeExpectedVersion(expectedVersion);

  const { data, error } = await supabase.rpc('assistant_save_workflow_state', {
    p_user_id: userId,
    p_workflow_key: key,
    p_boundary: cleanBoundary,
    p_status: cleanStatus,
    p_state: persistableState,
    p_expected_version: version
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('WORKFLOW_VERSION_CONFLICT')) throw new Error('WORKFLOW_VERSION_CONFLICT');
    if (message.includes('WORKFLOW_BOUNDARY_CONFLICT')) throw new Error('WORKFLOW_BOUNDARY_CONFLICT');
    throw new Error('WORKFLOW_STORE_FAILED');
  }

  return normalizeWorkflowRow(data, cleanBoundary);
}

async function loadWorkflowState({ supabase, userId, workflowKey }) {
  if (!supabase || typeof supabase.rpc !== 'function') throw new Error('WORKFLOW_STORE_UNAVAILABLE');
  if (!userId) throw new Error('WORKFLOW_USER_REQUIRED');

  const key = normalizeWorkflowKey(workflowKey);
  const { data, error } = await supabase.rpc('assistant_load_workflow_state', {
    p_user_id: userId,
    p_workflow_key: key
  });
  if (error) throw new Error('WORKFLOW_LOAD_FAILED');

  // PostgREST may serialize a composite RPC result as a one-item array.
  // Treat empty composite shapes as "not found" before row normalization.
  const row = Array.isArray(data) ? (data[0] || null) : data;
  if (!row) return null;
  if (
    typeof row === 'object' &&
    row.id == null &&
    row.workflow_key == null &&
    row.state == null
  ) return null;

  return normalizeWorkflowRow(row);
}

async function setWorkflowStatus({ supabase, userId, workflowKey, status, expectedVersion }) {
  if (!supabase || typeof supabase.rpc !== 'function') throw new Error('WORKFLOW_STORE_UNAVAILABLE');
  if (!userId) throw new Error('WORKFLOW_USER_REQUIRED');

  const key = normalizeWorkflowKey(workflowKey);
  const cleanStatus = normalizeWorkflowStatus(status);
  const version = normalizeExpectedVersion(expectedVersion);
  if (version === null) throw new Error('WORKFLOW_VERSION_REQUIRED');

  const { data, error } = await supabase.rpc('assistant_set_workflow_status', {
    p_user_id: userId,
    p_workflow_key: key,
    p_status: cleanStatus,
    p_expected_version: version
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('WORKFLOW_VERSION_CONFLICT')) throw new Error('WORKFLOW_VERSION_CONFLICT');
    if (message.includes('WORKFLOW_NOT_FOUND')) throw new Error('WORKFLOW_NOT_FOUND');
    throw new Error('WORKFLOW_STATUS_FAILED');
  }
  return normalizeWorkflowRow(data);
}

module.exports = {
  WORKFLOW_STATE_SCHEMA_VERSION,
  WORKFLOW_STATUSES,
  normalizeWorkflowKey,
  normalizeWorkflowStatus,
  normalizeExpectedVersion,
  normalizeWorkflowRow,
  saveWorkflowState,
  loadWorkflowState,
  setWorkflowStatus
};
