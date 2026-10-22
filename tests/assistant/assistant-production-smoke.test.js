/** @jest-environment node */
'use strict';

const { EventEmitter } = require('events');
const mockDb = { rpc: jest.fn(), from: jest.fn() };
jest.mock('../../v3/lib/supabase', () => ({ getSupabaseClient: () => mockDb }));

const { assistantRouter } = require('../../v3/api/assistant');
const { capabilitiesRouter } = require('../../v3/api/capabilities');
const { assertAssistantProduction } = require('../../scripts/assistant-production-smoke');

const TOKEN = 'fixture-session-not-a-real-token';
const SHA = '73198471595d4948d5e9db00f5f857b61b2ff61c';
const USER = { id: '11111111-1111-4111-8111-111111111111' };

describe('Assistant production acceptance', () => {
  let auditEvents;
  let ledger;
  let requests;
  let log;

  beforeEach(() => {
    auditEvents = [];
    ledger = new Map();
    requests = [];
    log = jest.fn();
    mockDb.rpc.mockReset();
    mockDb.from.mockReset();
    mockDb.from.mockImplementation(table => {
      if (!['profiles', 'subscriptions'].includes(table)) {
        throw new Error(`Unexpected table access: ${table}`);
      }
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { id: USER.id, status: 'active' }, error: null }),
        limit: async () => ({ data: [], error: null })
      };
      return query;
    });
    mockDb.rpc.mockImplementation(async (name, payload) => {
      if (name === 'get_user_permissions') return { data: [], error: null };
      if (name === 'assistant_append_action_audit') {
        auditEvents.push(payload);
        return { data: `audit-${auditEvents.length}`, error: null };
      }
      const existing = ledger.get(payload.p_idempotency_key);
      if (name === 'assistant_claim_idempotency') {
        if (!existing) {
          ledger.set(payload.p_idempotency_key, {
            fingerprint: payload.p_action_fingerprint, status: 'started'
          });
          return { data: { state: 'claimed', status: 'started' }, error: null };
        }
        const state = existing.fingerprint !== payload.p_action_fingerprint ? 'key_conflict' :
          existing.status === 'uncertain' ? 'uncertain' : 'in_progress';
        return { data: { state, status: existing.status }, error: null };
      }
      if (name === 'assistant_resolve_idempotency') {
        if (!existing) return { data: { state: 'missing' }, error: null };
        existing.status = payload.p_status;
        return { data: { state: 'resolved_uncertain', status: existing.status, result: null }, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
  });

  // Exercise the real Assistant/Capability routers and adapters. Only session
  // validation and the durable database boundary are fixtures in this test.
  function routeFetch(url, options = {}) {
    requests.push({ url, options });
    const path = new URL(url).pathname.replace(/^\/api\/v3/, '');
    const req = new EventEmitter();
    req.method = options.method;
    req.headers = Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) =>
      [key.toLowerCase(), value]));
    const user = req.headers.authorization === `Bearer ${TOKEN}` ? USER : null;
    return new Promise((resolve, reject) => {
      const headers = {};
      const res = { statusCode: 200,
        setHeader: (key, value) => { headers[key] = value; },
        end: body => resolve(new Response(body, { status: res.statusCode, headers })) };
      const execution = path.startsWith('/capabilities')
        ? capabilitiesRouter(req, res, path, user, { supabase: mockDb })
        : assistantRouter(req, res, path, user);
      execution.catch(reject);
      process.nextTick(() => {
        if (options.body !== undefined) req.emit('data', Buffer.from(options.body));
        req.emit('end');
      });
    });
  }

  const run = fetchImpl => assertAssistantProduction({
    baseUrl: 'https://bonds-global.com', token: TOKEN, expectedSha: SHA, fetchImpl, log
  });

  function mutateResponse(predicate, mutate) {
    return async (url, options) => {
      const response = await routeFetch(url, options);
      if (!predicate(url, options)) return response;
      const body = await response.json();
      mutate(body);
      return new Response(JSON.stringify(body), { status: response.status, headers: response.headers });
    };
  }

  test('accepts real contracts and emits isolated audit markers without saving a customer form', async () => {
    const result = await run(routeFetch);
    expect(result.marker).toMatch(/^assistant-smoke-73198471595d-[0-9a-f-]{36}$/);
    expect(result.requestCount).toBe(requests.length);
    expect(result.idempotencyState).toBe('uncertain');
    expect([...ledger.values()]).toEqual([{ fingerprint: expect.any(String), status: 'uncertain' }]);
    expect(auditEvents.filter(event => event.p_session_id === result.marker)).toHaveLength(9);
    expect(auditEvents.filter(event => event.p_metadata?.request_id === result.marker)
      .map(event => event.p_event_type)).toEqual(['execution_started', 'execution_succeeded']);
    expect(auditEvents.some(event => event.p_event_type === 'write_succeeded')).toBe(false);
    expect(mockDb.rpc.mock.calls.filter(([name]) => name === 'assistant_resolve_idempotency')
      .every(([, payload]) => payload.p_status === 'uncertain' && payload.p_result === null)).toBe(true);
    expect(requests.every(({ url }) => new URL(url).pathname.startsWith('/api/v3/assistant') ||
      new URL(url).pathname === '/api/v3/capabilities/execute')).toBe(true);
    expect(requests.slice(0, 3).every(({ options }) => !options.headers.Authorization)).toBe(true);
    expect(requests.every(({ options }) => options.redirect === 'error')).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(auditEvents)).not.toContain(TOKEN);
  });

  test('fails when a nominally successful contract drops a forbidden execution field', async () => {
    const fetchImpl = mutateResponse(url => url.endsWith('/assistant/contract'), body => {
      body.action.forbidden_fields = body.action.forbidden_fields.filter(field => field !== 'sql');
    });
    await expect(run(fetchImpl)).rejects.toThrow('protocol and forbidden execution fields');
    expect(ledger.size).toBe(0);
  });

  test('fails when confirmation is incorrectly elevated to authorization', async () => {
    const fetchImpl = mutateResponse(url => url.endsWith('/assistant/confirmation/resolve'), body => {
      if (body.confirmation) body.confirmation.execution_authorized = true;
    });
    await expect(run(fetchImpl)).rejects.toThrow('confirmation remains intent only');
    expect(ledger.size).toBe(0);
  });

  test('fails on a successful HTTP response that did not execute under governance', async () => {
    const fetchImpl = mutateResponse((url, options) => url.endsWith('/capabilities/execute') &&
      Boolean(options.headers.Authorization), body => { body.governance.enforced = false; });
    await expect(run(fetchImpl)).rejects.toThrow('governed registered navigation');
    expect(ledger.size).toBe(0);
  });

  test('fails if uncertain replay is misreported despite its expected HTTP status', async () => {
    const fetchImpl = mutateResponse(url => url.endsWith('/assistant/idempotency/claim'), body => {
      if (body.idempotency?.state === 'uncertain') body.idempotency.state = 'replay_succeeded';
    });
    await expect(run(fetchImpl)).rejects.toThrow('uncertain replay cannot authorize another write');
    expect([...ledger.values()][0].status).toBe('uncertain');
  });

  test('marks the synthetic claim uncertain when an intermediate response fails verification', async () => {
    const fetchImpl = mutateResponse(url => url.endsWith('/assistant/idempotency/claim'), body => {
      if (body.idempotency?.state === 'claimed') body.idempotency.action_fingerprint = 'wrong';
    });
    await expect(run(fetchImpl)).rejects.toThrow('durable idempotency claim');
    expect([...ledger.values()][0].status).toBe('uncertain');
    expect(auditEvents.some(event => event.p_event_type === 'write_succeeded')).toBe(false);
  });

  test('sanitizes transport failure messages and never logs response payloads or credentials', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error(`Authorization: Bearer ${TOKEN}`));
    let failure;
    try { await run(fetchImpl); } catch (error) { failure = error; }
    expect(failure.message).toContain('Assistant smoke request failed');
    expect(failure.message).not.toContain(TOKEN);
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
  });
});
