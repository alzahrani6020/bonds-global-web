'use strict';

const { normalizeProviderId } = require('./providers/provider-contract');

function cleanId(value) {
  return String(value || '').trim();
}

function normalizeModelDescriptor(input = {}) {
  const modelId = cleanId(input.model_id || input.id);
  const providerId = normalizeProviderId(input.provider_id || input.providerId);
  if (!modelId) throw new Error('MODEL_ID_REQUIRED');
  if (!providerId) throw new Error('MODEL_PROVIDER_REQUIRED');

  return Object.freeze({
    model_id:modelId,
    provider_id:providerId,
    runtime_model:cleanId(input.runtime_model || input.runtimeModel || modelId),
    enabled:input.enabled !== false,
    supports_tools:input.supports_tools === true,
    supports_json:input.supports_json === true,
    supports_vision:input.supports_vision === true,
    supports_embeddings:input.supports_embeddings === true,
    privacy_class:cleanId(input.privacy_class || 'unspecified') || 'unspecified',
    context_window:Number.isFinite(Number(input.context_window)) ? Number(input.context_window) : null,
    metadata:Object.freeze({ ...(input.metadata || {}) })
  });
}

class ModelRegistry {
  constructor(seed = []) {
    this.models = new Map();
    for (const descriptor of seed) this.register(descriptor);
  }

  register(descriptor) {
    const normalized = normalizeModelDescriptor(descriptor);
    if (this.models.has(normalized.model_id)) {
      throw new Error('MODEL_ALREADY_REGISTERED');
    }
    this.models.set(normalized.model_id, normalized);
    return normalized;
  }

  get(modelId) {
    return this.models.get(cleanId(modelId)) || null;
  }

  list({ providerId = null, enabledOnly = false } = {}) {
    const normalizedProvider = providerId ? normalizeProviderId(providerId) : null;
    return [...this.models.values()]
      .filter(model => !normalizedProvider || model.provider_id === normalizedProvider)
      .filter(model => !enabledOnly || model.enabled)
      .sort((a, b) => a.model_id.localeCompare(b.model_id));
  }
}

const defaultModelRegistry = new ModelRegistry([
  {
    model_id:'bonds-native',
    provider_id:'BONDS_NATIVE',
    runtime_model:'bonds-native',
    enabled:true,
    supports_json:true,
    privacy_class:'private'
  }
]);

module.exports = {
  ModelRegistry,
  defaultModelRegistry,
  normalizeModelDescriptor
};
