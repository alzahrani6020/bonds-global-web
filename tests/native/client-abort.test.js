/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const {
  runWithClientAbort,
  getClientAbortSignal,
  isClientAborted,
  CLIENT_ABORT_CODE
} = require('../../lib/ai/request-abort-context');
const { InferenceRouter } = require('../../lib/ai/inference-router');

// fetch that stays pending until its AbortSignal fires, like a hung native host.
function hangingFetch() {
  return jest.fn((url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      reject(err);
    });
  }));
}

function makeRouter(extra = {}) {
  return new InferenceRouter({
    mode: 'REMOTE_BONDS_NATIVE',
    remoteUrls: ['https://native-a.example', 'https://native-b.example'],
    token: 'test-token',
    timeoutMs: 5000,
    recoverableGenerateRetryDelayMs: 0,
    ...extra
  });
}

describe('request abort context', () => {
  test('is a no-op outside a bound scope', () => {
    expect(getClientAbortSignal()).toBeNull();
    expect(isClientAborted()).toBe(false);
  });

  test('exposes the bound signal across async boundaries', async () => {
    const controller = new AbortController();
    await runWithClientAbort(controller.signal, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(getClientAbortSignal()).toBe(controller.signal);
      expect(isClientAborted()).toBe(false);
      controller.abort();
      expect(isClientAborted()).toBe(true);
    });
  });
});

describe('native transport honours client disconnect', () => {
  afterEach(() => {
    global.fetch = undefined;
  });

  test('a client abort returns a neutral result, not a timeout', async () => {
    global.fetch = hangingFetch();
    const router = makeRouter();
    const controller = new AbortController();

    const pending = runWithClientAbort(controller.signal, () => router.generate('hi'));
    setTimeout(() => controller.abort(), 10);
    const response = await pending;

    expect(response.ok).toBe(false);
    expect(response.error.code).toBe(CLIENT_ABORT_CODE);
    expect(response.error.client_abort).toBe(true);
  });

  test('a client abort is not retried, failed over, or counted against node health', async () => {
    global.fetch = hangingFetch();
    const router = makeRouter({ breakerFailureThreshold: 1 });
    const controller = new AbortController();

    for (let i = 0; i < 3; i += 1) {
      const pending = runWithClientAbort(controller.signal, () => router.generate('hi'));
      setTimeout(() => controller.abort(), 5);
      const response = await pending;
      expect(response.error.code).toBe(CLIENT_ABORT_CODE);
      // Later iterations start with an already-aborted signal and must not hit the network.
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Nodes stay healthy: a normal request afterwards still reaches the primary.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, text: 'fine' })
    });
    const healthy = await router.generate('hello');
    expect(healthy.ok).toBe(true);
    expect(global.fetch.mock.calls[0][0]).toBe('https://native-a.example/generate');
    for (const node of router.remoteProviders) {
      expect(router._breaker(node).failures).toBe(0);
      expect(router._breaker(node).openUntil).toBe(0);
    }
  });

  test('an already-aborted caller never reaches the network', async () => {
    global.fetch = jest.fn();
    const router = makeRouter();
    const controller = new AbortController();
    controller.abort();

    const response = await runWithClientAbort(controller.signal, () => router.generate('hi'));

    expect(response.error.code).toBe(CLIENT_ABORT_CODE);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('a real timeout is still a timeout and still counts against the node', async () => {
    global.fetch = hangingFetch();
    const router = makeRouter({ timeoutMs: 20, recoverableGenerateRetries: 0 });

    const response = await router.generate('hi');

    expect(response.error.code).toBe('NATIVE_RUNTIME_TIMEOUT');
    expect(router._breaker(router.remoteProviders[0]).failures).toBe(1);
  });
});

describe('orchestrator does not buy a fallback answer for a departed caller', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    global.fetch = undefined;
    jest.resetModules();
  });

  test('client abort rethrows instead of calling OpenAI', async () => {
    Object.assign(process.env, {
      BONDS_INFERENCE_MODE: 'REMOTE_BONDS_NATIVE',
      BONDS_NATIVE_REMOTE_URLS: 'https://native-a.example',
      BONDS_NATIVE_TOKEN: 'test-token',
      BONDS_AI_PROVIDER: 'native-first',
      BONDS_OPENAI_FALLBACK: 'true',
      OPENAI_API_KEY: 'sk-test-not-real'
    });
    jest.resetModules();
    const calls = [];
    global.fetch = jest.fn((url, init) => {
      calls.push(String(url));
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const orchestrator = require('../../lib/ai/orchestrator');
    const { runWithClientAbort: bind } = require('../../lib/ai/request-abort-context');
    const controller = new AbortController();

    const pending = bind(controller.signal, () =>
      orchestrator.callPreferredAI([{ role: 'user', content: 'hi' }])
    );
    setTimeout(() => controller.abort(), 10);

    await expect(pending).rejects.toMatchObject({ code: CLIENT_ABORT_CODE });
    expect(calls.some((url) => url.includes('api.openai.com'))).toBe(false);
  });
});

describe('chat endpoint binds the client disconnect', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../v3/api/ai.js'), 'utf8');

  test('aiChatHandler wraps the implementation in a disconnect-bound scope', () => {
    expect(source).toMatch(/function aiChatHandler\(req, res\)\s*\{[\s\S]*?runWithClientAbort\(clientAbort\.signal/);
    expect(source).toMatch(/res\.once\('close',[\s\S]*?!res\.writableEnded[\s\S]*?clientAbort\.abort\(\)/);
    expect(source).toMatch(/async function aiChatHandlerImpl\(req, res\)/);
  });
});
