/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
const mockAuthGetUser = jest.fn();
const mockSupabaseClient = {
  from: mockFrom,
  auth: { getUser: mockAuthGetUser }
};

jest.mock('../../lib/api/supabase', () => {
  return { getSupabase: jest.fn(() => mockSupabaseClient) };
});

const handler = require('../../api/market-intelligence');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...overrides
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

describe('/api/market-intelligence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthGetUser.mockResolvedValue({ error: null, data: { user: { id: 'user-123' } } });
  });

  test('handles OPTIONS request', async () => {
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('GET returns market data', async () => {
    const data = [{ asset_class: 'factory', demand_index: 5, supply_index: 4 }];
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: (cb) => cb({ data, error: null })
    }));

    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });

  test('POST rejects unauthenticated requests', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('POST rejects non-admin/editor users', async () => {
    mockFrom.mockImplementation((table) => {
      if (table === 'user_roles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          then: (cb) => cb({ data: [], error: null })
        };
      }
      return {};
    });

    const req = mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { assetClass: 'factory', demandIndex: 6 }
    });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(403);
  });

  test('POST upserts market data for admin/editor', async () => {
    mockFrom.mockImplementation((table) => {
      if (table === 'user_roles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          then: (cb) => cb({ data: [{ role: 'admin' }], error: null })
        };
      }
      if (table === 'market_data') {
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
      body: { assetClass: 'factory', demandIndex: 6, supplyIndex: 4 }
    });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
  });
});
