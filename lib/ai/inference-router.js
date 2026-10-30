'use strict';

const {
  recordLatencyObservation,
  rankNodesByLatency,
  latencyRoutingMetadata
} = require('./latency-aware-routing');
const {
  normalizePolicy:normalizeReliabilityPolicy,
  classifyNativeFailure,
  recordNativeOutcome,
  reliabilitySnapshot,
  rankNodesByReliability
} = require('./native-runtime-reliability');
const {
  createSupabaseNativeReliabilityHistoryStoreFromEnv
} = require('./native-reliability-history-store');

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
  return classifyNativeFailure(response).recoverable === true;
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
    this.reliabilityPolicy = normalizeReliabilityPolicy({
      min_samples:
        options.reliabilityMinSamples ??
        process.env.BONDS_NATIVE_RELIABILITY_MIN_SAMPLES,
      max_failure_rate:
        options.reliabilityMaxFailureRate ??
        process.env.BONDS_NATIVE_RELIABILITY_MAX_FAILURE_RATE,
      max_average_latency_ms:
        options.reliabilityMaxAverageLatencyMs ??
        process.env.BONDS_NATIVE_RELIABILITY_MAX_AVERAGE_LATENCY_MS
    });
    this.reliabilityHistoryStore =
      options.reliabilityHistoryStore === null
        ? null
        : (
            options.reliabilityHistoryStore ||
            createSupabaseNativeReliabilityHistoryStoreFromEnv()
          );
    this.reliabilityContextProvider =
      typeof options.reliabilityContextProvider === 'function'
        ? options.reliabilityContextProvider
        : null;
    this.reliabilityHistorySnapshotEvery = Math.max(
      5,
      Math.min(
        1000,
        positiveInt(
          options.reliabilityHistorySnapshotEvery ??
          process.env.BONDS_NATIVE_RELIABILITY_HISTORY_SNAPSHOT_EVERY,
          25
        )
      )
    );
    this.reliabilityHistoryErrors = [];

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
      const reliable = rankNodesByReliability(closed, {
        policy:this.reliabilityPolicy
      });
      return rankNodesByLatency(reliable, {
        enabled:this.latencyAwareRouting,
        now,
        staleAfterMs:this.latencyObservationStaleMs,
        operation:method
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
    return classifyNativeFailure(response).node_failure === true;
  }

  reliability() {
    return Object.freeze(this.remoteProviders.map(node => Object.freeze({
      ...reliabilitySnapshot(node, { policy:this.reliabilityPolicy }),
      breaker:Object.freeze({
        failures:this._breaker(node).failures,
        open_until_ms:this._breaker(node).openUntil,
        open:this._breaker(node).openUntil > Date.now()
      })
    })));
  }

  async _appendReliabilityHistory(eventType, node, snapshot, extra = {}) {
    if (!this.reliabilityHistoryStore || typeof this.reliabilityHistoryStore.append !== 'function') {
      return null;
    }

    let context = {};
    if (this.reliabilityContextProvider) {
      try {
        const value = await this.reliabilityContextProvider();
        if (value && typeof value === 'object') context = value;
      } catch (_) {
        context = {};
      }
    }

    const breaker = this._breaker(node);
    try {
      return await this.reliabilityHistoryStore.append({
        event_type:eventType,
        node_id:node?.id,
        node_endpoint:node?.baseUrl,
        snapshot,
        breaker_open:breaker.openUntil > Date.now(),
        breaker_failures:breaker.failures,
        context,
        ...extra
      });
    } catch (error) {
      this.reliabilityHistoryErrors.push({
        event_type:eventType,
        node_id:node?.id || null,
        code:String(error?.message || 'NATIVE_RELIABILITY_HISTORY_WRITE_FAILED')
      });
      if (this.reliabilityHistoryErrors.length > 20) this.reliabilityHistoryErrors.shift();
      return null;
    }
  }

  reliabilityHistoryDiagnostics() {
    return Object.freeze({
      configured:Boolean(
        this.reliabilityHistoryStore &&
        typeof this.reliabilityHistoryStore.append === 'function'
      ),
      recent_errors:Object.freeze(this.reliabilityHistoryErrors.map(item => Object.freeze({ ...item })))
    });
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
          enabled:this.latencyAwareRouting,
          staleAfterMs:this.latencyObservationStaleMs,
          operation
        }) : {
          enabled:this.latencyAwareRouting,
          observed:false,
          ewma_ms:null,
          last_ms:null,
          samples:0,
          operation
        },
        reliability:node
          ? reliabilitySnapshot(node, { policy:this.reliabilityPolicy })
          : null,
        breaker:node
          ? {
              failures:this._breaker(node).failures,
              open_until_ms:this._breaker(node).openUntil,
              open:this._breaker(node).openUntil > Date.now()
            }
          : null
      }
    };
  }

  async _runRemote(method, args = []) {
    const candidates = this._candidateRemoteProviders(method);
    const attempts = [];
    let lastResponse = null;
    let lastNode = null;

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const node = candidates[candidateIndex];
      const nodeAttempts = method === 'generate'
        ? this.recoverableGenerateRetries + 1
        : 1;
      let response = null;

      for (let nodeAttempt = 1; nodeAttempt <= nodeAttempts; nodeAttempt += 1) {
        response = await node.provider[method](...args);
        lastResponse = response;
        lastNode = node;
        const classification = classifyNativeFailure(response);
        const elapsedMs = Number(response?.meta?.elapsed_ms ?? response?.error?.elapsed_ms);
        const beforeSnapshot = reliabilitySnapshot(node, { policy:this.reliabilityPolicy });
        const afterSnapshot = recordNativeOutcome(node, response, {
          elapsed_ms:elapsedMs,
          retried:nodeAttempt > 1,
          failed_over:candidateIndex > 0
        });

        if (nodeAttempt > 1) {
          await this._appendReliabilityHistory('retry', node, afterSnapshot, {
            operation:method
          });
        }
        if (candidateIndex > 0 && nodeAttempt === 1) {
          await this._appendReliabilityHistory('failover', node, afterSnapshot, {
            operation:method
          });
        }
        if (
          beforeSnapshot?.status !== afterSnapshot?.status &&
          afterSnapshot?.status === 'degraded'
        ) {
          await this._appendReliabilityHistory('slo_degraded', node, afterSnapshot, {
            operation:method
          });
        } else if (
          beforeSnapshot?.status === 'degraded' &&
          afterSnapshot?.status === 'healthy'
        ) {
          await this._appendReliabilityHistory('slo_recovered', node, afterSnapshot, {
            operation:method
          });
        }
        if (
          afterSnapshot?.requests === this.reliabilityPolicy.min_samples ||
          (
            afterSnapshot?.requests > 0 &&
            afterSnapshot.requests % this.reliabilityHistorySnapshotEvery === 0
          )
        ) {
          await this._appendReliabilityHistory('snapshot', node, afterSnapshot, {
            operation:method
          });
        }
        attempts.push({
          node:node.id,
          node_attempt:nodeAttempt,
          ok:response.ok === true,
          error_code:response.error ? response.error.code : null,
          runtime_error_code:nativeRuntimeErrorCode(response) || null,
          http_status:response.error ? response.error.status || null : null,
          failure_category:classification.category,
          recoverable:classification.recoverable,
          node_failure:classification.node_failure
        });

        if (response.ok) {
          const wasOpen = this._breaker(node).openUntil > Date.now();
          this._recordSuccess(node);
          if (wasOpen) {
            await this._appendReliabilityHistory(
              'breaker_closed',
              node,
              reliabilitySnapshot(node, { policy:this.reliabilityPolicy }),
              { operation:method }
            );
          }
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
        const wasOpen = this._breaker(node).openUntil > Date.now();
        this._recordFailure(node);
        const isOpen = this._breaker(node).openUntil > Date.now();
        if (!wasOpen && isOpen) {
          await this._appendReliabilityHistory(
            'breaker_open',
            node,
            reliabilitySnapshot(node, { policy:this.reliabilityPolicy }),
            { operation:method }
          );
        }
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
      const classification = classifyNativeFailure(response);
      const elapsedMs = Number(response?.meta?.elapsed_ms ?? response?.error?.elapsed_ms);
      const beforeSnapshot = reliabilitySnapshot(node, { policy:this.reliabilityPolicy });
      const afterSnapshot = recordNativeOutcome(node, response, { elapsed_ms:elapsedMs });
      if (
        beforeSnapshot?.status !== afterSnapshot?.status &&
        afterSnapshot?.status === 'degraded'
      ) {
        await this._appendReliabilityHistory('slo_degraded', node, afterSnapshot, {
          operation:'generate'
        });
      } else if (
        beforeSnapshot?.status === 'degraded' &&
        afterSnapshot?.status === 'healthy'
      ) {
        await this._appendReliabilityHistory('slo_recovered', node, afterSnapshot, {
          operation:'generate'
        });
      }
      if (
        afterSnapshot?.requests === this.reliabilityPolicy.min_samples ||
        (
          afterSnapshot?.requests > 0 &&
          afterSnapshot.requests % this.reliabilityHistorySnapshotEvery === 0
        )
      ) {
        await this._appendReliabilityHistory('snapshot', node, afterSnapshot, {
          operation:'generate'
        });
      }

      if (response.ok) {
        this._recordSuccess(node);
        if (this.latencyAwareRouting && Number.isFinite(elapsedMs) && elapsedMs >= 0) {
          recordLatencyObservation(node, elapsedMs, { operation:'generate' });
        }
      } else if (classification.node_failure) {
        this._recordFailure(node);
      }

      return this._decorateRemoteResponse(
        response,
        node,
        [{
          node:node.id,
          ok:response.ok === true,
          error_code:response.error ? response.error.code : null,
          http_status:response.error ? response.error.status || null : null,
          failure_category:classification.category,
          recoverable:classification.recoverable,
          node_failure:classification.node_failure
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