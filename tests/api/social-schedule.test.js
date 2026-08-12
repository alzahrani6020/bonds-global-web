/**
 * @jest-environment node
 */

const mockSupabaseClient = {
  from: jest.fn(),
  auth: { getUser: jest.fn() }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));

const mockVerifyAdminOrEditor = jest.fn();
jest.mock('../../lib/api/admin-auth', () => ({
  verifyAdminOrEditor: (...args) => mockVerifyAdminOrEditor(...args)
}));

const handler = require('../../api/social-schedule');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    socket: {},
    ...overrides
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    _json: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; },
    json(data) { this._json = data; return this; }
  };
}

describe('/api/social-schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ error: null, data: { user: { id: 'user-123' } } });
  });

  test('GET rejects unauthenticated', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: false, reason: 'missing' });
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  test('GET lists scheduled posts', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    mockSupabaseClient.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: cb => cb({ data: [], error: null })
    }));
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: 'Bearer token' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.posts).toEqual([]);
  });

  test('POST validates platforms', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    const res = mockRes();
    await handler(mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { content: 'Hello', scheduledAt: '2030-01-01T00:00:00Z' }
    }), res);
    expect(res.statusCode).toBe(400);
  });

  test('POST validates future scheduledAt', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    const res = mockRes();
    await handler(mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { platforms: ['x'], content: 'Hello', scheduledAt: '2020-01-01T00:00:00Z' }
    }), res);
    expect(res.statusCode).toBe(400);
  });
});
