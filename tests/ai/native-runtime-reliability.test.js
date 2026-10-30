'use strict';

const {
  InferenceRouter
} = require('../../lib/ai/inference-router');
const {
  classifyNativeFailure,
  recordNativeOutcome,
  reliabilitySnapshot,
  rankNodesByReliability,
  resetNativeReliabilityState
} = require('../../lib/ai/native-runtime-reliability');
const {
  resetLatencyRoutingState
} = require('../../lib/ai/latency-aware-routing');

describe('BONDS Native runtime reliability controller', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetNativeReliabilityState();
    resetLatencyRoutingState();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('classifies transient transport and HTTP failures conservatively', () => {
    expect(classifyNativeFailure({
      ok:false,
      executed:false,
      error:{ code:'NATIVE_RUNTIME_TIMEOUT' }
    })).toMatchObject({
      category:'timeout',
      recoverable:true,
      node_failure:true
    });

    expect(classifyNativeFailure({
      ok:false,
      executed:true,
      error:{ code:'NATIVE_RUNTIME_HTTP_ERROR', status:503 }
    })).toMatchObject({
      category:'upstream_transient',
      recoverable:true,
      node_failure:true
    });

    expect(classifyNativeFailure({
      ok:false,
      executed:true,
      error:{ code:'NATIVE_RUNTIME_HTTP_ERROR', status:429 }
    })).toMatchObject({
      category:'throttle',
      recoverable:true,
      node_failure:false
    });

    expect(classifyNativeFailure({
      ok:false,
      executed:true,
      error:{ code:'NATIVE_RUNTIME_HTTP_ERROR', status:401 }
    })).toMatchObject({
      category:'auth',
      recoverable:false,
      node_failure:false
    });
  });

  test('retries a transient 503 once on the same node and emits reliability evidence', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok:false,
        status:503,
        text:async () => JSON.stringify({ error:{ code:'NATIVE_RUNTIME_BUSY' } })
      })
      .mockResolvedValueOnce({
        ok:true,
        status:200,
        text:async () => JSON.stringify({ text:'ok' })
      });

    const router = new InferenceRouter({
      mode:'REMOTE_BONDS_NATIVE',
      remoteUrls:['https://native-1.example'],
      recoverableGenerateRetries:1,
      recoverableGenerateRetryDelayMs:0,
      reliabilityMinSamples:1
    });

    const response = await router.generate('hello');

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(response.meta.failover_attempts).toHaveLength(2);
    expect(response.meta.failover_attempts[0]).toMatchObject({
      node:'native-1',
      node_attempt:1,
      http_status:503,
      failure_category:'upstream_transient',
      recoverable:true,
      node_failure:true
    });
    expect(response.meta.failover_attempts[1]).toMatchObject({
      node:'native-1',
      node_attempt:2,
      ok:true,
      failure_category:'success'
    });
    expect(response.meta.reliability).toMatchObject({
      requests:2,
      successes:1,
      failures:1,
      recoverable_failures:1,
      retries:1
    });
  });

  test('does not retry authentication failures', async () => {
    global.fetch.mockResolvedValueOnce({
      ok:false,
      status:401,
      text:async () => JSON.stringify({ error:{ code:'AUTH_FAILED' } })
    });

    const router = new InferenceRouter({
      mode:'REMOTE_BONDS_NATIVE',
      remoteUrls:['https://native-1.example'],
      recoverableGenerateRetries:2,
      recoverableGenerateRetryDelayMs:0
    });

    const response = await router.generate('hello');

    expect(response.ok).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response.meta.failover_attempts).toHaveLength(1);
    expect(response.meta.failover_attempts[0]).toMatchObject({
      http_status:401,
      failure_category:'auth',
      recoverable:false,
      node_failure:false
    });
  });

  test('fails over to another node and opens breaker on node failure', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok:false,
        status:503,
        text:async () => JSON.stringify({ error:{ code:'NATIVE_RUNTIME_BUSY' } })
      })
      .mockResolvedValueOnce({
        ok:true,
        status:200,
        text:async () => JSON.stringify({ text:'ok' })
      });

    const router = new InferenceRouter({
      mode:'REMOTE_BONDS_NATIVE',
      remoteUrls:['https://native-1.example', 'https://native-2.example'],
      recoverableGenerateRetries:0,
      recoverableGenerateRetryDelayMs:0,
      breakerFailureThreshold:1,
      breakerCooldownMs:60000,
      reliabilityMinSamples:1
    });

    const response = await router.generate('hello');
    const reliability = router.reliability();

    expect(response.ok).toBe(true);
    expect(response.meta.native_node).toBe('native-2');
    expect(response.meta.failover_attempts.map(item => item.node))
      .toEqual(['native-1', 'native-2']);
    expect(reliability[0]).toMatchObject({
      node_id:'native-1',
      status:'degraded',
      requests:1,
      failures:1,
      breaker:{ open:true }
    });
    expect(reliability[1]).toMatchObject({
      node_id:'native-2',
      status:'healthy',
      requests:1,
      successes:1,
      failovers:1,
      breaker:{ open:false }
    });
  });

  test('SLO evidence marks sustained failure rate and latency as degraded', () => {
    const node = { id:'native-1', baseUrl:'https://native-1.example' };

    for (let i = 0; i < 4; i += 1) {
      recordNativeOutcome(node, {
        ok:false,
        executed:true,
        error:{ code:'NATIVE_RUNTIME_HTTP_ERROR', status:503 }
      }, { elapsed_ms:40000 });
    }
    recordNativeOutcome(node, {
      ok:true,
      executed:true,
      result:{ text:'ok' }
    }, { elapsed_ms:40000 });

    const snapshot = reliabilitySnapshot(node, {
      policy:{
        min_samples:5,
        max_failure_rate:0.2,
        max_average_latency_ms:30000
      }
    });

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.failure_rate).toBe(0.8);
    expect(snapshot.average_latency_ms).toBe(40000);
    expect(snapshot.failures_evidence.map(item => item.code))
      .toEqual(expect.arrayContaining([
        'NATIVE_RELIABILITY_FAILURE_RATE_HIGH',
        'NATIVE_RELIABILITY_LATENCY_HIGH'
      ]));
  });

  test('health-aware ranking places measured degraded nodes behind healthy nodes', () => {
    const degraded = { id:'native-1', baseUrl:'https://native-1.example' };
    const healthy = { id:'native-2', baseUrl:'https://native-2.example' };

    recordNativeOutcome(degraded, {
      ok:false,
      executed:true,
      error:{ code:'NATIVE_RUNTIME_HTTP_ERROR', status:503 }
    }, { elapsed_ms:10 });
    recordNativeOutcome(healthy, {
      ok:true,
      executed:true,
      result:{ text:'ok' }
    }, { elapsed_ms:10 });

    const ranked = rankNodesByReliability([degraded, healthy], {
      policy:{
        min_samples:1,
        max_failure_rate:0.2,
        max_average_latency_ms:30000
      }
    });

    expect(ranked.map(node => node.id)).toEqual(['native-2', 'native-1']);
  });
});
