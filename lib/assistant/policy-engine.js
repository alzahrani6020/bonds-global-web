'use strict';

const contract = require('./assistant-protocol.contract.json');
const policy = require('./assistant-policy.json');

const ALLOWED_TYPES = new Set(contract.action.allowed_types);
const ALLOWED_RISKS = new Set(contract.action.risks);
const FORBIDDEN_FIELDS = new Set(
  contract.action.forbidden_fields.map(value => String(value).toLowerCase())
);

function hasForbiddenPolicyField(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasForbiddenPolicyField);
  return Object.entries(value).some(([key, child]) =>
    FORBIDDEN_FIELDS.has(String(key).toLowerCase()) ||
    hasForbiddenPolicyField(child)
  );
}

function policyDecisionBase() {
  return {
    policy_id:policy.policy_id,
    policy_version:policy.policy_version,
    schema_version:policy.schema_version,
    decision:'allow',
    code:null,
    requires_confirmation:false,
    matched_rules:[],
    execution_authorized:false,
    auto_execute:false,
    authorization_source:false
  };
}

function deny(decision, ruleId, code) {
  decision.decision='deny';
  decision.code=code;
  decision.matched_rules.push(ruleId);
  return decision;
}

function evaluateAssistantActionPolicy(action = {}) {
  const decision=policyDecisionBase();
  const type=String(action.type || '').trim();
  const risk=String(action.risk || 'low').trim();

  if (!ALLOWED_TYPES.has(type)) {
    return deny(decision,'allow_registered_action_types_only','UNSUPPORTED_ACTION_TYPE');
  }

  if (!ALLOWED_RISKS.has(risk)) {
    return deny(decision,'allow_registered_risks_only','INVALID_ACTION_RISK');
  }

  if (hasForbiddenPolicyField(action)) {
    return deny(decision,'forbid_executable_payload_fields','FORBIDDEN_EXECUTION_FIELD');
  }

  if (['high','critical'].includes(risk)) {
    decision.requires_confirmation=true;
    decision.matched_rules.push('high_risk_requires_confirmation');
  }

  if (action.requires_confirmation === true) {
    decision.requires_confirmation=true;
    decision.matched_rules.push('explicit_confirmation_is_preserved');
  }

  return decision;
}

function publicAssistantPolicyDescriptor() {
  return {
    policy_id:policy.policy_id,
    policy_version:policy.policy_version,
    schema_version:policy.schema_version,
    rules:policy.rules.map(rule=>({
      id:rule.id,
      effect:rule.effect,
      code:rule.code || null
    })),
    invariants:{
      deterministic:true,
      execution_authorized:false,
      auto_execute:false,
      authorization_source:false,
      model_generated_policy:false
    }
  };
}

module.exports={
  policy,
  evaluateAssistantActionPolicy,
  publicAssistantPolicyDescriptor,
  hasForbiddenPolicyField
};
