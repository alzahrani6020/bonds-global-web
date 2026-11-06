'use strict';

const { defaultModelRegistry } = require('./model-registry');

const RISK_LEVELS = Object.freeze(['low', 'medium', 'high', 'critical', 'restricted']);
const RISK_RANK = Object.freeze(Object.fromEntries(RISK_LEVELS.map((level, index) => [level, index + 1])));

function cleanId(value) {
  return String(value || '').trim();
}

function normalizeRisk(value, fallback = 'low') {
  const normalized = cleanId(value).toLowerCase();
  return RISK_RANK[normalized] ? normalized : fallback;
}

function normalizeStringList(value) {
  return Object.freeze(
    [...new Set((Array.isArray(value) ? value : [])
      .map(item => cleanId(item))
      .filter(Boolean))]
      .sort()
  );
}

function normalizePassport(input = {}) {
  const modelId = cleanId(input.model_id || input.modelId);
  if (!modelId) throw new Error('MODEL_CAPABILITY_PASSPORT_MODEL_REQUIRED');

  return Object.freeze({
    model_id:modelId,
    enabled:input.enabled !== false,
    certification_level:cleanId(input.certification_level || input.certificationLevel || 'baseline') || 'baseline',
    max_risk:normalizeRisk(input.max_risk || input.maxRisk || 'low'),
    allowed_actions:normalizeStringList(input.allowed_actions || input.allowedActions),
    denied_actions:normalizeStringList(input.denied_actions || input.deniedActions),
    allowed_action_types:normalizeStringList(input.allowed_action_types || input.allowedActionTypes),
    allowed_side_effects:normalizeStringList(input.allowed_side_effects || input.allowedSideEffects),
    metadata:Object.freeze({ ...(input.metadata || {}) })
  });
}

class ModelCapabilityPassportRegistry {
  constructor(seed = []) {
    this.passports = new Map();
    for (const passport of seed) this.register(passport);
  }

  register(passport) {
    const normalized = normalizePassport(passport);
    if (this.passports.has(normalized.model_id)) {
      throw new Error('MODEL_CAPABILITY_PASSPORT_ALREADY_REGISTERED');
    }
    this.passports.set(normalized.model_id, normalized);
    return normalized;
  }

  get(modelId) {
    return this.passports.get(cleanId(modelId)) || null;
  }

  list({ enabledOnly = false } = {}) {
    return [...this.passports.values()]
      .filter(passport => !enabledOnly || passport.enabled)
      .sort((a, b) => a.model_id.localeCompare(b.model_id));
  }
}

function validatePassportForModel(passportOrModelId, {
  passportRegistry,
  modelRegistry = defaultModelRegistry
} = {}) {
  const passport = typeof passportOrModelId === 'string'
    ? passportRegistry?.get(passportOrModelId)
    : passportOrModelId;

  if (!passport) {
    return { valid:false, code:'MODEL_CAPABILITY_PASSPORT_NOT_FOUND', passport:null, model:null };
  }

  const model = modelRegistry.get(passport.model_id);
  if (!model) {
    return { valid:false, code:'MODEL_NOT_REGISTERED', passport, model:null };
  }
  if (model.enabled === false) {
    return { valid:false, code:'MODEL_DISABLED', passport, model };
  }
  if (passport.enabled === false) {
    return { valid:false, code:'MODEL_CAPABILITY_PASSPORT_DISABLED', passport, model };
  }

  return { valid:true, code:null, passport, model };
}

const defaultModelCapabilityPassportRegistry = new ModelCapabilityPassportRegistry([
  {
    model_id:'bonds-native',
    certification_level:'production',
    max_risk:'high',
    enabled:true
  }
]);

module.exports = {
  RISK_LEVELS,
  RISK_RANK,
  ModelCapabilityPassportRegistry,
  defaultModelCapabilityPassportRegistry,
  normalizePassport,
  normalizeRisk,
  validatePassportForModel
};
