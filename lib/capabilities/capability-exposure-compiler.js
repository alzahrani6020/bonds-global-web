'use strict';

const {
  inferActionType
} = require('./bonds-capability-registry');
const {
  RISK_RANK,
  normalizeRisk,
  defaultModelCapabilityPassportRegistry,
  validatePassportForModel
} = require('../ai/model-capability-passport');
const {
  defaultModelRegistry
} = require('../ai/model-registry');

const WRITE_EFFECTS = new Set(['database_write', 'network_write']);

function capabilityRisk(capability = {}) {
  const explicit = normalizeRisk(
    capability.risk_level || capability.riskLevel || capability.risk,
    ''
  );
  if (explicit && RISK_RANK[explicit]) return explicit;

  const sideEffect = String(capability.sideEffect || capability.side_effect || 'none').trim();
  if (sideEffect === 'network_write') return 'high';
  if (sideEffect === 'database_write') return 'medium';
  return 'low';
}

function capabilityHealth(capability = {}, health = null) {
  const status = String(
    health?.status ||
    capability.health ||
    (capability.active === false ? 'disabled' : 'healthy')
  ).trim().toLowerCase();

  return ['healthy', 'degraded', 'unavailable', 'disabled'].includes(status)
    ? status
    : 'unavailable';
}

function requiredPermissions(capability = {}) {
  const candidates = [
    capability.required_permissions,
    capability.requiredPermissions,
    capability.governance?.permissions,
    capability.permissions
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
    }
  }
  return [];
}

function requiredRoles(capability = {}) {
  const candidates = [
    capability.required_roles,
    capability.requiredRoles,
    capability.governance?.roles,
    capability.roles
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) {
      return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
    }
  }
  return [];
}

function trustedGovernanceAllows(capability, trustedGovernance = null) {
  if (!trustedGovernance) {
    return { allowed:true, code:null, checked:false };
  }

  if (trustedGovernance.authenticated === false) {
    return { allowed:false, code:'USER_NOT_AUTHENTICATED', checked:true };
  }

  const permissions = new Set(
    (Array.isArray(trustedGovernance.permissions) ? trustedGovernance.permissions : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  );
  const roles = new Set(
    (Array.isArray(trustedGovernance.roles) ? trustedGovernance.roles : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  );

  const requiredPerms = requiredPermissions(capability);
  if (requiredPerms.length && !requiredPerms.every(permission => permissions.has(permission))) {
    return { allowed:false, code:'CAPABILITY_PERMISSION_NOT_EXPOSED', checked:true };
  }

  const requiredRoleList = requiredRoles(capability);
  if (requiredRoleList.length && !requiredRoleList.some(role => roles.has(role))) {
    return { allowed:false, code:'CAPABILITY_ROLE_NOT_EXPOSED', checked:true };
  }

  return { allowed:true, code:null, checked:true };
}

function compileCapabilityExposure(capability, {
  model = null,
  modelRegistry = defaultModelRegistry,
  passportRegistry = defaultModelCapabilityPassportRegistry,
  passport = null,
  trustedGovernance = null,
  health = null
} = {}) {
  if (!capability || typeof capability !== 'object') {
    return { exposed:false, code:'UNKNOWN_CAPABILITY' };
  }

  if (capability.active === false) {
    return { exposed:false, code:'CAPABILITY_DISABLED' };
  }

  const healthStatus = capabilityHealth(capability, health);
  if (!['healthy', 'degraded'].includes(healthStatus)) {
    return { exposed:false, code:'CAPABILITY_UNAVAILABLE', health:healthStatus };
  }

  if (!model && !passport) {
    const governance = trustedGovernanceAllows(capability, trustedGovernance);
    return governance.allowed
      ? {
          exposed:true,
          code:null,
          health:healthStatus,
          risk:capabilityRisk(capability),
          model_id:null,
          certification_level:null,
          governance_checked:governance.checked
        }
      : {
          exposed:false,
          code:governance.code,
          health:healthStatus,
          risk:capabilityRisk(capability),
          governance_checked:governance.checked
        };
  }

  const modelId = typeof model === 'string'
    ? model
    : String(model?.model_id || model?.id || passport?.model_id || '').trim();
  const selectedPassport = passport || passportRegistry.get(modelId);
  const validation = validatePassportForModel(selectedPassport, {
    passportRegistry,
    modelRegistry
  });

  if (!validation.valid) {
    return {
      exposed:false,
      code:validation.code,
      health:healthStatus,
      model_id:modelId || null
    };
  }

  const p = validation.passport;
  const action = String(capability.action || '').trim();
  const actionType = inferActionType(action, capability);
  const sideEffect = String(capability.sideEffect || 'none').trim();
  const risk = capabilityRisk(capability);

  if (RISK_RANK[risk] > RISK_RANK[p.max_risk]) {
    return { exposed:false, code:'MODEL_RISK_TIER_EXCEEDED', health:healthStatus, risk, model_id:p.model_id };
  }
  if (p.denied_actions.includes(action)) {
    return { exposed:false, code:'MODEL_CAPABILITY_DENIED', health:healthStatus, risk, model_id:p.model_id };
  }
  if (p.allowed_actions.length && !p.allowed_actions.includes(action)) {
    return { exposed:false, code:'MODEL_CAPABILITY_NOT_CERTIFIED', health:healthStatus, risk, model_id:p.model_id };
  }
  if (p.allowed_action_types.length && !p.allowed_action_types.includes(actionType)) {
    return { exposed:false, code:'MODEL_ACTION_TYPE_NOT_CERTIFIED', health:healthStatus, risk, model_id:p.model_id };
  }
  if (p.allowed_side_effects.length && !p.allowed_side_effects.includes(sideEffect)) {
    return { exposed:false, code:'MODEL_SIDE_EFFECT_NOT_CERTIFIED', health:healthStatus, risk, model_id:p.model_id };
  }

  const governance = trustedGovernanceAllows(capability, trustedGovernance);
  if (!governance.allowed) {
    return {
      exposed:false,
      code:governance.code,
      health:healthStatus,
      risk,
      model_id:p.model_id,
      certification_level:p.certification_level,
      governance_checked:governance.checked
    };
  }

  return {
    exposed:true,
    code:null,
    health:healthStatus,
    risk,
    model_id:p.model_id,
    certification_level:p.certification_level,
    governance_checked:governance.checked,
    confirmation_required:WRITE_EFFECTS.has(sideEffect)
  };
}

module.exports = {
  WRITE_EFFECTS,
  capabilityRisk,
  capabilityHealth,
  requiredPermissions,
  requiredRoles,
  trustedGovernanceAllows,
  compileCapabilityExposure
};
