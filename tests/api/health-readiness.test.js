const mockSupabaseError = { value: null };
const mockNativeOk = { value: false };
const mockNativeSequence = { values: [] };
const mockNativeHealthCalls = { count: 0 };
const originalFetch = global.fetch;

jest.mock('../../lib/api/supabase', () => () => ({
  from: () => ({
    select: () => ({
      limit: async () => ({ error: mockSupabaseError.value }),
    }),
  }),
}));

jest.mock('../../lib/ai/inference-router', () => ({
  getInferenceRouter: () => ({
    health: async () => {
      mockNativeHealthCalls.count += 1;
      const ok = mockNativeSequence.values.length ? mockNativeSequence.values.shift() : mockNativeOk.value;
      return {
        ok,
        provider: 'BondsNativeProvider',
        ...(ok ? { meta: { elapsed_ms: 7 } } : { error: { code: 'NATIVE_RUNTIME_UNAVAILABLE', elapsed_ms: 7 } }),
      };
    },
  }),
}));

jest.mock('../../lib/ai/orchestrator', () => ({
  callBondsNative: jest.fn(),
}));

const healthHandler = require('../../api/health');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

describe('platform health vs strict readiness', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200 }));
    mockSupabaseError.value = null;
    mockNativeOk.value = false;
    mockNativeSequence.values = [];
    mockNativeHealthCalls.count = 0;
    process.env.BONDS_NATIVE_HEALTH_RETRY_DELAYS_MS = '0,0,0';
    process.env.BONDS_INFERENCE_MODE = 'REMOTE_BONDS_NATIVE';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    delete process.env.BONDS_E2E_SMOKE_NONCE;
    delete process.env.BONDS_AI_PROVIDER;
    delete process.env.BONDS_OPENAI_FALLBACK;
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.BONDS_NATIVE_HEALTH_RETRY_DELAYS_MS;
  });

  test('core health stays available without probing Native AI', async () => {
    const req = { method: 'GET', url: '/api/health', query: {} };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.native).toBe('not_checked');
    expect(res.body.capabilities.core_platform).toBe('available');
    expect(res.body.capabilities.native_ai).toBe('see_readiness');
    expect(res.body.readiness.endpoint).toBe('/api/readiness');
    expect(res.body.inference.reachable).toBeNull();
    expect(mockNativeHealthCalls.count).toBe(0);
  });

  test('strict readiness passes through verified OpenAI fallback when Native AI is unavailable', async () => {
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.supabase).toBe('ok');
    expect(res.body.checks.native).toBe('error');
    expect(res.body.checks.fallback).toBe('ok');
    expect(res.body.inference.provider).toBe('openai_fallback');
    expect(res.body.inference.native_reachable).toBe(false);
    expect(mockNativeHealthCalls.count).toBe(3);
    expect(res.body.inference.native_diagnostic.attempts).toBe(3);
    expect(res.body.inference.native_diagnostic.code).toBe('NATIVE_RUNTIME_UNAVAILABLE');
    expect(global.fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.any(Object));
  });

  test('strict readiness fails when native-only mode is configured and Native AI is unavailable', async () => {
    process.env.BONDS_AI_PROVIDER = 'native-only';
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.native).toBe('error');
    expect(res.body.checks.fallback).toBe('skipped');
    expect(mockNativeHealthCalls.count).toBe(3);
    expect(res.body.inference.native_diagnostic.attempts).toBe(3);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('strict readiness passes when core and Native AI are healthy', async () => {
    mockNativeOk.value = true;
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.inference.native_reachable).toBe(true);
    expect(res.body.inference.native_diagnostic.attempts).toBe(1);
    expect(res.body.inference.native_diagnostic.retry_recovered).toBe(false);
    expect(mockNativeHealthCalls.count).toBe(1);
  });

  test('strict readiness recovers from a transient Native health flap', async () => {
    mockNativeSequence.values = [false, false, true];
    process.env.BONDS_AI_PROVIDER = 'native-only';
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.native).toBe('ok');
    expect(res.body.inference.native_reachable).toBe(true);
    expect(res.body.inference.native_diagnostic.attempts).toBe(3);
    expect(res.body.inference.native_diagnostic.retry_recovered).toBe(true);
    expect(mockNativeHealthCalls.count).toBe(3);
  });


  test('strict readiness forwards optional token-runtime Authorization without weakening readiness', async () => {
    mockNativeOk.value = true;
    process.env.BONDS_TOKEN_RUNTIME_HEALTH_URL = 'https://token-runtime.example/health';
    process.env.BONDS_TOKEN_RUNTIME_AUTHORIZATION = 'Bearer test-upstream-secret';

    global.fetch = jest.fn(async (url, options = {}) => {
      if (url === 'https://token-runtime.example/health') {
        expect(options.headers).toEqual({ Authorization: 'Bearer test-upstream-secret' });
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', service: 'bonds-token-service' })
        };
      }
      return { ok: true, status: 200 };
    });

    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.checks.token_runtime).toBe('ok');

    delete process.env.BONDS_TOKEN_RUNTIME_HEALTH_URL;
    delete process.env.BONDS_TOKEN_RUNTIME_AUTHORIZATION;
  });

  test('core health fails when Supabase is unavailable', async () => {
    mockSupabaseError.value = new Error('db unavailable');
    mockNativeOk.value = true;
    const req = { method: 'GET', url: '/api/health', query: {} };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.capabilities.core_platform).toBe('unavailable');
    expect(mockNativeHealthCalls.count).toBe(0);
  });
});
