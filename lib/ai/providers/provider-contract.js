'use strict';

const REQUIRED_PROVIDER_METHODS = Object.freeze(['health', 'generate']);

function normalizeProviderId(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
}

function validateProviderContract(provider, { providerId = null } = {}) {
  if (!provider || typeof provider !== 'object') {
    return { valid:false, code:'INFERENCE_PROVIDER_INVALID', missing:[...REQUIRED_PROVIDER_METHODS] };
  }

  const missing = REQUIRED_PROVIDER_METHODS.filter(method => typeof provider[method] !== 'function');
  if (missing.length) {
    return { valid:false, code:'INFERENCE_PROVIDER_CONTRACT_INVALID', missing };
  }

  return {
    valid:true,
    code:null,
    missing:[],
    provider_id: normalizeProviderId(providerId || provider.providerId || provider.id || provider.constructor?.name || 'provider')
  };
}

module.exports = {
  REQUIRED_PROVIDER_METHODS,
  normalizeProviderId,
  validateProviderContract
};
