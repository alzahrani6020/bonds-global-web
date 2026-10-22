/** @jest-environment node */
'use strict';

const { introspectServiceToken } = require('../../lib/security/service-token-verifier');

const url = 'https://runtime.example.test/introspect';
const channelSecret = 'isolated-channel-credential-12345678901234567890';
const token = 'bonds_service_isolated_acceptance_token';
const runtimeBuild = 'a'.repeat(40);
const runtimeIdentity = {
  status: 'ok', service: 'bonds-token-service', issuer: 'bonds-token-service',
  contract_version: 2, schema_version: 3, service_token_ttl_seconds: 3600,
  build_commit: runtimeBuild, channel_auth: 'required',
  broker_auth: 'required', broker_mode: 'one_time_service_tokens'
};
const activeClaims = {
  active: true, revoked: false, token_type: 'service',
  iss: 'bonds-token-service', sub: 'service:orchestrator', aud: 'research-intelligence',
  iat: 1_800_000_000, exp: 1_800_003_600, jti: 'isolated-jti', scope: ['research:read']
};

function verify(options = {}) {
  return introspectServiceToken({ token, url, channelSecret, expectedBuildCommit: runtimeBuild, ...options });
}

describe('protected service token introspection channel', () => {
  test('separates the inspected token from channel auth and never forwards user/admin auth', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ runtime: runtimeIdentity, claims: activeClaims }) }));
    const result = await verify({ fetchImpl });
    expect(result).toEqual({ verified: true, code: null, claims: activeClaims });
    const [target, options] = fetchImpl.mock.calls[0];
    expect(target).toBe(url);
    expect(options.headers).toEqual({
      accept: 'application/json', 'content-type': 'application/json', 'X-Bonds-Channel': channelSecret
    });
    expect(JSON.parse(options.body)).toEqual({ token });
    expect(options.redirect).toBe('error');
    expect(options.credentials).toBe('omit');
    expect(options.cache).toBe('no-store');
    expect(JSON.stringify(result)).not.toContain(channelSecret);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  test.each([
    [undefined, 'TOKEN_MISSING', 403], ['', 'TOKEN_MISSING', 403], ['   ', 'TOKEN_MISSING', 403]
  ])('missing token %p is denied before any request', async (supplied, code, httpStatus) => {
    const fetchImpl = jest.fn();
    expect(await verify({ token: supplied, fetchImpl })).toEqual({ verified: false, code, httpStatus });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    ['', 'TOKEN_VERIFIER_UNCONFIGURED'],
    ['http://127.0.0.1:8771/introspect', 'TOKEN_VERIFIER_INVALID_CONFIGURATION'],
    ['http://runtime.example.test/introspect', 'TOKEN_VERIFIER_INVALID_CONFIGURATION'],
    ['https://user:password@runtime.example.test/introspect', 'TOKEN_VERIFIER_INVALID_CONFIGURATION'],
    ['https://runtime.example.test/introspect?credential=unsafe', 'TOKEN_VERIFIER_INVALID_CONFIGURATION'],
    ['https://runtime.example.test/introspect#fragment', 'TOKEN_VERIFIER_INVALID_CONFIGURATION'],
    ['https://runtime.example.test/issue', 'TOKEN_VERIFIER_INVALID_CONFIGURATION'],
    ['not-a-url', 'TOKEN_VERIFIER_INVALID_CONFIGURATION']
  ])('unsafe target %s fails without transmitting credentials', async (target, code) => {
    const fetchImpl = jest.fn();
    expect(await verify({ url: target, fetchImpl })).toEqual({ verified: false, code, httpStatus: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    ['', 'TOKEN_CHANNEL_UNCONFIGURED'], ['short', 'TOKEN_CHANNEL_INVALID_CONFIGURATION'],
    ['bonds_service_'.padEnd(64, 'x'), 'TOKEN_CHANNEL_INVALID_CONFIGURATION'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature', 'TOKEN_CHANNEL_INVALID_CONFIGURATION'],
    ['x'.repeat(32) + '\n' + 'y', 'TOKEN_CHANNEL_INVALID_CONFIGURATION'],
    ['x'.repeat(4097), 'TOKEN_CHANNEL_INVALID_CONFIGURATION']
  ])('invalid channel credential fails closed (%#)', async (secret, code) => {
    const fetchImpl = jest.fn();
    const result = await verify({ channelSecret: secret, fetchImpl });
    expect(result).toEqual({ verified: false, code, httpStatus: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('the channel credential cannot also be the inspected token', async () => {
    const fetchImpl = jest.fn();
    expect(await verify({ token: channelSecret, fetchImpl })).toEqual({
      verified: false, code: 'TOKEN_CREDENTIALS_NOT_SEPARATE', httpStatus: 503
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([401, 403])('channel rejection %s is an unavailable dependency, not a user grant failure', async status => {
    expect(await verify({ fetchImpl: async () => ({ ok: false, status }) })).toEqual({
      verified: false, code: 'TOKEN_CHANNEL_REJECTED', httpStatus: 503
    });
  });

  test.each([
    null, [], { status: 'ok' }, { claims: [] }, { claims: { active: 'true' } },
    { runtime: runtimeIdentity, claims: { ...activeClaims, revoked: undefined } },
    { runtime: runtimeIdentity, claims: { active: 'true' } },
    { runtime: runtimeIdentity, claims: [] }
  ])('malformed runtime claims are not a successful verification (%#)', async payload => {
    const result = await verify({ fetchImpl: async () => ({ ok: true, json: async () => payload }) });
    expect(result.verified).toBe(false);
    expect(result.httpStatus).toBe(503);
  });

  test.each([{ active: false }, { ...activeClaims, revoked: true }, { ...activeClaims, active: false }])(
    'inactive and revoked tokens are denied (%#)', async claims => {
      expect(await verify({ fetchImpl: async () => ({ ok: true, json: async () => ({ runtime: runtimeIdentity, claims }) }) })).toEqual({
        verified: false, code: 'TOKEN_INACTIVE', httpStatus: 403
      });
    }
  );

  test('a runtime user token cannot substitute for a service token', async () => {
    expect(await verify({ fetchImpl: async () => ({
      ok: true, json: async () => ({ runtime: runtimeIdentity, claims: { ...activeClaims, token_type: 'user' } })
    }) })).toEqual({ verified: false, code: 'TOKEN_TYPE_INVALID', httpStatus: 403 });
  });

  test('redirected responses and transport errors do not reveal credentials', async () => {
    for (const fetchImpl of [
      async () => ({ ok: true, redirected: true }),
      async () => { throw new Error(`private transport detail ${channelSecret}`); }
    ]) {
      const result = await verify({ fetchImpl });
      expect(result).toEqual({ verified: false, code: 'TOKEN_INTROSPECTION_FAILED', httpStatus: 503 });
      expect(JSON.stringify(result)).not.toContain(channelSecret);
    }
  });

  test.each(['', 'unknown', 'a'.repeat(39)])('missing or malformed runtime pin %p cannot verify a token', async expectedBuildCommit => {
    const fetchImpl = jest.fn();
    expect(await verify({ expectedBuildCommit, fetchImpl })).toMatchObject({ verified: false, httpStatus: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test.each([
    undefined, { ...runtimeIdentity, build_commit: 'b'.repeat(40) },
    { ...runtimeIdentity, service: 'other-runtime' },
    { ...runtimeIdentity, contract_version: 1 },
    { ...runtimeIdentity, schema_version: 2 },
    { ...runtimeIdentity, channel_auth: 'optional' },
    { ...runtimeIdentity, broker_auth: 'optional' },
    { ...runtimeIdentity, broker_mode: 'reusable' }
  ])('claims from an old or different runtime cannot execute (%#)', async runtime => {
    expect(await verify({ fetchImpl: async () => ({ ok: true, json: async () => ({ runtime, claims: activeClaims }) }) }))
      .toEqual({ verified: false, code: 'TOKEN_RUNTIME_CONTRACT_MISMATCH', httpStatus: 503 });
  });

  test.each([NaN, Infinity, 0, -1, 10001])('invalid timeout %p cannot disable the request deadline', async timeoutMs => {
    const fetchImpl = jest.fn();
    expect(await verify({ timeoutMs, fetchImpl })).toEqual({
      verified: false, code: 'TOKEN_VERIFIER_INVALID_CONFIGURATION', httpStatus: 503
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('a timed-out request is aborted and never verifies', async () => {
    let signal;
    const fetchImpl = async (_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal;
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    expect(await verify({ timeoutMs: 15, fetchImpl })).toEqual({
      verified: false, code: 'TOKEN_INTROSPECTION_FAILED', httpStatus: 503
    });
    expect(signal.aborted).toBe(true);
  });
});
