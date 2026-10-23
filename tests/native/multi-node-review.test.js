/** @jest-environment node */

const { InferenceRouter } = require('../../lib/ai/inference-router');

describe('Bonds Native independent multi-node reviews', () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test('reviews across configured remote nodes through the existing provider boundary', async () => {
    const router = new InferenceRouter({
      mode:'REMOTE_BONDS_NATIVE',
      remoteUrls:['https://native-a.example','https://native-b.example'],
      token:'test-token',
      timeoutMs:1000,
      latencyAwareRouting:false
    });

    global.fetch = jest.fn(async url => {
      const model = String(url).includes('native-a')
        ? 'a'.repeat(64)
        : 'b'.repeat(64);
      return {
        ok:true,
        status:200,
        text:async()=>JSON.stringify({
          text:JSON.stringify({ verdict:'approve', reason_codes:['OK'] }),
          model_sha256:model
        })
      };
    });

    const result = await router.generateAcrossRemoteNodes(
      'review prompt',
      { temperature:0 },
      { limit:2 }
    );

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('BondsNativeProvider');
    expect(result.external_llm_provider).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results.map(item => item.meta.native_node))
      .toEqual(['native-1','native-2']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('does not manufacture remote review mode when router is local', async () => {
    const router = new InferenceRouter({
      mode:'LOCAL_NATIVE',
      localUrl:'http://127.0.0.1:8765'
    });

    const result = await router.generateAcrossRemoteNodes('review prompt');

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.results).toEqual([]);
    expect(result.error.code).toBe('REMOTE_MULTI_NODE_REVIEW_UNAVAILABLE');
  });
});
