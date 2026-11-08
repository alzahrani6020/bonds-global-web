'use strict';

const GOAL_WORKFLOW_VERSION = 1;
const MAX_GOAL_NODES = 24;
const MAX_GOAL_EDGES = 36;
const EFFECTS = new Set(['none','network_read','database_read','compute','database_write','network_write']);
const MUTATING_EFFECTS = new Set(['database_write','network_write']);
const EDGE_STATUSES = new Set(['pending','completed','blocked','cancelled']);
const MANDATE_STATUSES = new Set(['granted','revoked','expired']);
const REVERSIBILITY = new Set(['none','reversible','compensatable','irreversible']);

function clean(value, max = 300) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function cleanId(value) {
  const id = clean(value, 100);
  return id && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(id) ? id : null;
}

function cleanStringArray(value, max = 24) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanId(item)).filter(Boolean).slice(0, max);
}

function cleanLimit(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.min(amount, 1e15) : null;
}

function sanitizeMandate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const status = clean(value.status, 20);
  if (!MANDATE_STATUSES.has(status)) return null;
  return {
    status,
    action_fingerprint: clean(value.action_fingerprint, 128),
    granted_at: clean(value.granted_at, 100),
    expires_at: clean(value.expires_at, 100),
    revocable: value.revocable !== false
  };
}

function sanitizeNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = cleanId(value.id);
  if (!id) return null;
  return {
    id,
    label: clean(value.label, 300),
    status: ['pending','active','completed','blocked','cancelled'].includes(value.status)
      ? value.status
      : 'pending'
  };
}

function sanitizeEdge(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = cleanId(value.id);
  const from = cleanId(value.from);
  const to = cleanId(value.to);
  const capability = cleanId(value.capability);
  if (!id || !from || !to || !capability) return null;
  const effect = EFFECTS.has(value.effect) ? value.effect : 'none';
  const reversibility = REVERSIBILITY.has(value.reversibility) ? value.reversibility : 'none';
  const status = EDGE_STATUSES.has(value.status) ? value.status : 'pending';
  const requiresMandate = MUTATING_EFFECTS.has(effect) || value.requires_mandate === true;
  return {
    id,
    from,
    to,
    capability,
    effect,
    dependencies: cleanStringArray(value.dependencies),
    entry_condition: clean(value.entry_condition, 300),
    success_condition: clean(value.success_condition, 300),
    requires_approval: value.requires_approval === true || requiresMandate,
    requires_mandate: requiresMandate,
    financial_limit: cleanLimit(value.financial_limit),
    reversibility,
    status,
    mandate: requiresMandate ? sanitizeMandate(value.mandate) : null
  };
}

function sanitizeGoalWorkflow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const nodes = (Array.isArray(value.nodes) ? value.nodes : [])
    .map(sanitizeNode).filter(Boolean).slice(0, MAX_GOAL_NODES);
  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = (Array.isArray(value.edges) ? value.edges : [])
    .map(sanitizeEdge)
    .filter(edge => edge && nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .slice(0, MAX_GOAL_EDGES);
  if (!nodes.length || !edges.length) return null;
  const currentEdgeId = cleanId(value.current_edge_id);
  return {
    version: GOAL_WORKFLOW_VERSION,
    status: ['active','paused','completed','cancelled'].includes(value.status)
      ? value.status
      : 'active',
    nodes,
    edges,
    current_edge_id: currentEdgeId && edges.some(edge => edge.id === currentEdgeId)
      ? currentEdgeId
      : null
  };
}

function edgeIdFor(action, from, to) {
  return ['edge', cleanId(action) || 'action', cleanId(from) || 'start', cleanId(to) || 'review']
    .join(':').slice(0, 100);
}

function ensureSingleEdgeGoalWorkflow(existing, { action, effect = 'none', from = 'execution', to = 'review' } = {}) {
  const capability = cleanId(action);
  if (!capability) return sanitizeGoalWorkflow(existing);
  const safeExisting = sanitizeGoalWorkflow(existing);
  if (safeExisting) {
    const pending = safeExisting.edges.find(edge => edge.status === 'pending' && edge.capability === capability);
    if (pending) return safeExisting;
  }
  const fromId = cleanId(from) || 'execution';
  const toId = cleanId(to) || 'review';
  const nodes = safeExisting?.nodes?.length
    ? safeExisting.nodes
    : [
        { id:fromId, label:fromId, status:'active' },
        { id:toId, label:toId, status:'pending' }
      ];
  if (!nodes.some(node => node.id === fromId)) nodes.push({ id:fromId, label:fromId, status:'active' });
  if (!nodes.some(node => node.id === toId)) nodes.push({ id:toId, label:toId, status:'pending' });

  const nextEdge = sanitizeEdge({
    id:edgeIdFor(capability, fromId, toId),
    from:fromId,
    to:toId,
    capability,
    effect,
    dependencies:[],
    entry_condition:'registered_capability_available',
    success_condition:'capability_execution_succeeded',
    requires_approval:MUTATING_EFFECTS.has(effect),
    requires_mandate:MUTATING_EFFECTS.has(effect),
    financial_limit:null,
    reversibility:MUTATING_EFFECTS.has(effect) ? 'compensatable' : 'none',
    status:'pending',
    mandate:null
  });

  return sanitizeGoalWorkflow({
    version:GOAL_WORKFLOW_VERSION,
    status:'active',
    nodes:nodes.slice(0, MAX_GOAL_NODES),
    edges:[...(safeExisting?.edges || []).filter(edge => edge.id !== nextEdge.id), nextEdge],
    current_edge_id:nextEdge.id
  });
}

