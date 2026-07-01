/**
 * BONDS Business Rules Engine — Server-side
 *
 * Loads the canonical rule registry and evaluates rules against a context.
 * Supports declarative built-ins, custom function registration, and workflow transitions.
 */

const path = require('path');

let registry = null;
try {
  registry = require('./registry.json');
} catch (err) {
  console.warn('[BusinessRulesEngine] Could not load registry.json:', err.message);
  registry = { version: '0.0', rules: [] };
}

const BUILTIN_EVALUATORS = {
  'BR-SECTOR-001': (ctx) => ({
    passed: true,
    effect: ctx.asset_class === 'realEstate' ? 'hide_vehicle_fields' : null,
    fields: ctx.asset_class === 'realEstate' ? ['mileage', 'model_year', 'fuel_type', 'plate_number'] : []
  }),
  'BR-SECTOR-002': (ctx) => ({
    passed: true,
    effect: (ctx.sector === 'restaurant' || (ctx.activity && ctx.activity.includes('food'))) ? 'show_food_fields' : null,
    fields: ['food_cost_percentage', 'menu_items', 'ingredient_prices']
  }),
  'BR-SECTOR-003': (ctx) => ({
    passed: true,
    effect: ctx.sector === 'manufacturing' ? 'show_production_fields' : null,
    fields: ['production_lines', 'capacity_per_line', 'machine_cost']
  }),
  'BR-SECTOR-004': (ctx) => ({
    passed: true,
    effect: ctx.sector === 'education' ? 'show_capacity_fields' : null,
    fields: ['student_capacity', 'classrooms', 'tuition_fee']
  }),
  'BR-SECTOR-005': (ctx) => ({
    passed: true,
    effect: (ctx.sector === 'healthcare' && ctx.activity && ctx.activity.includes('hospital')) ? 'show_bed_fields' : null,
    fields: ['beds', 'occupancy_rate', 'avg_patient_revenue']
  }),
  'BR-VAL-001': (ctx) => {
    if (!ctx.asset_class) return { passed: false, message: 'asset_class is required' };
    let method = 'market';
    if (ctx.asset_class === 'residentialRealEstate') method = 'market';
    if (ctx.asset_class === 'commercialRealEstate') method = 'income';
    if (ctx.asset_class === 'equipment') method = 'cost';
    return { passed: true, method };
  },
  'BR-VAL-002': (ctx) => {
    const score = Number(ctx.data_quality_score);
    if (Number.isNaN(score) || score < 80) {
      return { passed: false, message: 'Data quality score is below 80; AI report not allowed.' };
    }
    return { passed: true };
  },
  'BR-CRT-001': (ctx) => {
    const conf = Number(ctx.confidence_score);
    const dq = Number(ctx.data_quality_score);
    if (Number.isNaN(conf) || conf < 85) {
      return { passed: false, message: 'Confidence score is below 85; certificate not allowed.' };
    }
    if (Number.isNaN(dq) || dq < 80) {
      return { passed: false, message: 'Data quality score is below 80; certificate not allowed.' };
    }
    if (ctx.reportApproved !== true) {
      return { passed: false, message: 'Report must be approved before certificate issuance.' };
    }
    return { passed: true };
  },
  'BR-FIN-001': (ctx) => {
    const dscr = Number(ctx.dscr);
    if (!Number.isNaN(dscr) && dscr < 1.25) {
      return { passed: true, warning: 'DSCR is below 1.25; financing is high risk.', severity: 'high' };
    }
    return { passed: true };
  },
  'BR-FIN-002': (ctx) => {
    const ltv = Number(ctx.ltv);
    if (!Number.isNaN(ltv) && ltv > 0.80) {
      return { passed: false, message: 'LTV exceeds 0.80; additional collateral required.' };
    }
    return { passed: true };
  },
  'BR-SUB-001': (ctx) => ({
    passed: true,
    limits: ctx.tier === 'free' ? { scenarios: 3, countries: 5, exports: ['excel'] } : null
  }),
  'BR-SUB-002': (ctx) => ({
    passed: true,
    features: ['pro', 'enterprise'].includes(ctx.tier) ? { pdfExport: true, countries: 22 } : { pdfExport: false, countries: 5 }
  }),
  'BR-DATA-001': (ctx) => {
    if (ctx.source_confidence === 'D' && ctx.manualConfirmed !== true) {
      return { passed: false, message: 'Low-confidence source (D) requires manual confirmation.' };
    }
    return { passed: true };
  },
  'BR-DATA-002': (ctx) => ({
    passed: !!ctx.reason && String(ctx.reason).trim().length > 0,
    message: 'Override reason is required.'
  }),
  'BR-AI-001': () => ({ passed: true, note: 'AI provides analysis; final decision is human.' }),
  'BR-AI-002': (ctx) => ({
    passed: ctx.aiOutputSchemaCompliant === true,
    message: 'AI output must conform to the defined JSON schema.'
  }),
  'BR-SEC-001': () => ({ passed: true, note: 'No secrets in frontend (policy).' }),
  'BR-SEC-002': () => ({ passed: true, note: 'RLS enabled on sensitive tables (policy).' }),
  'BR-WF-001': (ctx) => ({
    passed: true,
    editable: ctx.projectStatus !== 'submitted' || ctx.role === 'reviewer'
  }),
  'BR-WF-002': (ctx) => ({
    passed: true,
    returnToOwner: ctx.reportStatus === 'rejected'
  }),
  'BR-AUD-001': () => ({ passed: true, note: 'Sensitive changes must be audited (policy).' }),
  'BR-I18N-001': (ctx) => ({
    passed: true,
    layout: ctx.language === 'ar' ? 'rtl' : 'ltr'
  }),
  'BR-I18N-002': (ctx) => ({
    passed: true,
    layout: ctx.language === 'en' ? 'ltr' : 'rtl'
  })
};

