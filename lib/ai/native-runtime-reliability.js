'use strict';

const reliability = new Map();

const DEFAULT_POLICY = Object.freeze({
  min_samples:5,
  max_failure_rate:0.2,
  max_average_latency_ms:30000
});

function clean(value) {
  return String(value ?? '').trim();
}

function keyFor(node) {
  return clean(node?.baseUrl || node?.id);
}

function normalizePolicy(input = {}) {
  return Object.freeze({
    min_samples:Number.isFinite(Number(input.min_samples))
      ? Math.max(1, Math.floor(Number(input.min_samples)))
      : DEFAULT_POLICY.min_samples,
    max_failure_rate:Number.isFinite(Number(input.max_failure_rate))
      ? Math.max(0, Math.min(1, Number(input.max_failure_rate)))
      : DEFAULT_POLICY.max_failure_rate,
    max_average_latency_ms:Number.isFinite(Number(input.max_average_latency_ms))
      ? Math.max(1, Number(input.max_average_latency_ms))
      : DEFAULT_POLICY.max_average_latency_ms
  });
}

function emptyState(node) {
  return {
    node_id:node?.id || null,
    base_url:node?.baseUrl || null,
    requests:0,
    successes:0,
    failures:0,
    recoverable_failures:0,
    retries:0,
    failovers:0,
    total_latency_ms:0,
    max_latency_ms:0,
    last_failure_code:null,
    last_failure_category:null,
    last_failure_at_ms:null,
    updated_at_ms:null
  };
}

function stateFor(node) {
  const key = keyFor(node);
  if (!key) return null;
  if (!reliability.has(key)) reliability.set(key, emptyState(node));
  return reliability.get(key);
}

function nativeRuntimeErrorCode(response) {
  return clean(response?.error?.detail?.error?.code).toUpperCase();
}

function classifyNativeFailure(response) {
  if (response?.ok === true) {
    return Object.freeze({
      failed:false,
      category:'success',
      code:null,
      http_status:null,
      recoverable:false,
      node_failure:false
    });
  }

  const code = clean(response?.error?.code || 'NATIVE_RUNTIME_UNKNOWN').toUpperCase();
  const runtimeCode = nativeRuntimeErrorCode(response);
  const status = Number(response?.error?.status);
  const httpStatus = Number.isFinite(status) ? status : null;

  if (response?.executed === false) {
    const category = code === 'NATIVE_RUNTIME_TIMEOUT' ? 'timeout' : 'transport';
    return Object.freeze({
      failed:true,
      category,
      code,
      runtime_code:runtimeCode || null,
      http_status:httpStatus,
      recoverable:true,
      node_failure:true
    });
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return Object.freeze({
      failed:true,
      category:'auth',
      code,
      runtime_code:runtimeCode || null,
      http_status:httpStatus,
      recoverable:false,
      node_failure:false
    });
  }

  if (httpStatus === 429) {
    return Object.freeze({
      failed:true,
      category:'throttle',
      code,
      runtime_code:runtimeCode || null,
      http_status:httpStatus,
      recoverable:true,
      node_failure:false
    });
  }

  if ([502, 503, 504].includes(httpStatus)) {
    return Object.freeze({
      failed:true,
      category:'upstream_transient',
      code,
      runtime_code:runtimeCode || null,
      http_status:httpStatus,
      recoverable:true,
      node_failure:true
    });
  }

  if (httpStatus !== null && httpStatus >= 500) {
    return Object.freeze({
      failed:true,
      category:'server',
      code,
      runtime_code:runtimeCode || null,
      http_status:httpStatus,
      recoverable:['NATIVE_RUNTIME_BUSY', 'NATIVE_INFERENCE_ERROR'].includes(runtimeCode),
      node_failure:true
    });
  }

  return Object.freeze({
    failed:true,
    category:httpStatus !== null && httpStatus >= 400 ? 'request' : 'unknown',
    code,
    runtime_code:runtimeCode || null,
    http_status:httpStatus,
    recoverable:false,
    node_failure:false
  });
}

