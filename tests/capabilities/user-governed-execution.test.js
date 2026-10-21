/** @jest-environment node */
'use strict';

const { EventEmitter } = require('node:events');
const { capabilitiesRouter } = require('../../v3/api/capabilities');
const { executeCapability } = require('../../lib/capabilities/governed-executor');
const { evaluateGovernance, MemoryRateLimiter } = require('../../lib/capabilities/governance-gateway');
const { SERVICES, CAPABILITIES } = require('../../lib/capabilities/bonds-capability-registry');
const { RUNTIME_ADAPTERS } = require('../../lib/capabilities/runtime-adapters');
const { probeUserGovernanceReadiness } = require('../../lib/capabilities/user-governance-context');
const { createGovernanceFixture } = require('../helpers/capability-governance-fixture');

const input = {
  sources: [
    { publisher: 'Fixture Publisher A', claims: [{ key: 'fixture-count', value: 2 }] },
    { publisher: 'Fixture Publisher B', claims: [{ key: 'fixture-count', value: 2 }] }
  ]
};

async function request(fixture, { user = fixture.user, body = {}, headers = {} } = {}) {
  const req = new EventEmitter();
  Object.assign(req, { method: 'POST', headers, destroy() {} });
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = JSON.parse(value); } };
  const pending = capabilitiesRouter(req, res, '/capabilities/execute', user, { supabase: fixture.db });
  req.emit('data', JSON.stringify({ action: 'evidence_verify', input, ...body }));
  req.emit('end');
  await pending;
  return res;
}

function override(fixture, value, changes = {}) {
  return {
    user_id: fixture.user.id, organization_id: null, entitlement_key: 'research.web', value,
    starts_at: new Date(Date.now() - 60_000).toISOString(), expires_at: null, revoked_at: null,
    ...changes
  };
}

function trustedContext() {
  return {
    actor: { id: 'trusted-user' }, userId: 'trusted-user', userTier: 'pro',
    governance: { permissions: ['research.web.read'], entitlements: ['research.web'] }
  };
}

