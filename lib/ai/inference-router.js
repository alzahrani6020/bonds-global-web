'use strict';

const {
  recordLatencyObservation,
  rankNodesByLatency,
  latencyRoutingMetadata
} = require('./latency-aware-routing');

function parseRemoteUrls(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  return values
    .map((item) => String(item || '').trim().replace(/\/$/, ''))
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nativeRuntimeErrorCode(response) {
  return String(response?.error?.detail?.error?.code || '').trim().toUpperCase();
}

function recoverableNativeGenerateFailure(response) {
  if (!response || response.ok === true) return false;
  if (Number(response?.error?.status) !== 503) return false;
  return ['NATIVE_RUNTIME_BUSY', 'NATIVE_INFERENCE_ERROR']
    .includes(nativeRuntimeErrorCode(response));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class NativeInferenceProvider {
  constructor({ baseUrl, token = null, timeoutMs = 300000, accessHeaders = {} } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.accessHeaders = { ...accessHeaders };
    if (!this.baseUrl) throw new Error('Bonds native inference URL is required');
  }

  async request(path, body = null, method = 'POST') {
    const startedAt = Date.now();
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
        return {
          ok: false,
          executed: true,
          error: {
            code: 'NATIVE_RUNTIME_HTTP_ERROR',
            status: response.status,
            detail: data,
            elapsed_ms: Date.now() - startedAt
          }
        };
      }
      return { ok: true, executed: true, result: data, meta: { elapsed_ms: Date.now() - startedAt } };
    } catch (err) {
      return {
        ok: false,
        executed: false,
        error: {
          code: err.name === 'AbortError' ? 'NATIVE_RUNTIME_TIMEOUT' : 'NATIVE_RUNTIME_UNAVAILABLE',
          message: err.message,
          elapsed_ms: Date.now() - startedAt
        }
      };
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
    const legacyRemoteUrl = options.remoteUrl || process.env.BONDS_NATIVE_REMOTE_URL || '';
    const configuredRemoteUrls =
      options.remoteUrls ??
      process.env.BONDS_NATIVE_REMOTE_URLS ??
      process.env.BONDS_NATIVE_NODES ??
      '';
    const remoteUrls = parseRemoteUrls(configuredRemoteUrls);
    if (remoteUrls.length === 0 && legacyRemoteUrl) remoteUrls.push(String(legacyRemoteUrl).replace(/\/$/, ''));

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

    this.mode = String(
      options.mode ||
      process.env.BONDS_INFERENCE_MODE ||
      (remoteUrls.length ? 'REMOTE_BONDS_NATIVE' : 'LOCAL_NATIVE')
    ).toUpperCase();

    this.breakerFailureThreshold = positiveInt(
      options.breakerFailureThreshold ?? process.env.BONDS_NATIVE_BREAKER_FAILURE_THRESHOLD,
      3
    );
    this.breakerCooldownMs = positiveInt(
      options.breakerCooldownMs ?? process.env.BONDS_NATIVE_BREAKER_COOLDOWN_MS,
      60000
    );
    this.latencyAwareRouting = options.latencyAwareRouting === true ||
      String(process.env.BONDS_NATIVE_LATENCY_AWARE_ROUTING || '').toLowerCase() === 'true';
    this.latencyObservationStaleMs = positiveInt(
      options.latencyObservationStaleMs ?? process.env.BONDS_NATIVE_LATENCY_STALE_MS,
      300000
    );
    this.recoverableGenerateRetries = Math.max(
      0,
      Math.min(
        2,
        Number.parseInt(
          options.recoverableGenerateRetries ??
          process.env.BONDS_NATIVE_RECOVERABLE_GENERATE_RETRIES ??
          '1',
          10
        ) || 0
      )
    );
    this.recoverableGenerateRetryDelayMs = Math.max(
      0,
      Math.min(
        5000,
        Number.parseInt(
          options.recoverableGenerateRetryDelayMs ??
          process.env.BONDS_NATIVE_RECOVERABLE_RETRY_DELAY_MS ??
          '750',
          10
        ) || 0
      )
    );

    this.localProvider = new NativeInferenceProvider({ baseUrl: localUrl, token, timeoutMs });
    this.remoteProviders = remoteUrls.map((baseUrl, index) => ({
      id: `native-${index + 1}`,
      baseUrl,
      provider: new NativeInferenceProvider({
        baseUrl,
        token,
        timeoutMs,
        accessHeaders: remoteAccessHeaders
      })
    }));
    this.breakers = new Map();

    // Keep the historical provider map for callers that use provider() directly.
    this.providers = {
      LOCAL_NATIVE: this.localProvider,
      ...(this.remoteProviders[0] ? { REMOTE_BONDS_NATIVE: this.remoteProviders[0].provider } : {})
    };
  }

  provider() {
    const provider = this.providers[this.mode];
    if (!provider) throw new Error(`Inference mode ${this.mode} is not configured`);
    return provider;
  }

  _breaker(node) {
    if (!this.breakers.has(node.id)) {
      this.breakers.set(node.id, { failures: 0, openUntil: 0 });
    }
    return this.breakers.get(node.id);
  }

  _candidateRemoteProviders(method = 'generate', now = Date.now()) {
    if (!this.remoteProviders.length) {
      throw new Error('REMOTE_BONDS_NATIVE is configured without any remote native node');
    }

    const closed = this.remoteProviders.filter((node) => this._breaker(node).openUntil <= now);
    if (closed.length) {
      return rankNodesByLatency(closed, {
        enabled: this.latencyAwareRouting,
        now,
        staleAfterMs: this.latencyObservationStaleMs,
        operation: method
      });
    }

    // If every circuit is open, probe the node whose cooldown expires first.
    return [...this.remoteProviders].sort(
      (a, b) => this._breaker(a).openUntil - this._breaker(b).openUntil
    ).slice(0, 1);
  }

  _recordSuccess(node) {
    const breaker = this._breaker(node);
    breaker.failures = 0;
    breaker.openUntil = 0;
  }

  _recordFailure(node) {
    const breaker = this._breaker(node);
    breaker.failures += 1;
    if (breaker.failures >= this.breakerFailureThreshold) {
      breaker.openUntil = Date.now() + this.breakerCooldownMs;
    }
  }

  _isNodeFailure(response) {
    if (!response || response.ok) return false;
    if (response.executed === false) return true;
    const status = Number(response.error && response.error.status);
    return Number.isFinite(status) && status >= 500;
  }

  _decorateRemoteResponse(response, node, attempts, operation = 'generate') {
    return {
      ...response,
      meta: {
        ...(response && response.meta ? response.meta : {}),
        native_node: node ? node.id : null,
        native_node_url: node ? node.baseUrl : null,
        failover_attempts: attempts,
        latency_routing: node ? latencyRoutingMetadata(node, {
          enabled: this.latencyAwareRouting,
          staleAfterMs: this.latencyObservationStaleMs,
          operation
        }) : {
          enabled: this.latencyAwareRouting,
          observed: false,
          ewma_ms: null,
          last_ms: null,
          samples: 0,
          operation
        }
      }
    };
  }

  async _runRemote(method, args = []) {
    const candidates = this._candidateRemoteProviders(method);
    const attempts = [];
    let lastResponse = null;
    let lastNode = null;

    for (const node of candidates) {
      const nodeAttempts = method === 'generate'
        ? this.recoverableGenerateRetries + 1
        : 1;
      let response = null;

      for (let nodeAttempt = 1; nodeAttempt <= nodeAttempts; nodeAttempt += 1) {
        response = await node.provider[method](...args);
        lastResponse = response;
        lastNode = node;
        attempts.push({
          node: node.id,
          node_attempt: nodeAttempt,
          ok: response.ok === true,
          error_code: response.error ? response.error.code : null,
          runtime_error_code: nativeRuntimeErrorCode(response) || null,
          http_status: response.error ? response.error.status || null : null
        });

        if (response.ok) {
          this._recordSuccess(node);
          const elapsedMs = Number(response?.meta?.elapsed_ms);
          if (this.latencyAwareRouting && Number.isFinite(elapsedMs) && elapsedMs >= 0) {
            recordLatencyObservation(node, elapsedMs, { operation: method });
          }
          return this._decorateRemoteResponse(response, node, attempts, method);
        }

        const canRetrySameNode =
          nodeAttempt < nodeAttempts &&
          recoverableNativeGenerateFailure(response);

        if (!canRetrySameNode) break;
        if (this.recoverableGenerateRetryDelayMs > 0) {
          await sleep(this.recoverableGenerateRetryDelayMs);
        }
      }

      if (this._isNodeFailure(response)) {
        this._recordFailure(node);
      }

      // A client/auth/request error was returned by a live node. Retrying the
      // same request on another node will not make the request valid.
      if (response?.executed === true && !this._isNodeFailure(response)) {
        break;
      }
    }

    return this._decorateRemoteResponse(
      lastResponse || {
        ok: false,
        executed: false,
        error: { code: 'NATIVE_RUNTIME_UNAVAILABLE', message: 'No native node was attempted' }
      },
      lastNode,
      attempts,
      method
    );
  }

  async health() {
    const response = this.mode === 'REMOTE_BONDS_NATIVE'
      ? await this._runRemote('health')
      : await this.provider().health();
    return { ...response, mode: this.mode, provider: 'BondsNativeProvider', external_llm_provider: false };
  }

  async generateAcrossRemoteNodes(prompt, options = {}, { limit = 3 } = {}) {
    if (this.mode !== 'REMOTE_BONDS_NATIVE') {
      return {
        ok:false,
        executed:false,
        results:[],
        error:{ code:'REMOTE_MULTI_NODE_REVIEW_UNAVAILABLE' },
        mode:this.mode,
        provider:'BondsNativeProvider',
        external_llm_provider:false
      };
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 3));
    const candidates = this._candidateRemoteProviders('generate').slice(0, safeLimit);

    const results = await Promise.all(candidates.map(async node => {
      const response = await node.provider.generate(prompt, options);
      if (response.ok) {
        this._recordSuccess(node);
        const elapsedMs = Number(response?.meta?.elapsed_ms);
        if (this.latencyAwareRouting && Number.isFinite(elapsedMs) && elapsedMs >= 0) {
          recordLatencyObservation(node, elapsedMs, { operation:'generate' });
        }
      } else if (this._isNodeFailure(response)) {
        this._recordFailure(node);
      }

      return this._decorateRemoteResponse(
        response,
        node,
        [{
          node:node.id,
          ok:response.ok === true,
          error_code:response.error ? response.error.code : null,
          http_status:response.error ? response.error.status || null : null
        }],
        'generate'
      );
    }));

    return {
      ok:results.some(item => item.ok === true),
      executed:results.some(item => item.executed !== false),
      results,
      mode:this.mode,
      provider:'BondsNativeProvider',
      external_llm_provider:false
    };
  }

  async generate(prompt, options = {}) {
    const response = this.mode === 'REMOTE_BONDS_NATIVE'
      ? await this._runRemote('generate', [prompt, options])
      : await this.provider().generate(prompt, options);
    return { ...response, mode: this.mode, provider: 'BondsNativeProvider', external_llm_provider: false };
  }
}

function getInferenceRouter(options = {}) {
  return new InferenceRouter(options);
}

module.exports = {
  NativeInferenceProvider,
  InferenceRouter,
  getInferenceRouter,
  parseRemoteUrls
};