function nextGoalWorkflowEdge(workflow) {
  const safe = sanitizeGoalWorkflow(workflow);
  if (!safe || safe.status !== 'active') return null;
  const completed = new Set(safe.edges.filter(edge => edge.status === 'completed').map(edge => edge.id));
  if (safe.current_edge_id) {
    const current = safe.edges.find(edge => edge.id === safe.current_edge_id);
    if (current && current.status === 'pending' && current.dependencies.every(dep => completed.has(dep))) return current;
  }
  return safe.edges.find(edge =>
    edge.status === 'pending' && edge.dependencies.every(dep => completed.has(dep))
  ) || null;
}

function evaluateGoalWorkflowEdge(edge, { now = Date.now() } = {}) {
  const safe = sanitizeEdge(edge);
  if (!safe) return { allowed:false, code:'GOAL_WORKFLOW_EDGE_INVALID' };
  if (!safe.requires_mandate) return { allowed:true, code:'GOAL_WORKFLOW_EDGE_READY', edge:safe };
  if (!safe.mandate || safe.mandate.status !== 'granted') {
    return { allowed:false, code:'GOAL_WORKFLOW_MANDATE_REQUIRED', edge:safe };
  }
  const expiresAt = safe.mandate.expires_at ? Date.parse(safe.mandate.expires_at) : NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    return { allowed:false, code:'GOAL_WORKFLOW_MANDATE_EXPIRED', edge:safe };
  }
  return { allowed:true, code:'GOAL_WORKFLOW_EDGE_READY', edge:safe };
}

function grantGoalWorkflowMandate(workflow, { edgeId, capability, actionFingerprint, expiresAt = null } = {}) {
  const safe = sanitizeGoalWorkflow(workflow);
  const id = cleanId(edgeId);
  const action = cleanId(capability);
  if (!safe || !id || !action) throw new Error('GOAL_WORKFLOW_MANDATE_BINDING_INVALID');
  const edge = safe.edges.find(item => item.id === id);
  if (!edge) throw new Error('GOAL_WORKFLOW_EDGE_NOT_FOUND');
  if (!edge.requires_mandate) throw new Error('GOAL_WORKFLOW_MANDATE_NOT_REQUIRED');
  if (edge.capability !== action) throw new Error('GOAL_WORKFLOW_CAPABILITY_MISMATCH');
  edge.mandate = {
    status:'granted',
    action_fingerprint:clean(actionFingerprint, 128),
    granted_at:new Date().toISOString(),
    expires_at:clean(expiresAt, 100),
    revocable:true
  };
  safe.current_edge_id = edge.id;
  return sanitizeGoalWorkflow(safe);
}

function completeGoalWorkflowEdge(workflow, edgeId) {
  const safe = sanitizeGoalWorkflow(workflow);
  const id = cleanId(edgeId);
  if (!safe || !id) return safe;
  const edge = safe.edges.find(item => item.id === id);
  if (!edge) return safe;
  edge.status = 'completed';
  const node = safe.nodes.find(item => item.id === edge.to);
  if (node) node.status = 'active';
  const next = safe.edges.find(item => item.status === 'pending' && item.dependencies.every(dep =>
    safe.edges.some(candidate => candidate.id === dep && candidate.status === 'completed')
  ));
  safe.current_edge_id = next?.id || null;
  if (!next && safe.edges.every(item => ['completed','cancelled'].includes(item.status))) safe.status = 'completed';
  return sanitizeGoalWorkflow(safe);
}

module.exports = {
  GOAL_WORKFLOW_VERSION,
  sanitizeGoalWorkflow,
  ensureSingleEdgeGoalWorkflow,
  nextGoalWorkflowEdge,
  evaluateGoalWorkflowEdge,
  grantGoalWorkflowMandate,
  completeGoalWorkflowEdge
};