describe('user authorization through the real capability execution path', () => {
  test('authorized user executes the existing pure capability through API, gateway and executor', async () => {
    const res = await request(createGovernanceFixture());
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, executed: true, action: 'evidence_verify',
      governance: { enforced: true }, result: { verification_state: 'SUPPORTED' } });
    expect(res.body.verification_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test('service header alone cannot replace a user session', async () => {
    const fixture = createGovernanceFixture();
    const res = await request(fixture, { user: null, headers: { 'x-bonds-service-token': 'fixture-only' } });
    expect(res.statusCode).toBe(401);
    expect(fixture.reads).toEqual([]);
  });

  test('a user without the required permission is denied before capability execution', async () => {
    const res = await request(createGovernanceFixture({ permissions: [] }));
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ ok: false, executed: false, error: { code: 'PERMISSION_DENIED' } });
  });

  test('a user without the plan entitlement is denied', async () => {
    const fixture = createGovernanceFixture();
    fixture.tables.admin_plan_entitlements[0].value = false;
    const res = await request(fixture);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ executed: false, error: { code: 'ENTITLEMENT_DENIED' } });
  });

  test.each(['active', 'trialing'])('a %s subscription is usable only inside its current period', async status => {
    const fixture = createGovernanceFixture();
    fixture.tables.subscriptions[0].status = status;
    expect((await request(fixture)).statusCode).toBe(200);
    fixture.tables.subscriptions[0].current_period_end = new Date(Date.now() - 1).toISOString();
    const expired = await request(fixture);
    expect(expired.statusCode).toBe(403);
    expect(expired.body.error.code).toBe('ENTITLEMENT_DENIED');
  });

  test('a future subscription cannot grant a paid entitlement', async () => {
    const fixture = createGovernanceFixture();
    fixture.tables.subscriptions[0].current_period_start = new Date(Date.now() + 60_000).toISOString();
    const res = await request(fixture);
    expect(res.statusCode).toBe(403);
    expect(res.body.executed).toBe(false);
  });

  test('absence of a subscription uses free catalog policy without inferring a paid tier', async () => {
    const fixture = createGovernanceFixture({ tables: { subscriptions: [] } });
    expect((await request(fixture)).statusCode).toBe(403);
    fixture.tables.admin_entitlements[0].default_value = true;
    expect((await request(fixture)).statusCode).toBe(200);
  });

  test.each(['current_period_start', 'current_period_end'])('a missing %s on an active subscription is unavailable', async field => {
    const fixture = createGovernanceFixture();
    fixture.tables.subscriptions[0][field] = null;
    const res = await request(fixture);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ executed: false, error: { code: 'SUBSCRIPTION_INVALID' } });
  });

  test('conflicting active plans are not resolved by selecting the higher tier', async () => {
    const fixture = createGovernanceFixture();
    fixture.tables.subscriptions.push({ ...fixture.tables.subscriptions[0], tier: 'enterprise' });
    const res = await request(fixture);
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe('SUBSCRIPTION_CONFLICT');
  });

  test.each(['inactive', 'disabled', 'banned'])('profile state %s blocks an otherwise authorized user', async status => {
    const fixture = createGovernanceFixture();
    fixture.tables.profiles[0].status = status;
    const res = await request(fixture);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ executed: false, error: { code: 'USER_DISABLED' } });
  });

  test.each(['profiles', 'get_user_permissions', 'subscriptions', 'admin_entitlements',
    'admin_plan_entitlements', 'admin_entitlement_overrides'])('%s lookup failure is unavailable, never a successful fallback', async table => {
    const res = await request(createGovernanceFixture({ failures: { [table]: true } }));
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ ok: false, executed: false });
  });

  test('an absent required entitlement catalog is not treated as a free grant', async () => {
    const res = await request(createGovernanceFixture({ tables: { admin_entitlements: [] } }));
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe('ENTITLEMENT_CATALOG_UNAVAILABLE');
  });

  test('body identity, roles, tier and user_metadata cannot confer permission', async () => {
    const fixture = createGovernanceFixture({ permissions: [] });
    fixture.user.user_metadata = { role: 'admin', permissions: ['research.web.read'], tier: 'enterprise' };
    const res = await request(fixture, { body: {
      userId: 'another-user', userTier: 'enterprise', actor: { id: 'another-user' },
      governance: { permissions: ['research.web.read'], entitlements: ['research.web'], enforcePermissions: false },
      options: { governance: { permissions: ['research.web.read'] } }
    } });
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('PERMISSION_DENIED');
    expect(fixture.reads.find(read => read.rpc).args).toEqual({ p_user_id: fixture.user.id });
    expect(JSON.stringify(res.body)).not.toContain('another-user');
  });

  test.each(['true', 1, { enabled: true }, null])('only literal true grants an entitlement: %p does not', async value => {
    const fixture = createGovernanceFixture();
    fixture.tables.admin_plan_entitlements[0].value = value;
    const res = await request(fixture);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('ENTITLEMENT_DENIED');
  });

  test('an active user override can grant access; a later overlapping override is an explicit conflict', async () => {
    const fixture = createGovernanceFixture({ tables: { subscriptions: [] } });
    fixture.tables.admin_entitlement_overrides = [override(fixture, true)];
    expect((await request(fixture)).statusCode).toBe(200);
    fixture.tables.admin_entitlement_overrides.push(override(fixture, false));
    const conflict = await request(fixture);
    expect(conflict.statusCode).toBe(503);
    expect(conflict.body.error.code).toBe('ENTITLEMENT_CONFLICT');
  });

  test.each(['expired', 'future', 'revoked'])('%s user override does not grant access', async state => {
    const fixture = createGovernanceFixture({ tables: { subscriptions: [] } });
    const changes = state === 'expired' ? { expires_at: new Date(Date.now() - 1).toISOString() }
      : state === 'future' ? { starts_at: new Date(Date.now() + 60_000).toISOString() }
        : { revoked_at: new Date().toISOString() };
    fixture.tables.admin_entitlement_overrides = [override(fixture, true, changes)];
    expect((await request(fixture)).statusCode).toBe(403);
  });

  test('an organization override cannot be granted from an unverified membership claim', async () => {
    const fixture = createGovernanceFixture({ tables: { subscriptions: [] } });
    fixture.user.user_metadata = { organization_id: 'claimed-organization' };
    fixture.tables.admin_entitlement_overrides = [override(fixture, true, {
      user_id: null, organization_id: 'claimed-organization'
    })];
    expect((await request(fixture)).statusCode).toBe(403);
    fixture.tables.admin_entitlement_overrides[0].user_id = fixture.user.id;
    const unresolved = await request(fixture);
    expect(unresolved.statusCode).toBe(503);
    expect(unresolved.body.error.code).toBe('ENTITLEMENT_SCOPE_UNRESOLVED');
  });

  test('a truncated override response cannot hide conflicting policy', async () => {
    const fixture = createGovernanceFixture();
    fixture.tables.admin_entitlement_overrides = Array.from({ length: 1001 }, () => override(fixture, true));
    const res = await request(fixture);
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe('ENTITLEMENT_CONTEXT_INCOMPLETE');
  });
});

