/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
const mockAuthGetUser = jest.fn();
const mockSupabaseClient = {
  from: mockFrom,
  auth: { getUser: mockAuthGetUser }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));

const mockVerifyAdminOrEditor = jest.fn();
jest.mock('../../lib/api/admin-auth', () => ({
  verifyAdminOrEditor: (...args) => mockVerifyAdminOrEditor(...args)
}));

const handler = require('../../api/reference-data');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    headers: {},
    body: {},
    ...overrides,
    query: { __route: 'depreciation-factors', ...(overrides.query || {}) }
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    _json: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; },
    json(data) { this._json = data; return this; }
  };
  return res;
}

describe('/api/depreciation-factors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthGetUser.mockResolvedValue({ error: null, data: { user: { id: 'user-123' } } });
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
  });

  test('handles OPTIONS request', async () => {
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('GET returns all factors', async () => {
    const data = [
      { asset_class: 'factory', factors: { economic: 1.2 }, methods: { accounting: 'straight-line' } }
    ];
    mockFrom.mockImplementation(() => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (cb) => cb({ data, error: null })
      };
      return chain;
    });

    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('GET filters by assetClass', async () => {
    const data = [{ asset_class: 'realEstate', factors: {}, methods: {} }];
    mockFrom.mockImplementation(() => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: (cb) => cb({ data, error: null })
      };
      return chain;
    });

    const req = mockReq({ query: { assetClass: 'realEstate' } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('POST rejects unauthenticated requests', async () => {
    mockVerifyAdminOrEditor.mockResolvedValueOnce({ authorized: false, reason: 'missing' });
    const req = mockReq({ method: 'POST' });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._json.success).toBe(false);
  });

  test('POST rejects invalid token', async () => {
    mockVerifyAdminOrEditor.mockResolvedValueOnce({ authorized: false, reason: 'invalid' });
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer bad-token' } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._json.success).toBe(false);
  });

  test('POST rejects non-admin/editor users', async () => {
    mockVerifyAdminOrEditor.mockResolvedValueOnce({ authorized: false, reason: 'forbidden' });

    const req = mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { assetClass: 'factory', factors: { economic: 1.5 } }
    });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res._json.success).toBe(false);
  });

  test('POST upserts factor for admin/editor', async () => {
    mockFrom.mockImplementation((table) => {
      if (table === 'depreciation_factors') {
        return {
          upsert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          then: (cb) => cb({ data: [{ asset_class: 'factory' }], error: null })
        };
      }
      return {};
    });

    const req = mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { assetClass: 'factory', factors: { economic: 1.5 } }
    });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });
});
