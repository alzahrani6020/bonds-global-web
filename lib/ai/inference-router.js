'use strict';

class NativeInferenceProvider {
  constructor({ baseUrl, token = null, timeoutMs = 300000, accessHeaders = {} } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.accessHeaders = { ...accessHeaders };
    if (!this.baseUrl) throw new Error('Bonds native inference URL is required');
  }

  async request(path, body = null, method = 'POST') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...this.accessHeaders,
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        },
        ...(body === null ? {} : { body: JSON.stringify(body) })
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
      if (!response.ok) {
        return { ok: false, executed: true, error: { code: 'NATIVE_RUNTIME_HTTP_ERROR', status: response.status, detail: data } };
      }
      return { ok: true, executed: true, result: data };
    } catch (err) {
      return { ok: false, executed: false, error: { code: err.name === 'AbortError' ? 'NATIVE_RUNTIME_TIMEOUT' : 'NATIVE_RUNTIME_UNAVAILABLE', message: err.message } };
    } finally {
      clearTimeout(timer);
    }
  }

  health() { return this.request('/health', null, 'GET'); }
  generate(prompt, options = {}) {
    return this.request('/generate', {
      prompt,
      context: options.context || {},
      options: {
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        n_ctx: options.n_ctx,
        n_threads: options.n_threads,
        n_gpu_layers: options.n_gpu_layers
      }
    });
  }
}

class InferenceRouter {
  constructor(options = {}) {
    const localUrl = options.localUrl || process.env.BONDS_NATIVE_LOCAL_URL || 'http://127.0.0.1:8765';
    const remoteUrl = options.remoteUrl || process.env.BONDS_NATIVE_REMOTE_URL || '';
    const token = options.token || process.env.BONDS_NATIVE_TOKEN || null;
    const timeoutMs = Number(options.timeoutMs || process.env.BONDS_NATIVE_TIMEOUT_MS || 20000);
    const cfAccessClientId = options.cfAccessClientId || process.env.BONDS_CF_ACCESS_CLIENT_ID || '';
    const cfAccessClientSecret = options.cfAccessClientSecret || process.env.BONDS_CF_ACCESS_CLIENT_SECRET || '';
    if (Boolean(cfAccessClientId) !== Boolean(cfAccessClientSecret)) {
      throw new Error('Cloudflare Access requires both BONDS_CF_ACCESS_CLIENT_ID and BONDS_CF_ACCESS_CLIENT_SECRET');
    }
    const remoteAccessHeaders = cfAccessClientId ? {
      'CF-Access-Client-Id': cfAccessClientId,
      'CF-Access-Client-Secret': cfAccessClientSecret
    } : {};
    this.mode = String(options.mode || process.env.BONDS_INFERENCE_MODE || (remoteUrl ? 'REMOTE_BONDS_NATIVE' : 'LOCAL_NATIVE')).toUpperCase();
    this.providers = {
      LOCAL_NATIVE: new NativeInferenceProvider({ baseUrl: localUrl, token, timeoutMs }),
      ...(remoteUrl ? { REMOTE_BONDS_NATIVE: new NativeInferenceProvider({ baseUrl: remoteUrl, token, timeoutMs, accessHeaders: remoteAccessHeaders }) } : {})
    };
  }

  provider() {
    const provider = this.providers[this.mode];
    if (!provider) throw new Error(`Inference mode ${this.mode} is not configured`);
    return provider;
  }

  async health() {
    const response = await this.provider().health();
    return { ...response, mode: this.mode, provider: 'BondsNativeProvider', external_llm_provider: false };
  }

  async generate(prompt, options = {}) {
    const response = await this.provider().generate(prompt, options);
    return { ...response, mode: this.mode, provider: 'BondsNativeProvider', external_llm_provider: false };
  }
}

function getInferenceRouter(options = {}) {
  return new InferenceRouter(options);
}

module.exports = { NativeInferenceProvider, InferenceRouter, getInferenceRouter };