describe('mandatory governance and trusted adapter context', () => {
  test.each([
    ['missing verifier', null],
    ['unavailable verifier', async () => { throw new Error('Unavailable transport'); }],
    ['empty verification result', async () => null]
  ])('%s is explicit unavailable rather than a token or user denial', async (_label, verifyServiceToken) => {
    const result = await evaluateGovernance({
      service: SERVICES['research-intelligence'],
      capability: CAPABILITIES.research_intelligence_verify,
      context: { ...trustedContext(), auth: { serviceToken: 'fixture-only' } },
      verifyServiceToken,
      rateLimiter: new MemoryRateLimiter()
    });
    expect(result).toMatchObject({ allowed: false, httpStatus: 503 });
  });

  test('the executor rejects absent authorization context explicitly', async () => {
    const result = await executeCapability('evidence_verify', input, { userId: 'unresolved-user' });
    expect(result).toMatchObject({ ok: false, executed: false, httpStatus: 503,
      error: { code: 'USER_GOVERNANCE_UNAVAILABLE' } });
  });

  test.each(['permissions', 'entitlements'])('false enforcement flags cannot disable %s requirements', async field => {
    const context = trustedContext();
    context.governance = { ...context.governance, enforcePermissions: false, enforceEntitlements: false, [field]: [] };
    const result = await executeCapability('evidence_verify', input, context);
    expect(result).toMatchObject({ executed: false, httpStatus: 403,
      error: { code: field === 'permissions' ? 'PERMISSION_DENIED' : 'ENTITLEMENT_DENIED' } });
  });

  test('changing the request id cannot reset the rate limit for the same verified actor', async () => {
    const context = trustedContext();
    const service = { ...SERVICES['web-research'], limits: { requestsPerMinute: 1 } };
    const rateLimiter = new MemoryRateLimiter();
    const first = await evaluateGovernance({ service, capability: CAPABILITIES.evidence_verify,
      context: { ...context, requestId: 'first' }, rateLimiter });
    const second = await evaluateGovernance({ service, capability: CAPABILITIES.evidence_verify,
      context: { ...context, requestId: 'second' }, rateLimiter });
    expect(first.allowed).toBe(true);
    expect(second).toMatchObject({ allowed: false, code: 'RATE_LIMITED' });
  });

  test('orchestrator adapter overwrites nested request identity and tier with server authority', async () => {
    const orchestrator = require('../../lib/orchestrator/intelligence-orchestrator');
    const run = jest.spyOn(orchestrator, 'run').mockImplementation(async value => value);
    try {
      const context = { ...trustedContext(), requestId: 'server-request' };
      const result = await RUNTIME_ADAPTERS.orchestrator_run({ request: {
        userId: 'forged-user', userTier: 'enterprise', requestId: 'forged-request', input: 'fixture'
      } }, context);
      expect(result.result).toMatchObject({ userId: 'trusted-user', userTier: 'pro', requestId: 'server-request' });
      expect(run).toHaveBeenCalledTimes(1);
      const denied = await RUNTIME_ADAPTERS.orchestrator_run({ request: { userTier: 'enterprise' } });
      expect(denied).toMatchObject({ executed: false, httpStatus: 503 });
      expect(run).toHaveBeenCalledTimes(1);
    } finally { run.mockRestore(); }
  });
});

