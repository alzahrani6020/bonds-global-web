const mockSupabaseError = { value: null };
const mockNativeOk = { value: false };
const mockNativeSequence = { values: [] };
const mockNativeHealthCalls = { count: 0 };
const mockUserGovernance = { value: { status: 'ok', code: null }, calls: 0 };
const mockAssistantReadiness = { value: { status: 'ok', code: null, schema_version: 1 }, calls: 0 };
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const runtimeBuild = 'a'.repeat(40);
const channelSecret = 'isolated-health-channel-credential-123456789';
const runtimeIdentity = {
  status: 'ok', service: 'bonds-token-service', issuer: 'bonds-token-service',
  contract_version: 2, schema_version: 3, service_token_ttl_seconds: 3600,
  build_commit: runtimeBuild, channel_auth: 'required',
  broker_auth: 'required', broker_mode: 'one_time_service_tokens'
};

function runtimeFetch(url, options) {
  if (url === 'https://runtime.example.test/health') {
    return { ok: true, status: 200, json: async () => ({ ...runtimeIdentity }) };
  }
  if (url === 'https://runtime.example.test/introspect') {
    return options.headers['X-Bonds-Channel'] === channelSecret
      ? { ok: true, status: 200, json: async () => ({ runtime: runtimeIdentity, claims: { active: false } }) }
      : { ok: false, status: 401 };
  }
  return { ok: true, status: 200 };
}

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

jest.mock('../../lib/capabilities/user-governance-context', () => ({
  probeUserGovernanceReadiness: async () => {
    mockUserGovernance.calls += 1;
    return mockUserGovernance.value;
  }
}));

