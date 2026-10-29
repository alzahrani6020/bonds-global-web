'use strict';

const {
  listCapabilities,
  getCapability,
  getActionDescriptor
} = require('./bonds-capability-registry');
const {
  defaultModelRegistry,
  normalizeModelDescriptor
} = require('../ai/model-registry');
const {
  executeGovernedAction
} = require('../services/service-execution-router');

const MUTATING_EFFECTS = new Set(['database_write', 'network_write']);
const DEFAULT_HIDDEN_ACTIONS = new Set(['ai_reason', 'native_generate', 'native_health']);

const TERM_ALIASES = Object.freeze({
  'تمويل':['funding','credit','debt'],
  'تمويلي':['funding','credit'],
  'قرض':['credit','debt','funding'],
  'ائتمان':['credit','risk'],
  'مخاطر':['risk','credit'],
  'جدوى':['feasibility'],
  'تقييم':['valuation'],
  'قيمة':['valuation'],
  'تدفق':['cash','flow'],
  'سيولة':['liquidity','treasury','cash'],
  'محاسبة':['accounting'],
  'محاسبي':['accounting'],
  'ميزانية':['budget','planning'],
  'موازنة':['budget','planning'],
  'قوائم':['financial','statements'],
  'تسوية':['reconciliation'],
  'بنك':['bank'],
  'ضريبة':['tax'],
  'زكاة':['zakat'],
  'مستند':['document'],
  'وثيقة':['document'],
  'ملف':['document','file'],
  'بحث':['search','research'],
  'موقع':['site','web'],
  'مشروع':['project'],
  'نموذج':['form'],
  'حاسبة':['calculator'],
  'حساب':['calculator','analysis'],
  'تنقل':['navigate','site']
});

