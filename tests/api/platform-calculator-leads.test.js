/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockSingle = jest.fn();
const mockIs = jest.fn();
const mockLte = jest.fn();
const mockGte = jest.fn();

function createChain(result = { data: null, error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (cb) => cb(result)
  };
  return chain;
}

const mockSupabaseClient = {
  from: mockFrom,
  auth: { getUser: jest.fn() }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));
jest.mock('../../lib/api/email', () => ({
  sendEmail: jest.fn(() => Promise.resolve({ success: true }))
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(false))
}));

const handler = require('../../api/platform');

function mockReq(overrides = {}) {
  return {
    method: 'POST',
    headers: { host: 'localhost' },
    query: {},
    body: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    _json: null,
    _sent: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; },
    json(data) { this._json = data; return this; },
    send(data) { this._sent = data; return this; }
  };
  return res;
}

describe('/api/capture-lead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => createChain({ data: { id: 1 }, error: null }));
  });

  test('captures a valid lead and returns success', async () => {
    const req = mockReq({
      url: '/api/capture-lead',
      body: { email: 'test@example.com', calculator: 'break-even', lang: 'ar', source: 'exit_intent' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('accepts invalid email and marks it invalid', async () => {
    const req = mockReq({
      url: '/api/capture-lead',
      body: { email: 'not-an-email', calculator: 'break-even' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.validation_status).toBe('invalid');
  });

  test('accepts missing email and marks it invalid', async () => {
    const req = mockReq({
      url: '/api/capture-lead',
      body: { calculator: 'break-even' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.validation_status).toBe('invalid');
  });

  test('accepts incomplete lead with missing phone/city/activity', async () => {
    const req = mockReq({
      url: '/api/capture-lead',
      body: { email: 'test@example.com', calculator: 'break-even' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.validation_status).toBe('invalid');
  });
});

describe('/api/unsubscribe-lead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => createChain({ data: null, error: null }));
  });

  test('unsubscribes with a token', async () => {
    const req = mockReq({
      method: 'GET',
      url: '/api/unsubscribe-lead?token=abc123',
      query: { token: 'abc123' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._sent).toMatch(/unsubscribed|إلغاء/);
  });

  test('requires token', async () => {
    const req = mockReq({ method: 'GET', url: '/api/unsubscribe-lead' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/Token required/);
  });
});

describe('/api/calculator-email-journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ error: new Error('no auth'), data: null });
  });

  test('rejects unauthorized requests', async () => {
    const req = mockReq({ url: '/api/calculator-email-journey' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

describe('/api/mark-lead-converted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockFromForMarkLeadConverted(adminRole = null) {
    mockFrom.mockImplementation((table) => {
      if (table === 'admin_roles') {
        return createChain({ data: adminRole, error: null });
      }
      if (table === 'calculator_leads') {
        return createChain({ data: null, error: null });
      }
      return createChain({ data: null, error: null });
    });
  }

  test('rejects unauthenticated requests', async () => {
    mockFromForMarkLeadConverted();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ error: new Error('no auth'), data: null });
    const req = mockReq({ url: '/api/mark-lead-converted', body: { email: 'test@example.com' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects marking a different email than the authenticated user', async () => {
    mockFromForMarkLeadConverted();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'owner@example.com' } },
      error: null
    });
    const req = mockReq({
      url: '/api/mark-lead-converted',
      headers: { host: 'localhost', authorization: 'Bearer test-token-u1' },
      body: { email: 'other@example.com' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });

  test('allows authenticated user to mark their own email', async () => {
    mockFromForMarkLeadConverted();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@example.com' } },
      error: null
    });
    const req = mockReq({
      url: '/api/mark-lead-converted',
      headers: { host: 'localhost', authorization: 'Bearer test-token-u1' },
      body: { email: 'test@example.com' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('allows admin to mark any email', async () => {
    mockFromForMarkLeadConverted({ role: 'admin' });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin1', email: 'admin@example.com' } },
      error: null
    });
    const req = mockReq({
      url: '/api/mark-lead-converted',
      headers: { host: 'localhost', authorization: 'Bearer test-token-admin' },
      body: { email: 'other@example.com' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('supports /api/calculator-leads/convert alias', async () => {
    mockFromForMarkLeadConverted();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@example.com' } },
      error: null
    });
    const req = mockReq({
      url: '/api/calculator-leads/convert',
      headers: { host: 'localhost', authorization: 'Bearer test-token-u1' },
      body: { email: 'test@example.com' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });
});

describe('/api/capture-lead retry behaviour', () => {
  const { sendEmail } = require('../../lib/api/email');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockFromWithFailedLog(attempts = 3) {
    mockFrom.mockImplementation((table) => {
      if (table === 'calculator_leads') {
        return createChain({ data: { id: 1, email: 'test@example.com' }, error: null });
      }
      if (table === 'calculator_email_sequences') {
        return createChain({ data: null, error: null });
      }
      if (table === 'calculator_email_send_logs') {
        return createChain({ data: { id: 99, attempts }, error: null });
      }
      return createChain({ data: null, error: null });
    });
  }

  test('skips sending when max retries exceeded', async () => {
    mockFromWithFailedLog(3);
    sendEmail.mockResolvedValue({ success: false, error: 'provider error' });
    const req = mockReq({
      url: '/api/capture-lead',
      body: { email: 'test@example.com', calculator: 'break-even', lang: 'ar', source: 'exit_intent' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });
});

describe('/api/calculator-leads/retention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ error: new Error('no auth'), data: null });
  });

  test('rejects unauthorized requests', async () => {
    const req = mockReq({ url: '/api/calculator-leads/retention' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
