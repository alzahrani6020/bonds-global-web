'use strict';

const {
  InferenceRouter: BondsNativeInferenceRouter
} = require('./inference-router');
const {
  OllamaInferenceProvider
} = require('./providers/ollama-provider');
const {
  normalizeProviderId
} = require('./providers/provider-contract');

const SUPPORTED_PROVIDER_IDS = Object.freeze([
  'BONDS_NATIVE',
  'OLLAMA'
]);

class InferenceProviderRouter {
  constructor(options = {}) {
    this.providerId = normalizeProviderId(
      options.providerId || process.env.BONDS_INFERENCE_PROVIDER || 'BONDS_NATIVE'
    ) || 'BONDS_NATIVE';

    if (!SUPPORTED_PROVIDER_IDS.includes(this.providerId)) {
      throw new Error(`Inference provider ${this.providerId} is not configured`);
    }

    if (this.providerId === 'BONDS_NATIVE') {
      this.delegate = new BondsNativeInferenceRouter(options);
      this.mode = this.delegate.mode;
      this.modelId = String(
        options.nativeModelId || 'bonds-native'
      ).trim() || 'bonds-native';
      this.runtimeModel = String(
        options.nativeRuntimeModel || 'bonds-native'
      ).trim() || 'bonds-native';
      return;
    }

    const ollamaModel = String(
      options.ollamaModel || process.env.BONDS_OLLAMA_MODEL || ''
    ).trim();
    this.runtimeModel = ollamaModel || null;
    this.modelId = String(
      options.ollamaModelId || process.env.BONDS_OLLAMA_MODEL_ID || ollamaModel || ''
    ).trim() || null;

    this.delegate = new OllamaInferenceProvider({
      baseUrl: options.ollamaBaseUrl || process.env.BONDS_OLLAMA_URL || 'http://127.0.0.1:11434',
      model: ollamaModel,
      timeoutMs: options.ollamaTimeoutMs || process.env.BONDS_OLLAMA_TIMEOUT_MS || 120000,
      headers: options.ollamaHeaders || {}
    });
    this.mode = 'OLLAMA';
  }

  provider() {
    if (this.providerId === 'BONDS_NATIVE') return this.delegate.provider();
    return this.delegate;
  }

  identity() {
    return Object.freeze({
      provider_id:this.providerId,
      model_id:this.modelId || null,
      runtime_model:this.runtimeModel || null,
      mode:this.mode
    });
  }

  _metadata() {
    return this.providerId === 'OLLAMA'
      ? {
          provider:'OllamaProvider',
          provider_id:'OLLAMA',
          external_llm_provider:false
        }
      : {
          provider_id:'BONDS_NATIVE'
        };
  }

  async health() {
    if (this.providerId === 'BONDS_NATIVE') {
      const response = await this.delegate.health();
      return {
        ...response,
        provider_id:'BONDS_NATIVE'
      };
    }

    const response = await this.delegate.health();
    return {
      ...response,
      mode:this.mode,
      ...this._metadata()
    };
  }

  async generate(prompt, options = {}) {
    if (this.providerId === 'BONDS_NATIVE') {
      const response = await this.delegate.generate(prompt, options);
      return {
        ...response,
        provider_id:'BONDS_NATIVE'
      };
    }

    const response = await this.delegate.generate(prompt, options);
    return {
      ...response,
      mode:this.mode,
      ...this._metadata()
    };
  }

  async generateAcrossRemoteNodes(prompt, options = {}, reviewOptions = {}) {
    if (this.providerId === 'BONDS_NATIVE') {
      const response = await this.delegate.generateAcrossRemoteNodes(prompt, options, reviewOptions);
      return {
        ...response,
        provider_id:'BONDS_NATIVE'
      };
    }

    return {
      ok:false,
      executed:false,
      results:[],
      error:{ code:'REMOTE_MULTI_NODE_REVIEW_UNAVAILABLE' },
      mode:this.mode,
      ...this._metadata()
    };
  }
}

function getInferenceRouter(options = {}) {
  return new InferenceProviderRouter(options);
}

module.exports = {
  SUPPORTED_PROVIDER_IDS,
  InferenceProviderRouter,
  getInferenceRouter
};