jest.mock('../../lib/assistant/production-readiness', () => ({
  probeAssistantReadiness: async () => {
    mockAssistantReadiness.calls += 1;
    return mockAssistantReadiness.value;
  }
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
    global.fetch = jest.fn(async (url, options) => runtimeFetch(url, options));
    mockSupabaseError.value = null;
    mockNativeOk.value = false;
    mockNativeSequence.values = [];
    mockNativeHealthCalls.count = 0;
    mockUserGovernance.value = { status: 'ok', code: null };
    mockUserGovernance.calls = 0;
    mockAssistantReadiness.value = { status: 'ok', code: null, schema_version: 1 };
    mockAssistantReadiness.calls = 0;
    process.env.BONDS_NATIVE_HEALTH_RETRY_DELAYS_MS = '0,0,0';
    process.env.BONDS_INFERENCE_MODE = 'REMOTE_BONDS_NATIVE';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    delete process.env.BONDS_E2E_SMOKE_NONCE;
    delete process.env.BONDS_AI_PROVIDER;
    delete process.env.BONDS_OPENAI_FALLBACK;
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.BONDS_TOKEN_RUNTIME_HEALTH_URL = 'https://runtime.example.test/health';
    process.env.BONDS_TOKEN_INTROSPECTION_URL = 'https://runtime.example.test/introspect';
    process.env.BONDS_TOKEN_CHANNEL_SECRET = channelSecret;
    process.env.BONDS_TOKEN_BROKER_URL = 'https://runtime.example.test/broker/issue';
    process.env.BONDS_TOKEN_BROKER_SECRET = 'isolated-broker-credential-12345678901234567890';
    process.env.BONDS_TOKEN_EXPECTED_BUILD_COMMIT = runtimeBuild;
    delete process.env.BONDS_TOKEN_ISSUER;
    delete process.env.BONDS_TOKEN_INTROSPECTION_TIMEOUT_MS;
    delete process.env.BONDS_WEB_SEARCH_URL;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test('core health stays available without probing Native AI', async () => {
    delete process.env.BONDS_TOKEN_CHANNEL_SECRET;
    mockAssistantReadiness.value = { status: 'unavailable', code: 'ASSISTANT_READINESS_UNAVAILABLE' };
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
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockUserGovernance.calls).toBe(0);
    expect(mockAssistantReadiness.calls).toBe(0);
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
    expect(global.fetch).not.toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.any(Object));
  });

  test('strict readiness passes when core and Native AI are healthy', async () => {
    mockNativeOk.value = true;
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.assistant).toBe('ok');
    expect(res.body.checks.web_search).toBe('ok');
    expect(res.body.web_search).toMatchObject({ status: 'ok', code: null });
    expect(res.body.assistant).toEqual({ status: 'ok', code: null, schema_version: 1 });
    expect(mockAssistantReadiness.calls).toBe(1);
    expect(res.body.inference.native_reachable).toBe(true);
    expect(res.body.inference.native_diagnostic.attempts).toBe(1);
    expect(res.body.inference.native_diagnostic.retry_recovered).toBe(false);
    expect(mockNativeHealthCalls.count).toBe(1);
    expect(res.body.token_runtime).toMatchObject({
      required: true, status: 'ok', build_commit: runtimeBuild,
      channel_auth: 'verified', broker_auth: 'configured'
    });
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

  test('strict readiness recovers from a transient token channel probe transport failure', async () => {
    mockNativeOk.value = true;
    process.env.BONDS_TOKEN_CHANNEL_VERIFY_DELAYS_MS = '0,0,0';
    let transientFailures = 1;
    global.fetch = jest.fn(async (url, options) => {
      if (url === 'https://runtime.example.test/introspect' &&
          options.headers['X-Bonds-Channel'] !== channelSecret) {
        if (transientFailures > 0) {
          transientFailures -= 1;
          throw new Error('simulated transport reset');
        }
        return { ok: false, status: 401 };
      }
      return runtimeFetch(url, options);
    });
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.token_runtime).toMatchObject({
      required: true, status: 'ok', channel_auth: 'verified',
      verify_attempts: 2, verify_recovered: true
    });
  });

  test('persistent token channel probe transport failure stays channel_unverified after bounded retries', async () => {
    mockNativeOk.value = true;
    process.env.BONDS_TOKEN_CHANNEL_VERIFY_DELAYS_MS = '0,0,0';
    global.fetch = jest.fn(async (url, options) => {
      if (url === 'https://runtime.example.test/introspect' &&
          options.headers['X-Bonds-Channel'] !== channelSecret) {
        throw new Error('simulated transport reset');
      }
      return runtimeFetch(url, options);
    });
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.token_runtime).toMatchObject({
      required: true, status: 'channel_unverified',
      code: 'TOKEN_CHANNEL_PROTECTION_UNVERIFIED',
      verify_attempts: 3, verify_recovered: false
    });
    const introspectCalls = global.fetch.mock.calls.filter(call => call[0] === 'https://runtime.example.test/introspect');
    expect(introspectCalls.length).toBe(6);
  });

  test('token channel auth-not-enforced verdict is never retried', async () => {
    mockNativeOk.value = true;
    process.env.BONDS_TOKEN_CHANNEL_VERIFY_DELAYS_MS = '0,0,0';
    global.fetch = jest.fn(async (url, options) => {
      if (url === 'https://runtime.example.test/introspect' &&
          options.headers['X-Bonds-Channel'] !== channelSecret) {
        return { ok: true, status: 200, json: async () => ({ runtime: runtimeIdentity, claims: { active: false } }) };
      }
      return runtimeFetch(url, options);
    });
    const req = { method: 'GET', url: '/api/health?strict=1', query: { strict: '1' } };
    const res = createResponse();

    await healthHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.token_runtime).toMatchObject({
      required: true, status: 'channel_unverified',
      code: 'TOKEN_CHANNEL_AUTH_NOT_ENFORCED',
      verify_attempts: 1, verify_recovered: false
    });
    const introspectCalls = global.fetch.mock.calls.filter(call => call[0] === 'https://runtime.example.test/introspect');
    expect(introspectCalls.length).toBe(2);
  });

  test.each([undefined, 'MISSPELLED_NATIVE_MODE'])('missing or unknown Native mode %p cannot count as ready', async mode => {
    if (mode === undefined) delete process.env.BONDS_INFERENCE_MODE;
    else process.env.BONDS_INFERENCE_MODE = mode;
    process.env.BONDS_AI_PROVIDER = 'native-only';
    const res = createResponse();
    await healthHandler({ method: 'GET', url: '/api/readiness', query: { strict: '1' } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.native).toBe(mode ? 'invalid_configuration' : 'not_configured');
    expect(res.body.inference.provider).toBeNull();
    expect(mockNativeHealthCalls.count).toBe(0);
  });

  test('LOCAL_NATIVE readiness uses the existing router and requires a real probe result', async () => {
    process.env.BONDS_INFERENCE_MODE = 'LOCAL_NATIVE';
    process.env.BONDS_AI_PROVIDER = 'native-only';
    const failed = createResponse();
    await healthHandler({ method: 'GET', query: { strict: '1' } }, failed);
    expect(failed.statusCode).toBe(503);
    expect(failed.body.checks.native).toBe('error');
    expect(mockNativeHealthCalls.count).toBe(3);

    mockNativeOk.value = true;
    const healthy = createResponse();
    await healthHandler({ method: 'GET', query: { strict: '1' } }, healthy);
    expect(healthy.statusCode).toBe(200);
    expect(healthy.body.checks.native).toBe('ok');
    expect(mockNativeHealthCalls.count).toBe(4);
  });

  test('invalid web search configuration is surfaced without exposing the configured URL', async () => {
    process.env.BONDS_WEB_SEARCH_URL = 'not-a-valid-url';
    const result = healthHandler.probeWebSearchReadiness();
    expect(result).toMatchObject({
      status: 'invalid_configuration',
      code: 'WEB_SEARCH_INVALID_CONFIGURATION',
      upstream_count: 1,
      valid_upstream_count: 0
    });
    expect(JSON.stringify(result)).not.toContain('not-a-valid-url');
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

  test.each([
    'BONDS_TOKEN_RUNTIME_HEALTH_URL', 'BONDS_TOKEN_INTROSPECTION_URL',
    'BONDS_TOKEN_CHANNEL_SECRET', 'BONDS_TOKEN_BROKER_URL',
    'BONDS_TOKEN_BROKER_SECRET', 'BONDS_TOKEN_EXPECTED_BUILD_COMMIT'
  ])('missing %s is not reported as ready', async key => {
    delete process.env[key];
    mockNativeOk.value = true;
    const res = createResponse();
    await healthHandler({ method: 'GET', url: '/api/readiness', query: { strict: '1' } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.token_runtime).toBe('not_configured');
    expect(res.body.token_runtime.required).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([
    { status: 'not_configured', code: 'USER_GOVERNANCE_UNCONFIGURED' },
    { status: 'error', code: 'ENTITLEMENT_CATALOG_UNAVAILABLE' }
  ])('a missing server authority or catalog cannot pass readiness: %j', async governance => {
    mockNativeOk.value = true;
    mockUserGovernance.value = governance;
    const res = createResponse();
    await healthHandler({ method: 'GET', query: { strict: '1' } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.user_governance).toEqual(governance);
    expect(res.body.checks.user_governance).toBe(governance.status);
  });

  test.each([
    { status: 'not_configured', code: 'ASSISTANT_DATABASE_UNCONFIGURED' },
    { status: 'unavailable', code: 'ASSISTANT_READINESS_UNAVAILABLE' },
    { status: 'invalid_contract', code: 'ASSISTANT_READINESS_CONTRACT_INVALID' },
    { status: 'not_ready', code: 'ASSISTANT_DATABASE_NOT_READY' }
  ])('an unverified Assistant database cannot pass readiness: %j', async assistant => {
    mockNativeOk.value = true;
    mockAssistantReadiness.value = assistant;
    const res = createResponse();

    await healthHandler({ method: 'GET', query: { strict: '1' } }, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.checks.supabase).toBe('ok');
    expect(res.body.checks.token_runtime).toBe('ok');
    expect(res.body.checks.user_governance).toBe('ok');
    expect(res.body.assistant).toEqual(assistant);
    expect(res.body.checks.assistant).toBe(assistant.status);
    expect(mockAssistantReadiness.calls).toBe(1);
  });

  test.each([
    ['service', 'unrelated-service'], ['issuer', 'unrelated-issuer'],
    ['schema_version', 2], ['schema_version', '3'], ['contract_version', 1],
    ['service_token_ttl_seconds', 7200], ['build_commit', 'b'.repeat(40)],
    ['build_commit', 'unknown'], ['channel_auth', 'optional'], ['broker_auth', 'optional'], ['broker_mode', 'reusable']
  ])('runtime identity rejects mismatched %s = %s', async (key, value) => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, json: async () => ({ ...runtimeIdentity, [key]: value })
    }));
    const result = await healthHandler.probeTokenRuntime();
    expect(result).toMatchObject({ status: 'contract_mismatch', required: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('a status-only health response does not establish runtime identity', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'ok' }) }));
    expect(await healthHandler.probeTokenRuntime()).toMatchObject({ status: 'contract_mismatch' });
  });

  test.each([
    ['BONDS_TOKEN_RUNTIME_HEALTH_URL', 'http://runtime.example.test/health'],
    ['BONDS_TOKEN_RUNTIME_HEALTH_URL', 'https://name:secret@runtime.example.test/health'],
    ['BONDS_TOKEN_RUNTIME_HEALTH_URL', 'https://runtime.example.test/health?token=secret'],
    ['BONDS_TOKEN_RUNTIME_HEALTH_URL', 'https://runtime.example.test/health#fragment'],
    ['BONDS_TOKEN_RUNTIME_HEALTH_URL', 'https://runtime.example.test/status'],
    ['BONDS_TOKEN_INTROSPECTION_URL', 'https://other.example.test/introspect'],
    ['BONDS_TOKEN_BROKER_URL', 'https://other.example.test/broker/issue'],
    ['BONDS_TOKEN_BROKER_URL', 'http://runtime.example.test/broker/issue'],
    ['BONDS_TOKEN_BROKER_URL', 'https://runtime.example.test/broker/wrong'],
    ['BONDS_TOKEN_EXPECTED_BUILD_COMMIT', 'unknown']
  ])('invalid runtime configuration is rejected before a request: %s', async (key, value) => {
    process.env[key] = value;
    expect(await healthHandler.probeTokenRuntime()).toMatchObject({ status: 'invalid_configuration' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('an introspection endpoint that accepts unauthenticated requests is not ready', async () => {
    global.fetch = jest.fn(async (url, options) => url.endsWith('/introspect')
      ? { ok: true, status: 200, json: async () => ({ runtime: runtimeIdentity, claims: { active: false } }) }
      : runtimeFetch(url, options));
    expect(await healthHandler.probeTokenRuntime()).toMatchObject({
      status: 'channel_unverified', code: 'TOKEN_CHANNEL_AUTH_NOT_ENFORCED'
    });
  });

  test.each([{ status: 'ok' }, { claims: { active: true } }, { claims: { active: 'false' } }])(
    'an invalid introspection contract does not pass: %j', async payload => {
      global.fetch = jest.fn(async (url, options) => url.endsWith('/introspect') && options.headers['X-Bonds-Channel']
        ? { ok: true, status: 200, json: async () => ({ runtime: runtimeIdentity, ...payload }) }
        : runtimeFetch(url, options));
      expect(await healthHandler.probeTokenRuntime()).toMatchObject({
        status: 'contract_mismatch', code: 'TOKEN_RUNTIME_INTROSPECTION_CONTRACT_MISMATCH'
      });
    }
  );

  test('an unreachable unauthenticated probe does not prove protection', async () => {
    global.fetch = jest.fn(async (url, options) => {
      if (url.endsWith('/introspect') && !options.headers['X-Bonds-Channel']) throw new Error('unreachable');
      return runtimeFetch(url, options);
    });
    expect(await healthHandler.probeTokenRuntime()).toMatchObject({
      status: 'channel_unverified', code: 'TOKEN_CHANNEL_PROTECTION_UNVERIFIED'
    });
  });

  test('readiness uses channel auth, rejects redirects and does not reveal credentials', async () => {
    const result = await healthHandler.probeTokenRuntime();
    expect(result.status).toBe('ok');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const calls = global.fetch.mock.calls;
    expect(calls[0][1].headers['X-Bonds-Channel']).toBe(channelSecret);
    expect(calls.filter(([, options]) => options.headers['X-Bonds-Channel'])).toHaveLength(2);
    for (const [, options] of calls) {
      expect(options.redirect).toBe('error');
      expect(options.cache).toBe('no-store');
      expect(options.headers.Authorization).toBeUndefined();
      expect(options.headers['X-Bonds-Admin']).toBeUndefined();
    }
    expect(JSON.stringify(result)).not.toContain(channelSecret);
  });
});