const customRules = new Map();
const workflows = new Map();

function normalizeResult(result, ruleMeta) {
  if (result === true) return { passed: true, rule: ruleMeta };
  if (result === false) return { passed: false, rule: ruleMeta, message: ruleMeta.action };
  if (result && typeof result === 'object') {
    return { ...result, rule: ruleMeta };
  }
  return { passed: !!result, rule: ruleMeta };
}

function getRuleMeta(ruleId) {
  const fromRegistry = (registry.rules || []).find(r => r.id === ruleId) || null;
  return fromRegistry ? { ...fromRegistry } : { id: ruleId };
}

function register(ruleId, fn, meta = {}) {
  if (typeof fn !== 'function') throw new Error('Rule evaluator must be a function');
  customRules.set(ruleId, { fn, meta });
}

function unregister(ruleId) {
  customRules.delete(ruleId);
}

function evaluate(ruleId, context = {}) {
  const meta = getRuleMeta(ruleId);

  if (customRules.has(ruleId)) {
    const { fn } = customRules.get(ruleId);
    return normalizeResult(fn(context), meta);
  }

  if (BUILTIN_EVALUATORS[ruleId]) {
    return normalizeResult(BUILTIN_EVALUATORS[ruleId](context), meta);
  }

  return { passed: true, rule: meta, message: 'Unknown rule; treated as passed.' };
}

function evaluateAll(ruleIds, context = {}) {
  const results = ruleIds.map(id => evaluate(id, context));
  const failures = results.filter(r => !r.passed);
  return {
    passed: failures.length === 0,
    results,
    failures
  };
}

function evaluateByCategory(category, context = {}) {
  const ruleIds = (registry.rules || [])
    .filter(r => r.category === category)
    .map(r => r.id);
  return evaluateAll(ruleIds, context);
}

function evaluateAllRules(context = {}) {
  const ruleIds = (registry.rules || []).map(r => r.id);
  return evaluateAll(ruleIds, context);
}

function listRules(filters = {}) {
  let rules = registry.rules || [];
  if (filters.category) rules = rules.filter(r => r.category === filters.category);
  if (filters.priority) rules = rules.filter(r => r.priority === filters.priority);
  if (filters.engine) rules = rules.filter(r => r.engine === filters.engine);
  return rules;
}

function defineWorkflow(entityType, states, transitions) {
  const stateSet = new Set(states);
  transitions.forEach(t => {
    if (!stateSet.has(t.from) || !stateSet.has(t.to)) {
      throw new Error(`Invalid workflow transition ${t.from} -> ${t.to} for ${entityType}`);
    }
  });
  workflows.set(entityType, { states, transitions });
}

function canTransition(entityType, fromState, toState, context = {}) {
  const wf = workflows.get(entityType);
  if (!wf) return { allowed: false, reason: 'No workflow defined for entity type.' };
  const transition = wf.transitions.find(t => t.from === fromState && t.to === toState);
  if (!transition) return { allowed: false, reason: `Transition ${fromState} -> ${toState} is not allowed.` };
  if (transition.requiredRole && (!context.role || transition.requiredRole !== context.role)) {
    return { allowed: false, reason: `Requires role: ${transition.requiredRole}.` };
  }
  if (transition.requiresApproval && !context.approvedBy) {
    return { allowed: false, reason: 'Approval required.' };
  }
  if (transition.rules) {
    const res = evaluateAll(transition.rules, context);
    if (!res.passed) return { allowed: false, reason: res.failures.map(f => f.message).join('؛ ') };
  }
  return { allowed: true, transition };
}

function getAllowedTransitions(entityType, fromState, context = {}) {
  const wf = workflows.get(entityType);
  if (!wf) return [];
  return wf.transitions
    .filter(t => t.from === fromState && canTransition(entityType, fromState, t.to, context).allowed)
    .map(t => t.to);
}

function getInitialState(entityType) {
  const wf = workflows.get(entityType);
  return wf ? wf.states[0] : null;
}

module.exports = {
  registry,
  register,
  unregister,
  evaluate,
  evaluateAll,
  evaluateByCategory,
  evaluateAllRules,
  listRules,
  defineWorkflow,
  canTransition,
  getAllowedTransitions,
  getInitialState,
  BUILTIN_EVALUATORS
};
