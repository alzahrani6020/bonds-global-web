'use strict';

const {
  defaultModelRegistry
} = require('./model-registry');
const {
  InferenceProviderRouter
} = require('./provider-router');

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function modelToProviderOptions(model, overrides = {}) {
  if (!model) throw new Error('RUNTIME_MODEL_DESCRIPTOR_REQUIRED');

  if (model.provider_id === 'BONDS_NATIVE') {
    return {
      ...overrides,
      providerId:'BONDS_NATIVE',
      nativeModelId:model.model_id,
      nativeRuntimeModel:model.runtime_model
    };
  }

  if (model.provider_id === 'OLLAMA') {
    return {
      ...overrides,
      providerId:'OLLAMA',
      ollamaModel:model.runtime_model,
      ollamaModelId:model.model_id
    };
  }

  throw new Error('RUNTIME_MODEL_PROVIDER_UNSUPPORTED:' + clean(model.provider_id));
}

class PersistentRuntimeModelRouting {
  constructor({
    lifecycleController,
    stateStore,
    modelRegistry = defaultModelRegistry,
    providerRouterClass = InferenceProviderRouter,
    providerOverrides = {}
  } = {}) {
    if (!lifecycleController) {
      throw new Error('RUNTIME_MODEL_LIFECYCLE_CONTROLLER_REQUIRED');
    }
    if (!stateStore || typeof stateStore.load !== 'function' || typeof stateStore.save !== 'function') {
      throw new Error('RUNTIME_MODEL_STATE_STORE_REQUIRED');
    }

    this.lifecycleController = lifecycleController;
    this.stateStore = stateStore;
    this.modelRegistry = modelRegistry;
    this.providerRouterClass = providerRouterClass;
    this.providerOverrides = { ...providerOverrides };
    this.revision = null;
    this.initialized = false;
  }

  async initialize() {
    const persisted = await this.stateStore.load();

    if (persisted) {
      this.lifecycleController.restorePersistentState(persisted.state);
      this.revision = persisted.revision;
    } else {
      const saved = await this.stateStore.save(
        this.lifecycleController.persistentState(),
        { expectedRevision:0 }
      );
      this.revision = saved.revision;
    }

    this.initialized = true;
    return Object.freeze({
      revision:this.revision,
      state:this.lifecycleController.snapshot()
    });
  }

  _assertInitialized() {
    if (!this.initialized) {
      throw new Error('RUNTIME_MODEL_ROUTING_NOT_INITIALIZED');
    }
  }

  async _mutate(method, ...args) {
    this._assertInitialized();

    if (typeof this.lifecycleController[method] !== 'function') {
      throw new Error('RUNTIME_MODEL_ROUTING_MUTATION_UNSUPPORTED');
    }

    const previousState = this.lifecycleController.persistentState();
    const previousRevision = this.revision;

    let result;
    try {
      result = this.lifecycleController[method](...args);
      const saved = await this.stateStore.save(
        this.lifecycleController.persistentState(),
        { expectedRevision:previousRevision }
      );
      this.revision = saved.revision;
      return Object.freeze({
        revision:this.revision,
        result
      });
    } catch (error) {
      try {
        const latest = await this.stateStore.load();
        if (latest) {
          this.lifecycleController.restorePersistentState(latest.state);
          this.revision = latest.revision;
        } else {
          this.lifecycleController.restorePersistentState(previousState);
          this.revision = previousRevision;
        }
      } catch (_) {
        try {
          this.lifecycleController.restorePersistentState(previousState);
        } catch (_) {
          // Preserve the original mutation/persistence error.
        }
        this.revision = previousRevision;
      }
      throw error;
    }
  }

  async startCanary(challengerModelId) {
    return this._mutate('startCanary', challengerModelId);
  }

  async recordOutcome(outcome) {
    return this._mutate('recordOutcome', outcome);
  }

  async advanceCanary(options) {
    return this._mutate('advanceCanary', options);
  }

  async promote(options) {
    return this._mutate('promote', options);
  }

  async rollback(options) {
    return this._mutate('rollback', options);
  }

  async rollbackChampion(options) {
    return this._mutate('rollbackChampion', options);
  }

  selection(requestKey) {
    this._assertInitialized();
    return this.lifecycleController.selectModel({
      request_key:requestKey
    });
  }

  createRouter({
    requestKey,
    providerOverrides = {}
  } = {}) {
    const selection = this.selection(requestKey);
    const model = this.modelRegistry.get(selection.model_id);

    if (!model || model.enabled === false) {
      throw new Error('RUNTIME_SELECTED_MODEL_NOT_AVAILABLE');
    }

    const options = modelToProviderOptions(model, {
      ...this.providerOverrides,
      ...providerOverrides
    });
    const router = new this.providerRouterClass(options);

    const identity = router.identity();
    if (identity.model_id !== model.model_id) {
      throw new Error('RUNTIME_ROUTER_MODEL_ID_MISMATCH');
    }

    return Object.freeze({
      selection,
      model,
      router,
      identity,
      revision:this.revision
    });
  }

  snapshot() {
    this._assertInitialized();
    return Object.freeze({
      revision:this.revision,
      state:this.lifecycleController.snapshot()
    });
  }
}

module.exports = {
  modelToProviderOptions,
  PersistentRuntimeModelRouting
};