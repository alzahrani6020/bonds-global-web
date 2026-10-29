'use strict';

const {
  NativeInferenceProvider
} = require('../../lib/ai/inference-router');
const {
  InferenceProviderRouter
} = require('../../lib/ai/provider-router');
const {
  OllamaInferenceProvider
} = require('../../lib/ai/providers/ollama-provider');
const {
  ModelRegistry,
  defaultModelRegistry
} = require('../../lib/ai/model-registry');
const {
  validateProviderContract
} = require('../../lib/ai/providers/provider-contract');

describe('dynamic AI provider foundation', () => {
  const originalProvider = process.env.BONDS_INFERENCE_PROVIDER;
  const originalRemoteUrls = process.env.BONDS_NATIVE_REMOTE_URLS;
  const originalRemoteUrl = process.env.BONDS_NATIVE_REMOTE_URL;
  const originalNodes = process.env.BONDS_NATIVE_NODES;
  const originalOllamaUrl = process.env.BONDS_OLLAMA_URL;
  const originalOllamaModel = process.env.BONDS_OLLAMA_MODEL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.BONDS_INFERENCE_PROVIDER;
    delete process.env.BONDS_NATIVE_REMOTE_URLS;
    delete process.env.BONDS_NATIVE_REMOTE_URL;
    delete process.env.BONDS_NATIVE_NODES;
    delete process.env.BONDS_OLLAMA_URL;
    delete process.env.BONDS_OLLAMA_MODEL;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    if (originalProvider === undefined) delete process.env.BONDS_INFERENCE_PROVIDER;
    else process.env.BONDS_INFERENCE_PROVIDER = originalProvider;
    if (originalRemoteUrls === undefined) delete process.env.BONDS_NATIVE_REMOTE_URLS;
    else process.env.BONDS_NATIVE_REMOTE_URLS = originalRemoteUrls;
    if (originalRemoteUrl === undefined) delete process.env.BONDS_NATIVE_REMOTE_URL;
    else process.env.BONDS_NATIVE_REMOTE_URL = originalRemoteUrl;
    if (originalNodes === undefined) delete process.env.BONDS_NATIVE_NODES;
    else process.env.BONDS_NATIVE_NODES = originalNodes;
    if (originalOllamaUrl === undefined) delete process.env.BONDS_OLLAMA_URL;
    else process.env.BONDS_OLLAMA_URL = originalOllamaUrl;
    if (originalOllamaModel === undefined) delete process.env.BONDS_OLLAMA_MODEL;
    else process.env.BONDS_OLLAMA_MODEL = originalOllamaModel;
    global.fetch = originalFetch;
  });

  test('keeps BONDS_NATIVE as the default provider and preserves local mode', () => {
    const router = new InferenceProviderRouter({
      localUrl:'http://127.0.0.1:8765',
      remoteUrls:[]
    });

    expect(router.providerId).toBe('BONDS_NATIVE');
    expect(router.mode).toBe('LOCAL_NATIVE');
    expect(router.provider()).toBeInstanceOf(NativeInferenceProvider);
    expect(router.ollamaProvider).toBeNull();
  });

  test('rejects unregistered inference providers fail-closed', () => {
    expect(() => new InferenceProviderRouter({ providerId:'invented-provider' }))
      .toThrow('Inference provider INVENTED_PROVIDER is not configured');
  });

  test('provider contract requires health and generate methods', () => {
    expect(validateProviderContract({ health() {}, generate() {} }, { providerId:'test' }))
      .toMatchObject({ valid:true, provider_id:'TEST' });
    expect(validateProviderContract({ health() {} }, { providerId:'test' }))
      .toMatchObject({
        valid:false,
        code:'INFERENCE_PROVIDER_CONTRACT_INVALID',
        missing:['generate']
      });
  });

  test('model registry is version-safe and rejects duplicate model ids', () => {
    const registry = new ModelRegistry();
    const model = registry.register({
      model_id:'qwen-local',
      provider_id:'ollama',
      runtime_model:'qwen3:8b',
      supports_json:true,
      supports_tools:true,
      privacy_class:'private'
    });

    expect(model.provider_id).toBe('OLLAMA');
    expect(registry.get('qwen-local')).toBe(model);
    expect(registry.list({ providerId:'OLLAMA', enabledOnly:true })).toHaveLength(1);
    expect(() => registry.register({
      model_id:'qwen-local',
      provider_id:'OLLAMA'
    })).toThrow('MODEL_ALREADY_REGISTERED');
    expect(defaultModelRegistry.get('bonds-native')).toMatchObject({
      provider_id:'BONDS_NATIVE',
      enabled:true
    });
  });

  test('routes to Ollama only when explicitly selected', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok:true,
        status:200,
        text:async () => JSON.stringify({
          models:[{ name:'qwen3:8b' }, { name:'deepseek-r1:7b' }]
        })
      })
      .mockResolvedValueOnce({
        ok:true,
        status:200,
        text:async () => JSON.stringify({
          model:'qwen3:8b',
          response:'{"mode":"answer","answer":"ok"}',
          done:true,
          done_reason:'stop',
          prompt_eval_count:24,
          eval_count:12
        })
      });

    const router = new InferenceProviderRouter({
      providerId:'OLLAMA',
      ollamaBaseUrl:'http://127.0.0.1:11434',
      ollamaModel:'qwen3:8b',
      ollamaTimeoutMs:5000
    });

    expect(router.mode).toBe('OLLAMA');
    expect(router.provider()).toBeInstanceOf(OllamaInferenceProvider);

    const health = await router.health();
    expect(health).toMatchObject({
      ok:true,
      mode:'OLLAMA',
      provider:'OllamaProvider',
      provider_id:'OLLAMA',
      external_llm_provider:false
    });
    expect(health.result).toMatchObject({
      status:'ok',
      configured_model:'qwen3:8b',
      model_available:true
    });
    expect(global.fetch.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/tags');

    const generated = await router.generate('hello', {
      max_tokens:80,
      temperature:0.05,
      n_ctx:4096
    });
    expect(generated).toMatchObject({
      ok:true,
      mode:'OLLAMA',
      provider:'OllamaProvider',
      provider_id:'OLLAMA',
      result:{
        text:'{"mode":"answer","answer":"ok"}',
        model:'qwen3:8b',
        finish_reason:'stop',
        completion_tokens:12,
        usage:{ prompt_tokens:24 },
        runtime:'ollama'
      }
    });

    const request = global.fetch.mock.calls[1];
    expect(request[0]).toBe('http://127.0.0.1:11434/api/generate');
    expect(request[1].method).toBe('POST');
    expect(JSON.parse(request[1].body)).toMatchObject({
      model:'qwen3:8b',
      prompt:'hello',
      stream:false,
      options:{
        num_predict:80,
        temperature:0.05,
        num_ctx:4096
      }
    });
  });

  test('Ollama fails closed when no model is configured', async () => {
    const provider = new OllamaInferenceProvider({
      baseUrl:'http://127.0.0.1:11434',
      model:''
    });
    const response = await provider.generate('hello');

    expect(response).toEqual({
      ok:false,
      executed:false,
      error:{ code:'OLLAMA_MODEL_REQUIRED' }
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});