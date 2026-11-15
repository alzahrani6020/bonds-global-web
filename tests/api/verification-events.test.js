/**
 * @jest-environment node
 */

const crypto = require('crypto');

// One shared supabase mock: each test points mockState.sb at its own client.
const mockState = { sb: null };

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockState.sb));
jest.mock('../../lib/api/email', () => ({ sendEmail: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(false))
}));

const { handler: correspondenceHandler } = require('../../lib/api/correspondence');
const adminHandler = require('../../api/admin.js');

// ── Correspondence public verify: atomic RPC + verification event log ──

const ISSUE = {
  id: 'issue-1',
  document_id: 'doc-1',
  issue_version: 1,
  issue_number: 'OUT-2026-0042',
  verification_token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  state: 'active',
  document_version: 1,
  document_hash: 'doc-hash',
  issued_hash: 'issued-hash',
  pdf_hash: 'pdf-hash',
  signature_hash: null,
  stamp_hash: null,
  issued_at: '2026-11-10T10:00:00.000Z',
  revocation_reason: null,
  verification_count: 4,
  supersedes_issue_id: null
};

const DOC = {
  id: 'doc-1',
  title: 'خطاب تجريبي',
  subject: 'اختبار',
  status: 'sent',
  current_version: 1,
  signature_hash: null,
  stamp_hash: null,
  signed_at: null,
  stamped_at: null,
  sent_at: '2026-11-10T11:00:00.000Z',
  archived_at: null,
  artifact_path: null,
  artifact_hash: null,
  artifact_document_hash: null,
  artifact_issued_hash: null,
  artifact_version: 0,
  confidentiality: 'internal'
};

function createCorrespondenceMock({ rpcResult, eventError } = {}) {
  const calls = { rpc: [], insert: [], update: [] };
  let issueLookupCount = 0;
  const makeChain = (table) => ({
    select: () => makeChain(table),
    insert: (rows) => {
      calls.insert.push({ table, rows });
      return { error: eventError || null };
    },
    update: (set) => {
      calls.update.push({ table, set });
      return makeChain(table);
    },
    eq: () => makeChain(table),
    order: () => makeChain(table),
    limit: () => makeChain(table),
    maybeSingle: () => {
      if (table === 'correspondence_issues') {
        issueLookupCount += 1;
        // First lookup is the token lookup; later ones are the successor query.
        return Promise.resolve(issueLookupCount === 1 ? { data: ISSUE, error: null } : { data: null, error: null });
      }
      if (table === 'correspondence_documents') return Promise.resolve({ data: DOC, error: null });
      return Promise.resolve({ data: null, error: null });
    }
  });
  const sb = {
    from: (table) => makeChain(table),
    rpc: (name, args) => {
      calls.rpc.push({ name, args });
      return Promise.resolve(rpcResult || { data: 5, error: null });
    }
  };
  return { sb, calls };
}

function verifyReq(overrides = {}) {
  return {
    method: 'GET',
    url: '/api/correspondence?action=verify&token=' + ISSUE.verification_token,
    headers: {
      host: 'localhost',
      'x-forwarded-for': '203.0.113.7, 70.41.3.18',
      'user-agent': 'BondsVerifyTest/1.0'
    },
    query: { action: 'verify', token: ISSUE.verification_token },
    ...overrides
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; },
    send(data) { this.body = data; return this; }
  };
}

