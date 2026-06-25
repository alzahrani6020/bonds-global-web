/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
const mockSupabaseClient = { from: mockFrom };

jest.mock('../../lib/api/supabase', () => {
  return jest.fn(() => mockSupabaseClient);
});

jest.mock('../../lib/api/auth-helper', () => ({
  verifyBearerAndUser: jest.fn()
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => false)
}));

const handler = require('../../api/clear-user-data');
const { verifyBearerAndUser } = require('../../lib/api/auth-helper');
const { checkRateLimit } = require('../../lib/api/rate-limit');

function mockReq(overrides = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    body: { userId: 'user-123' },
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

describe('/api/clear-user-data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects non-POST methods', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res._json.error).toBe('Method not allowed');
  });

  test('rejects unauthenticated requests', async () => {
    verifyBearerAndUser.mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._json.success).toBe(false);
  });

  test('rejects mismatched userId', async () => {
    const { AuthError } = jest.requireActual('../../lib/api/auth-helper');
    verifyBearerAndUser.mockImplementation(() => {
      throw new AuthError('userId does not match authenticated user', 403);
    });
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect(res._json.success).toBe(false);
  });

  test('clears all user tables when authenticated', async () => {
    verifyBearerAndUser.mockResolvedValue({ id: 'user-123', email: 'test@example.com' });

    const eqMock = jest.fn().mockReturnValue({ error: null });
    mockFrom.mockReturnValue({ delete: () => ({ eq: eqMock }) });

    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(verifyBearerAndUser).toHaveBeenCalledWith(req);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledTimes(5);
    ['sales_transactions', 'menu_item_ingredients', 'menu_items', 'menu_ingredients', 'platforms'].forEach(table => {
      expect(mockFrom).toHaveBeenCalledWith(table);
    });
  });

  test('returns failure if any table deletion fails', async () => {
    verifyBearerAndUser.mockResolvedValue({ id: 'user-123' });

    let callCount = 0;
    const eqMock = jest.fn().mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? { error: { message: 'FK constraint' } } : { error: null };
    });
    mockFrom.mockReturnValue({ delete: () => ({ eq: eqMock }) });

    const req = mockReq();
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._json.success).toBe(false);
    expect(res._json.error).toContain('FK constraint');
  });
});