function cleanText(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function tokens(value) {
  return cleanText(value)
    .replace(/[_\-./:]+/g, ' ')
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function expandedTokens(value) {
  const base = tokens(value);
  const out = new Set(base);
  for (const token of base) {
    for (const alias of TERM_ALIASES[token] || []) out.add(alias);
  }
  return [...out];
}

function normalizedModel(model, registry = defaultModelRegistry) {
  if (!model) return null;
  if (typeof model === 'string') return registry.get(model);
  if (typeof model === 'object' && !Array.isArray(model)) {
    try { return normalizeModelDescriptor(model); }
    catch (_) { return null; }
  }
  return null;
}

function capabilityCompatibility(capabilityOrAction, {
  model = null,
  modelRegistry = defaultModelRegistry
} = {}) {
  const capability = typeof capabilityOrAction === 'string'
    ? getCapability(capabilityOrAction)
    : capabilityOrAction;

  if (!capability) {
    return { compatible:false, code:'UNKNOWN_CAPABILITY', mode:null };
  }

  if (capability.active === false) {
    return { compatible:false, code:'CAPABILITY_DISABLED', mode:null };
  }

  if (!model) {
    return {
      compatible:true,
      code:null,
      mode:'structured_action',
      model_id:null,
      provider_id:null
    };
  }

  const descriptor = normalizedModel(model, modelRegistry);
  if (!descriptor) {
    return { compatible:false, code:'MODEL_NOT_REGISTERED', mode:null };
  }

  if (descriptor.enabled === false) {
    return {
      compatible:false,
      code:'MODEL_DISABLED',
      mode:null,
      model_id:descriptor.model_id,
      provider_id:descriptor.provider_id
    };
  }

  if (descriptor.supports_tools === true) {
    return {
      compatible:true,
      code:null,
      mode:'native_tool',
      model_id:descriptor.model_id,
      provider_id:descriptor.provider_id
    };
  }

  if (descriptor.supports_json === true) {
    return {
      compatible:true,
      code:null,
      mode:'structured_action',
      model_id:descriptor.model_id,
      provider_id:descriptor.provider_id
    };
  }

  return {
    compatible:false,
    code:'MODEL_TOOL_PROTOCOL_UNSUPPORTED',
    mode:null,
    model_id:descriptor.model_id,
    provider_id:descriptor.provider_id
  };
}

function describeCapability(action, options = {}) {
  const capability = getCapability(action);
  if (!capability) return null;

  const descriptor = getActionDescriptor(action);
  const compatibility = capabilityCompatibility(capability, options);
  const sideEffect = capability.sideEffect || 'none';

  return {
    action:String(action || '').trim(),
    capability_id:capability.id || null,
    purpose:capability.purpose || null,
    action_type:descriptor?.actionType || null,
    service_code:capability.serviceCode || null,
    runtime_adapter:capability.runtime?.adapter || null,
    side_effect:sideEffect,
    active:capability.active !== false,
    required:Array.isArray(capability.required) ? [...capability.required] : [],
    required_any:Array.isArray(capability.requiredAny)
      ? capability.requiredAny.map(group => Array.isArray(group) ? [...group] : [])
      : [],
    confirmation_required:MUTATING_EFFECTS.has(sideEffect),
    compatibility
  };
}

function discoveryScore(queryTerms, capability) {
  if (!queryTerms.length) return 0;

  const descriptor = describeCapability(capability.action);
  const haystack = new Set([
    ...tokens(capability.action),
    ...tokens(capability.purpose || ''),
    ...tokens(capability.serviceCode || ''),
    ...tokens(descriptor?.action_type || ''),
    ...(Array.isArray(capability.required) ? capability.required.flatMap(tokens) : [])
  ]);

  let score = 0;
  for (const term of queryTerms) {
    if (haystack.has(term)) score += 12;
    else {
      for (const candidate of haystack) {
        if (
          term.length >= 4 &&
          candidate.length >= 4 &&
          (candidate.includes(term) || term.includes(candidate))
        ) {
          score += 4;
          break;
        }
      }
    }
  }

  const normalizedQuery = queryTerms.join(' ');
  const actionPhrase = tokens(capability.action).join(' ');
  if (actionPhrase && normalizedQuery.includes(actionPhrase)) score += 40;

  return score;
}

function discoverCapabilities({
  query = '',
  model = null,
  modelRegistry = defaultModelRegistry,
  limit = 24,
  includeMutating = true,
  excludedActions = [],
  hiddenActions = DEFAULT_HIDDEN_ACTIONS,
  serviceCodes = null,
  actionTypes = null
} = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 120));
  const excluded = new Set((excludedActions || []).map(value => String(value || '').trim()));
  const hidden = hiddenActions instanceof Set
    ? hiddenActions
    : new Set((hiddenActions || []).map(value => String(value || '').trim()));
  const serviceFilter = Array.isArray(serviceCodes) && serviceCodes.length
    ? new Set(serviceCodes.map(value => String(value || '').trim()))
    : null;
  const actionTypeFilter = Array.isArray(actionTypes) && actionTypes.length
    ? new Set(actionTypes.map(value => String(value || '').trim().toLowerCase()))
    : null;

  const queryTerms = expandedTokens(query);
  const candidates = listCapabilities()
    .filter(capability => capability.active !== false)
    .filter(capability => !excluded.has(capability.action))
    .filter(capability => !hidden.has(capability.action))
    .filter(capability => includeMutating || !MUTATING_EFFECTS.has(capability.sideEffect || 'none'))
    .filter(capability => !serviceFilter || serviceFilter.has(capability.serviceCode || ''))
    .filter(capability => {
      if (!actionTypeFilter) return true;
      const descriptor = getActionDescriptor(capability.action);
      return actionTypeFilter.has(String(descriptor?.actionType || '').toLowerCase());
    })
    .map(capability => {
      const compatibility = capabilityCompatibility(capability, { model, modelRegistry });
      return {
        capability,
        compatibility,
        score:discoveryScore(queryTerms, capability)
      };
    })
    .filter(row => row.compatibility.compatible === true);

  const positive = candidates.filter(row => row.score > 0);
  const selected = (positive.length ? positive : candidates)
    .sort((a, b) => (b.score - a.score) || a.capability.action.localeCompare(b.capability.action))
    .slice(0, safeLimit);

  return {
    query:String(query || ''),
    fallback:positive.length === 0,
    total_eligible:candidates.length,
    returned:selected.length,
    capabilities:selected.map(row => ({
      ...describeCapability(row.capability.action, { model, modelRegistry }),
      discovery_score:row.score
    }))
  };
}

async function invokeCapability({
  action,
  input = {},
  req,
  user,
  supabase,
  requestId = null,
  runtimeContext = {}
} = {}) {
  if (!req || !req.headers) {
    return {
      ok:false,
      executed:false,
      httpStatus:500,
      error:{ code:'CAPABILITY_GATEWAY_REQUEST_CONTEXT_REQUIRED' }
    };
  }

  return executeGovernedAction({
    action,
    input,
    req,
    user,
    supabase,
    requestId,
    runtimeContext
  });
}

class UniversalCapabilityGateway {
  constructor({ modelRegistry = defaultModelRegistry } = {}) {
    this.modelRegistry = modelRegistry;
  }

  describe(action, options = {}) {
    return describeCapability(action, {
      ...options,
      modelRegistry:this.modelRegistry
    });
  }

  compatible(action, options = {}) {
    return capabilityCompatibility(action, {
      ...options,
      modelRegistry:this.modelRegistry
    });
  }

  discover(options = {}) {
    return discoverCapabilities({
      ...options,
      modelRegistry:this.modelRegistry
    });
  }

  invoke(request = {}) {
    return invokeCapability(request);
  }
}

module.exports = {
  DEFAULT_HIDDEN_ACTIONS,
  UniversalCapabilityGateway,
  capabilityCompatibility,
  describeCapability,
  discoverCapabilities,
  invokeCapability,
  expandedTokens
};