describe('user governance metadata readiness', () => {
  const nilUuid = '00000000-0000-0000-0000-000000000000';
  const permissionCodes = ['research.web.read', 'ai.native.use', 'research.intelligence.execute', 'orchestrator.execute'];
  const entitlementKeys = ['research.web', 'ai.native', 'research.intelligence', 'orchestrator'];

  function readinessFixture(options = {}) {
    return createGovernanceFixture({
      userId: nilUuid, permissions: [],
      tables: {
        enterprise_permissions: permissionCodes.map(code => ({ code })),
        admin_entitlements: entitlementKeys.map(key => ({ key, value_type: 'boolean', default_value: false }))
      },
      ...options
    });
  }

  test('enabled-service metadata and an empty read-only permission probe establish readiness without granting access', async () => {
    const fixture = readinessFixture();
    const result = await probeUserGovernanceReadiness({ supabase: fixture.db });
    expect(result).toEqual({ status: 'ok', code: null });
    expect(fixture.reads.filter(read => read.table).map(read => read.table).sort())
      .toEqual(['admin_entitlements', 'enterprise_permissions']);
    expect(fixture.reads.find(read => read.rpc)).toEqual({ rpc: 'get_user_permissions', args: { p_user_id: nilUuid } });
    expect(fixture.reads.find(read => read.table === 'enterprise_permissions').filters[0].value.sort())
      .toEqual([...permissionCodes].sort());
    expect(fixture.reads.find(read => read.table === 'admin_entitlements').filters[0].value.sort())
      .toEqual([...entitlementKeys].sort());
    expect(JSON.stringify(fixture.reads)).not.toContain('agent.runtime');
    expect(result).not.toHaveProperty('permissions');
    expect(result).not.toHaveProperty('entitlements');
  });

  test.each(permissionCodes)('missing permission metadata %s prevents readiness', async code => {
    const fixture = readinessFixture();
    fixture.tables.enterprise_permissions = fixture.tables.enterprise_permissions.filter(row => row.code !== code);
    expect(await probeUserGovernanceReadiness({ supabase: fixture.db })).toEqual({
      status: 'error', code: 'PERMISSION_CATALOG_UNAVAILABLE'
    });
  });

  test.each([
    ['missing definition', null],
    ['nonboolean type', { value_type: 'json', default_value: true }],
    ['string default', { value_type: 'boolean', default_value: 'false' }],
    ['missing default', { value_type: 'boolean' }]
  ])('%s cannot establish a boolean service entitlement contract', async (_label, replacement) => {
    const fixture = readinessFixture();
    const key = 'research.intelligence';
    fixture.tables.admin_entitlements = fixture.tables.admin_entitlements.filter(row => row.key !== key);
    if (replacement) fixture.tables.admin_entitlements.push({ key, ...replacement });
    expect(await probeUserGovernanceReadiness({ supabase: fixture.db })).toEqual({
      status: 'error', code: 'ENTITLEMENT_CATALOG_UNAVAILABLE'
    });
  });

  test.each(['enterprise_permissions', 'admin_entitlements', 'get_user_permissions'])(
    '%s access failure is not readiness', async source => {
      const fixture = readinessFixture({ failures: { [source]: true } });
      expect(await probeUserGovernanceReadiness({ supabase: fixture.db })).toEqual({
        status: 'error', code: 'USER_GOVERNANCE_UNAVAILABLE'
      });
    }
  );

  test('nil UUID permission rows are rejected rather than treated as a synthetic authorized user', async () => {
    const fixture = readinessFixture({ permissions: ['unexpected-private-permission'] });
    const result = await probeUserGovernanceReadiness({ supabase: fixture.db });
    expect(result).toEqual({ status: 'error', code: 'USER_PERMISSION_PROBE_INVALID' });
    expect(JSON.stringify(result)).not.toContain('unexpected-private-permission');
  });

  test('exception details cannot leak through the metadata probe', async () => {
    const fixture = readinessFixture();
    fixture.db.rpc = async () => { throw new Error('isolated-private-credential-detail'); };
    const result = await probeUserGovernanceReadiness({ supabase: fixture.db });
    expect(result).toEqual({ status: 'error', code: 'USER_GOVERNANCE_UNAVAILABLE' });
    expect(JSON.stringify(result)).not.toContain('isolated-private-credential-detail');
  });

  test.each(['url', 'service_role'])('missing %s configuration cannot fall back to an anonymous client', async missing => {
    const names = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    try {
      process.env.SUPABASE_URL = 'https://isolated-database.example.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-server-credential';
      process.env.SUPABASE_ANON_KEY = 'isolated-anonymous-credential';
      if (missing === 'url') {
        delete process.env.SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
      expect(await probeUserGovernanceReadiness()).toEqual({
        status: 'not_configured', code: 'USER_GOVERNANCE_UNCONFIGURED'
      });
    } finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });
});
