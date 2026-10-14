const mockSupabaseError = { value: null };
const mockNativeOk = { value: false };
const mockNativeHealthCalls = { count: 0 };

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
      return {
        ok: mockNativeOk.value,
        provider: 'BondsNativeProvider',
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
    mockSupabaseError.value = null;
    mockNativeOk.value = false;
    mockNativeHealthCalls.count = 0;
    process.env.BONDS_INFERENCE_MODE = 'REMOTE_BONDS_NATIVE';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    delete process.env.BONDS_E2E_SMOKE_NONCE;
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

  test('strict readiness fails when Native AI is unavailable', async () => {
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.supabase).toBe('ok');
    expect(res.body.checks.native).toBe('error');
    expect(mockNativeHealthCalls.count).toBe(1);
  });

  test('strict readiness passes when core and Native AI are healthy', async () => {
    mockNativeOk.value = true;
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.inference.reachable).toBe(true);
    expect(mockNativeHealthCalls.count).toBe(1);
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
