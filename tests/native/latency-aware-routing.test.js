/**
 * @jest-environment node
 */

const {
  recordLatencyObservation,
  getLatencyObservation,
  rankNodesByLatency,
  resetLatencyRoutingState
} = require('../../lib/ai/latency-aware-routing');
const { InferenceRouter } = require('../../lib/ai/inference-router');

describe('Assistant latency-aware routing', () => {
  afterEach(() => {
    resetLatencyRoutingState();
    global.fetch = undefined;
  });

  test('keeps configured order when latency-aware routing is disabled', () => {
    const nodes = [
      { id:'native-1', baseUrl:'https://a.example' },
      { id:'native-2', baseUrl:'https://b.example' }
    ];
    recordLatencyObservation(nodes[0], 300);
    recordLatencyObservation(nodes[1], 50);

    expect(rankNodesByLatency(nodes, { enabled:false }).map(x => x.id))
      .toEqual(['native-1','native-2']);
  });

  test('explores unmeasured nodes before preferring lower EWMA latency', () => {
    const nodes = [
      { id:'native-1', baseUrl:'https://a.example' },
      { id:'native-2', baseUrl:'https://b.example' }
    ];

    recordLatencyObservation(nodes[0], 200);
    expect(rankNodesByLatency(nodes, { enabled:true }).map(x => x.id))
      .toEqual(['native-2','native-1']);

    recordLatencyObservation(nodes[1], 40);
    expect(rankNodesByLatency(nodes, { enabled:true }).map(x => x.id))
      .toEqual(['native-2','native-1']);
  });

  test('uses EWMA rather than replacing history with one sample', () => {
    const node = { id:'native-1', baseUrl:'https://a.example' };
    recordLatencyObservation(node, 100, { alpha:0.5, now:1000 });
    recordLatencyObservation(node, 300, { alpha:0.5, now:2000 });

    expect(getLatencyObservation(node, { now:2000 }).ewma_ms).toBe(200);
    expect(getLatencyObservation(node, { now:2000 }).samples).toBe(2);
  });

  test('ignores stale observations', () => {
    const node = { id:'native-1', baseUrl:'https://a.example' };
    recordLatencyObservation(node, 20, { now:1000 });

    expect(getLatencyObservation(node, { now:7000, staleAfterMs:5000 })).toBeNull();
  });

  test('router prefers the lower-latency healthy node when explicitly enabled', async () => {
    const router = new InferenceRouter({
      mode:'REMOTE_BONDS_NATIVE',
      remoteUrls:['https://native-a.example','https://native-b.example'],
      token:'test-token',
      timeoutMs:1000,
      latencyAwareRouting:true
    });

    recordLatencyObservation(router.remoteProviders[0], 240);
    recordLatencyObservation(router.remoteProviders[1], 35);

    global.fetch = jest.fn().mockResolvedValue({
      ok:true,
      status:200,
      text:async () => JSON.stringify({ ok:true })
    });

    const response = await router.health();

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('https://native-b.example/health');
    expect(response.meta.native_node).toBe('native-2');
    expect(response.meta.latency_routing.enabled).toBe(true);
    expect(response.meta.latency_routing.observed).toBe(true);
  });
});
