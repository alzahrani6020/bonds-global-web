'use strict';

const {
  InferenceRouter
} = require('../../lib/ai/inference-router');
const {
  PersistentRuntimeModelRouting
} = require('../../lib/ai/runtime-model-routing');
const {
  hashEndpoint,
  normalizeEvent,
  MemoryNativeReliabilityHistoryStore
} = require('../../lib/ai/native-reliability-history-store');
const {
  resetNativeReliabilityState
} = require('../../lib/ai/native-runtime-reliability');
const {
  resetLatencyRoutingState
} = require('../../lib/ai/latency-aware-routing');

describe('persistent native reliability history', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetNativeReliabilityState();
    resetLatencyRoutingState();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('normalizes operational history without persisting raw node URLs', () => {
    const rawUrl = 'https://private-native.example';
    const event = normalizeEvent({
      event_type:'slo_degraded',
      node_id:'native-1',
      node_endpoint:rawUrl,
      snapshot:{
        status:'degraded',
        requests:5,
        successes:3,
        failures:2,
        failure_rate:0.4,
        average_latency_ms:1200,
        max_latency_ms:2400,
        failures_evidence:[{ code:'NATIVE_RELIABILITY_FAILURE_RATE_HIGH' }]
      },
      context:{
        lifecycle_generation:7,
        champion_model_id:'champion',
        challenger_model_id:'challenger',
        canary_percentage:25,
        deployment_sha:'abc123'
      }
    });

    expect(event.node_endpoint_hash).toBe(hashEndpoint(rawUrl));
    expect(event.node_endpoint_hash).not.toContain('private-native.example');
    expect(event).toMatchObject({
      event_type:'slo_degraded',
      node_id:'native-1',
      status:'degraded',
      lifecycle_generation:7,
      champion_model_id:'champion',
      challenger_model_id:'challenger',
      canary_percentage:25,
      deployment_sha:'abc123'
    });
    expect(event).not.toHaveProperty('prompt');
    expect(event).not.toHaveProperty('response');
    expect(event).not.toHaveProperty('base_url');
  });

  test('memory history store preserves ordered aggregate events', async () => {
    const store = new MemoryNativeReliabilityHistoryStore();

    await store.append({
      event_type:'retry',
      node_id:'native-1',
      node_endpoint:'https://native-1.example',
      snapshot:{ status:'insufficient_data', requests:1, failures:1 }
    });
    await store.append({
      event_type:'slo_degraded',
      node_id:'native-1',
      node_endpoint:'https://native-1.example',
      snapshot:{ status:'degraded', requests:5, failures:3, failure_rate:0.6 }
    });

    const rows = await store.recent({ nodeId:'native-1' });
    expect(rows).toHaveLength(2);
    expect(rows[0].event_type).toBe('slo_degraded');
    expect(rows[1].event_type).toBe('retry');
  });

  test('router records retry and SLO transition history best-effort', async () => {
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

    const store = new MemoryNativeReliabilityHistoryStore();
    const router = new InferenceRouter({
      mode:'REMOTE_BONDS_NATIVE',
      remoteUrls:['https://native-1.example'],
      recoverableGenerateRetries:1,
      recoverableGenerateRetryDelayMs:0,
      reliabilityMinSamples:1,
      reliabilityHistoryStore:store,
      reliabilityContextProvider:async () => ({
        lifecycle_generation:3,
        champion_model_id:'champion',
        deployment_sha:'release-sha'
      })
    });

    const response = await router.generate('hello');
    const history = await store.recent({ nodeId:'native-1' });

    expect(response.ok).toBe(true);
    expect(history.map(row => row.event_type))
      .toEqual(expect.arrayContaining(['retry', 'slo_degraded']));
    expect(history.every(row => row.lifecycle_generation === 3)).toBe(true);
    expect(history.every(row => row.champion_model_id === 'champion')).toBe(true);
    expect(history.every(row => row.deployment_sha === 'release-sha')).toBe(true);
  });

  test('telemetry persistence failure does not make inference fail closed', async () => {
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

    const failingStore = {
      append:jest.fn(async () => {
        throw new Error('TELEMETRY_DATABASE_UNAVAILABLE');
      })
    };
    const router = new InferenceRouter({
      mode:'REMOTE_BONDS_NATIVE',
      remoteUrls:['https://native-1.example'],
      recoverableGenerateRetries:1,
      recoverableGenerateRetryDelayMs:0,
      reliabilityMinSamples:1,
      reliabilityHistoryStore:failingStore
    });

    const response = await router.generate('hello');

    expect(response.ok).toBe(true);
    expect(failingStore.append).toHaveBeenCalled();
    expect(router.reliabilityHistoryDiagnostics()).toMatchObject({
      configured:true
    });
    expect(router.reliabilityHistoryDiagnostics().recent_errors.length)
      .toBeGreaterThan(0);
  });

  test('persistent runtime routing supplies lifecycle context to native reliability history', async () => {
    let receivedOptions = null;
    class FakeProviderRouter {
      constructor(options) {
        receivedOptions = options;
      }
      identity() {
        return {
          provider_id:'BONDS_NATIVE',
          model_id:'bonds-native',
          runtime_model:'bonds-native',
          mode:'REMOTE_BONDS_NATIVE'
        };
      }
    }

    const lifecycleController = {
      selectModel:() => ({ model_id:'bonds-native', reason:'champion' }),
      snapshot:() => ({
        generation:11,
        champion_model_id:'bonds-native',
        canary:{
          challenger_model_id:'qwen-local',
          percentage:25
        }
      })
    };
    const stateStore = {
      load:async () => null,
      save:async () => ({ revision:1 })
    };
    const historyStore = new MemoryNativeReliabilityHistoryStore();

    const runtime = new PersistentRuntimeModelRouting({
      lifecycleController,
      stateStore,
      providerRouterClass:FakeProviderRouter,
      reliabilityHistoryStore:historyStore
    });
    runtime.initialized = true;

    runtime.createRouter({ requestKey:'req-1' });
    const context = await receivedOptions.reliabilityContextProvider();

    expect(receivedOptions.reliabilityHistoryStore).toBe(historyStore);
    expect(context).toMatchObject({
      lifecycle_generation:11,
      champion_model_id:'bonds-native',
      challenger_model_id:'qwen-local',
      canary_percentage:25
    });
  });
});