describe('correspondence public verify — atomic counter and event log', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    mockState.sb = null;
  });

  test('increments via atomic RPC and returns the new count', async () => {
    const mock = createCorrespondenceMock();
    mockState.sb = mock.sb;

    const res = mockRes();
    await correspondenceHandler(verifyReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.verification_count).toBe(5);
    expect(mock.calls.rpc).toEqual([
      { name: 'increment_issue_verification_count', args: { p_issue_id: ISSUE.id } }
    ]);
    // The old non-atomic read-then-update path must not run when the RPC succeeds.
    expect(mock.calls.update.filter(c => c.table === 'correspondence_issues')).toEqual([]);
  });

  test('records a verification event with hashed ip/user-agent and public actor', async () => {
    const mock = createCorrespondenceMock();
    mockState.sb = mock.sb;

    const res = mockRes();
    await correspondenceHandler(verifyReq(), res);

    expect(res.statusCode).toBe(200);
    const eventInsert = mock.calls.insert.find(c => c.table === 'correspondence_verification_events');
    expect(eventInsert).toBeTruthy();
    expect(eventInsert.rows).toEqual({
      issue_id: ISSUE.id,
      document_id: ISSUE.document_id,
      issue_number: ISSUE.issue_number,
      actor_user_id: null,
      result: 'verified',
      ip_hash: crypto.createHash('sha256').update('203.0.113.7', 'utf8').digest('hex'),
      user_agent_hash: crypto.createHash('sha256').update('BondsVerifyTest/1.0', 'utf8').digest('hex')
    });
  });

  test('event insert failure is logged server-side and does not block the public response', async () => {
    const mock = createCorrespondenceMock({ eventError: { message: 'events table missing' } });
    mockState.sb = mock.sb;

    const res = mockRes();
    await correspondenceHandler(verifyReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('falls back to read-then-update when the RPC is unavailable', async () => {
    const mock = createCorrespondenceMock({ rpcResult: { data: null, error: { message: 'rpc missing' } } });
    mockState.sb = mock.sb;

    const res = mockRes();
    await correspondenceHandler(verifyReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.verification_count).toBe(ISSUE.verification_count + 1);
    const issueUpdate = mock.calls.update.find(c => c.table === 'correspondence_issues');
    expect(issueUpdate.set.verification_count).toBe(ISSUE.verification_count + 1);
  });
});

// ── Admin verification-events action: filtering, pagination, permissions ──

const USERS = {
  'valid-admin-token': { id: 'admin-1', email: 'admin@example.com' },
  'valid-nonadmin-token': { id: 'user-1', email: 'user@example.com' }
};

function createAdminMock({ events = [], count = 0 } = {}) {
  const recorded = { filters: [], range: null, selectCalls: [] };
  const makeChain = (table) => {
    const chain = {
      select: (cols, opts) => {
        recorded.selectCalls.push({ table, cols, count: opts?.count === 'exact' });
        return makeChain(table);
      },
      insert: () => makeChain(table),
      update: () => makeChain(table),
      eq: (col, val) => { recorded.filters.push({ op: 'eq', col, val }); return chain; },
      ilike: (col, val) => { recorded.filters.push({ op: 'ilike', col, val }); return chain; },
      gte: (col, val) => { recorded.filters.push({ op: 'gte', col, val }); return chain; },
      lte: (col, val) => { recorded.filters.push({ op: 'lte', col, val }); return chain; },
      order: () => chain,
      limit: () => chain,
      range: (from, to) => { recorded.range = { from, to }; return chain; },
      single: () => mockResolve(table),
      maybeSingle: () => mockResolve(table),
      then: (resolve) => mockResolve(table).then(resolve)
    };
    return chain;
  };
  function mockResolve(table) {
    if (table === 'admin_roles') {
      const f = recorded.filters.find(x => x.col === 'user_id');
      return Promise.resolve(f?.val === USERS['valid-admin-token'].id
        ? { data: { role: 'admin' }, error: null }
        : { data: null, error: { message: 'not found' } });
    }
    if (table === 'site_settings') return Promise.resolve({ data: { value: 'false' }, error: null });
    if (table === 'correspondence_verification_events') {
      return Promise.resolve({ data: events, error: null, count });
    }
    return Promise.resolve({ data: [], error: null });
  }
  const sb = {
    from: (table) => makeChain(table),
    auth: {
      getUser: jest.fn(async (token) => USERS[token]
        ? { data: { user: USERS[token] }, error: null }
        : { data: { user: null }, error: { message: 'Invalid token' } })
    }
  };
  return { sb, recorded };
}

function adminReq({ method = 'GET', action = 'verification-events', query = {}, token = 'valid-admin-token' } = {}) {
  return {
    method,
    url: `/api/admin?action=${action}`,
    headers: token ? { authorization: `Bearer ${token}`, host: 'localhost' } : { host: 'localhost' },
    query: { action, ...query },
    body: {}
  };
}

function adminRes() {
  return {
    statusCode: null,
    headers: {},
    ended: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.ended = JSON.stringify(data); return this; },
    end(data) { this.ended = data; return this; }
  };
}

describe('/api/admin verification-events action', () => {
  const adminMockRef = { recorded: null };
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mock = createAdminMock({
      events: [
        {
          id: 'ev-1',
          issue_id: 'issue-1',
          document_id: 'doc-1',
          issue_number: 'OUT-2026-0042',
          actor_user_id: null,
          result: 'verified',
          ip_hash: 'abc',
          user_agent_hash: 'def',
          created_at: '2026-11-14T08:00:00.000Z'
        }
      ],
      count: 1
    });
    mockState.sb = mock.sb;
    adminMockRef.recorded = mock.recorded;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    mockState.sb = null;
  });

  test('requires an admin bearer token (401 without one)', async () => {
    const res = adminRes();
    await adminHandler(adminReq({ token: null }), res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects non-admin users (403)', async () => {
    const res = adminRes();
    await adminHandler(adminReq({ token: 'valid-nonadmin-token' }), res);
    expect(res.statusCode).toBe(403);
  });

  test('returns paginated events for admins', async () => {
    const res = adminRes();
    await adminHandler(adminReq({ query: { limit: '10', offset: '20' } }), res);

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.ended || '{}');
    expect(json.success).toBe(true);
    expect(json.events).toHaveLength(1);
    expect(json.count).toBe(1);
    expect(json.limit).toBe(10);
    expect(json.offset).toBe(20);
    expect(adminMockRef.recorded.range).toEqual({ from: 20, to: 29 });
    // Join to the issue is requested with an exact count for pagination.
    const selectCall = adminMockRef.recorded.selectCalls.find(c => c.table === 'correspondence_verification_events');
    expect(selectCall.count).toBe(true);
    expect(String(selectCall.cols)).toContain('correspondence_issues');
  });

  test('applies issue_number and date range filters', async () => {
    const res = adminRes();
    await adminHandler(adminReq({
      query: { issue_number: 'OUT-2026', from: '2026-11-01', to: '2026-11-30' }
    }), res);

    expect(res.statusCode).toBe(200);
    const ops = adminMockRef.recorded.filters;
    expect(ops).toContainEqual({ op: 'ilike', col: 'issue_number', val: '%OUT-2026%' });
    expect(ops.some(f => f.op === 'gte' && f.col === 'created_at')).toBe(true);
    expect(ops.some(f => f.op === 'lte' && f.col === 'created_at')).toBe(true);
  });
});
