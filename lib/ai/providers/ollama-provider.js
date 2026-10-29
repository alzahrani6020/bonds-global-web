'use strict';

const { validateProviderContract } = require('./provider-contract');

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanBaseUrl(value) {
  return String(value || 'http://127.0.0.1:11434').trim().replace(/\/$/, '');
}

class OllamaInferenceProvider {
  constructor({
    baseUrl = process.env.BONDS_OLLAMA_URL || 'http://127.0.0.1:11434',
    model = process.env.BONDS_OLLAMA_MODEL || '',
    timeoutMs = process.env.BONDS_OLLAMA_TIMEOUT_MS || 120000,
    headers = {}
  } = {}) {
    this.providerId = 'OLLAMA';
    this.baseUrl = cleanBaseUrl(baseUrl);
    this.model = String(model || '').trim();
    this.timeoutMs = positiveInt(timeoutMs, 120000);
    this.headers = { ...headers };

    const contract = validateProviderContract(this, { providerId:this.providerId });
    if (!contract.valid) throw new Error(contract.code);
  }

  async request(path, { method = 'GET', body = null } = {}) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal:controller.signal,
        headers:{
          'content-type':'application/json',
          ...this.headers
        },
        ...(body === null ? {} : { body:JSON.stringify(body) })
      });

      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw:text }; }

      if (!response.ok) {
        return {
          ok:false,
          executed:true,
          error:{
            code:'OLLAMA_RUNTIME_HTTP_ERROR',
            status:response.status,
            detail:data,
            elapsed_ms:Date.now() - startedAt
          }
        };
      }

      return {
        ok:true,
        executed:true,
        result:data,
        meta:{ elapsed_ms:Date.now() - startedAt }
      };
    } catch (error) {
      return {
        ok:false,
        executed:false,
        error:{
          code:error?.name === 'AbortError' ? 'OLLAMA_RUNTIME_TIMEOUT' : 'OLLAMA_RUNTIME_UNAVAILABLE',
          message:error?.message || String(error),
          elapsed_ms:Date.now() - startedAt
        }
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async health() {
    const response = await this.request('/api/tags');
    if (!response.ok) return response;

    const models = Array.isArray(response.result?.models)
      ? response.result.models.map(item => String(item?.name || item?.model || '').trim()).filter(Boolean)
      : [];

    return {
      ...response,
      result:{
        status:'ok',
        configured_model:this.model || null,
        model_available:this.model ? models.includes(this.model) : null,
        models
      }
    };
  }

  async generate(prompt, options = {}) {
    const model = String(options.model || this.model || '').trim();
    if (!model) {
      return {
        ok:false,
        executed:false,
        error:{ code:'OLLAMA_MODEL_REQUIRED' }
      };
    }

    const response = await this.request('/api/generate', {
      method:'POST',
      body:{
        model,
        prompt:String(prompt || ''),
        stream:false,
        options:{
          ...(Number.isFinite(Number(options.temperature)) ? { temperature:Number(options.temperature) } : {}),
          ...(Number.isFinite(Number(options.max_tokens)) ? { num_predict:Number(options.max_tokens) } : {}),
          ...(Number.isFinite(Number(options.n_ctx)) ? { num_ctx:Number(options.n_ctx) } : {}),
          ...(Number.isFinite(Number(options.n_threads)) ? { num_thread:Number(options.n_threads) } : {}),
          ...(Number.isFinite(Number(options.n_gpu_layers)) ? { num_gpu:Number(options.n_gpu_layers) } : {})
        }
      }
    });

    if (!response.ok) return response;

    const body = response.result || {};
    return {
      ok:true,
      executed:true,
      result:{
        text:String(body.response || ''),
        model:body.model || model,
        finish_reason:body.done_reason || (body.done === true ? 'stop' : null),
        completion_tokens:Number.isFinite(Number(body.eval_count)) ? Number(body.eval_count) : null,
        usage:{
          prompt_tokens:Number.isFinite(Number(body.prompt_eval_count)) ? Number(body.prompt_eval_count) : null
        },
        runtime:'ollama'
      },
      meta:{
        ...(response.meta || {}),
        provider_id:this.providerId
      }
    };
  }
}

module.exports = {
  OllamaInferenceProvider,
  cleanBaseUrl
};
