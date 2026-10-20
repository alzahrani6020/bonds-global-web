/**
 * @jest-environment node
 */

const { InferenceRouter, parseRemoteUrls } = require('../../lib/ai/inference-router');

describe('Bonds Native HA inference router', () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test('parses ordered native nodes and removes duplicates', () => {
    expect(parseRemoteUrls('https://a.example/, https://b.example, https://a.example')).toEqual([
      'https://a.example',
      'https://b.example'
    ]);
  });

  test('fails over to the standby node when the primary is unreachable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, runtime: { ready: true } })
      });

    const router = new InferenceRouter({
      mode: 'REMOTE_BONDS_NATIVE',
      remoteUrls: ['https://native-a.example', 'https://native-b.example'],
      token: 'test-token',
      timeoutMs: 1000
    });

    const response = await router.health();

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://native-a.example/health');
    expect(global.fetch.mock.calls[1][0]).toBe('https://native-b.example/health');
    expect(response.meta.native_node).toBe('native-2');
    expect(response.meta.failover_attempts).toHaveLength(2);
  });

  test('does not fail over on authentication or client errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED' } })
    });

    const router = new InferenceRouter({
      mode: 'REMOTE_BONDS_NATIVE',
      remoteUrls: ['https://native-a.example', 'https://native-b.example'],
      token: 'bad-token',
      timeoutMs: 1000
    });

    const response = await router.health();

    expect(response.ok).toBe(false);
    expect(response.error.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('opens the primary circuit after repeated node failures', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true })
      })
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true })
      });

    const router = new InferenceRouter({
      mode: 'REMOTE_BONDS_NATIVE',
      remoteUrls: ['https://native-a.example', 'https://native-b.example'],
      token: 'test-token',
      timeoutMs: 1000,
      breakerFailureThreshold: 2,
      breakerCooldownMs: 60000
    });

    await router.health();
    await router.health();
    await router.health();

    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(global.fetch.mock.calls[4][0]).toBe('https://native-b.example/health');
  });

  test('keeps the legacy single remote URL configuration compatible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true })
    });

    const router = new InferenceRouter({
      mode: 'REMOTE_BONDS_NATIVE',
      remoteUrl: 'https://legacy-native.example',
      token: 'test-token',
      timeoutMs: 1000
    });

    const response = await router.health();

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://legacy-native.example/health',
      expect.any(Object)
    );
  });
});