function recordNativeOutcome(node, response, {
  elapsed_ms,
  retried = false,
  failed_over = false,
  now = Date.now()
} = {}) {
  const state = stateFor(node);
  if (!state) return null;

  const classification = classifyNativeFailure(response);
  const elapsed = Number(elapsed_ms);
  state.requests += 1;
  if (response?.ok === true) state.successes += 1;
  else state.failures += 1;
  if (classification.recoverable) state.recoverable_failures += 1;
  if (retried) state.retries += 1;
  if (failed_over) state.failovers += 1;
  if (Number.isFinite(elapsed) && elapsed >= 0) {
    state.total_latency_ms += elapsed;
    state.max_latency_ms = Math.max(state.max_latency_ms, elapsed);
  }
  if (classification.failed) {
    state.last_failure_code = classification.code;
    state.last_failure_category = classification.category;
    state.last_failure_at_ms = Number(now);
  }
  state.updated_at_ms = Number(now);

  return reliabilitySnapshot(node);
}

function reliabilitySnapshot(node, { policy = DEFAULT_POLICY } = {}) {
  const state = stateFor(node);
  if (!state) return null;
  const normalizedPolicy = normalizePolicy(policy);
  const failureRate = state.requests ? state.failures / state.requests : 0;
  const averageLatencyMs = state.requests ? state.total_latency_ms / state.requests : 0;

  let status = 'insufficient_data';
  const failures = [];
  if (state.requests >= normalizedPolicy.min_samples) {
    if (failureRate > normalizedPolicy.max_failure_rate) {
      failures.push({
        code:'NATIVE_RELIABILITY_FAILURE_RATE_HIGH',
        actual:failureRate,
        allowed:normalizedPolicy.max_failure_rate
      });
    }
    if (averageLatencyMs > normalizedPolicy.max_average_latency_ms) {
      failures.push({
        code:'NATIVE_RELIABILITY_LATENCY_HIGH',
        actual:averageLatencyMs,
        allowed:normalizedPolicy.max_average_latency_ms
      });
    }
    status = failures.length ? 'degraded' : 'healthy';
  }

  return Object.freeze({
    node_id:state.node_id,
    base_url:state.base_url,
    status,
    requests:state.requests,
    successes:state.successes,
    failures:state.failures,
    failure_rate:failureRate,
    recoverable_failures:state.recoverable_failures,
    retries:state.retries,
    failovers:state.failovers,
    average_latency_ms:averageLatencyMs,
    max_latency_ms:state.max_latency_ms,
    last_failure_code:state.last_failure_code,
    last_failure_category:state.last_failure_category,
    last_failure_at_ms:state.last_failure_at_ms,
    updated_at_ms:state.updated_at_ms,
    failures_evidence:Object.freeze(failures)
  });
}

function rankNodesByReliability(nodes, { policy = DEFAULT_POLICY } = {}) {
  const input = Array.isArray(nodes) ? nodes : [];
  if (input.length < 2) return [...input];

  const ranked = input.map((node, index) => ({
    node,
    index,
    snapshot:reliabilitySnapshot(node, { policy })
  }));

  const healthy = ranked.filter(item => item.snapshot?.status === 'healthy');
  const degraded = ranked.filter(item => item.snapshot?.status === 'degraded');

  if (!healthy.length || !degraded.length) return [...input];

  return ranked
    .sort((a, b) => {
      const score = (item) => item.snapshot?.status === 'healthy'
        ? 0
        : item.snapshot?.status === 'insufficient_data'
          ? 1
          : 2;
      return score(a) - score(b) || a.index - b.index;
    })
    .map(item => item.node);
}

function resetNativeReliabilityState() {
  reliability.clear();
}

module.exports = {
  DEFAULT_POLICY,
  normalizePolicy,
  classifyNativeFailure,
  recordNativeOutcome,
  reliabilitySnapshot,
  rankNodesByReliability,
  resetNativeReliabilityState
};
