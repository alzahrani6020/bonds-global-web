/**
 * @jest-environment node
 */

const mockRpc = jest.fn();
const mockGetSupabase = jest.fn(() => ({ rpc: mockRpc }));

jest.mock('../../lib/api/supabase', () => mockGetSupabase);

const {
  checkRateLimitDistributed
} = require('../../lib/api/rate-limit-distributed');

function mockReq() {
  return {
    method: 'POST',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

const cfg = {
  limit: 10,
  windowMs: 60000
};

describe('rate-limit-distributed', () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

    mockRpc.mockReset();
    mockGetSupabase.mockClear();
    mockGetSupabase.mockReturnValue({ rpc: mockRpc });
  });

  afterAll(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;

    if (oldServiceRole === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = oldServiceRole;
    }
  });

  test('accepts Supabase RPC single-row array response', async () => {
    const resetAt = Date.now() + 60000;

    mockRpc.mockResolvedValue({
      data: [{
        allowed: true,
        count: 2,
        reset_at: resetAt
      }],
      error: null
    });

    const res = mockRes();

    const limited = await checkRateLimitDistributed(
      'public',
      cfg,
      mockReq(),
      res,
      'test-identity',
      false
    );

    expect(limited).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(res.headers['X-RateLimit-Limit']).toBe('10');
    expect(res.headers['X-RateLimit-Remaining']).toBe('8');
    expect(Number(res.headers['X-RateLimit-Reset'])).toBe(
      Math.ceil(resetAt / 1000)
    );

    expect(mockRpc).toHaveBeenCalledWith(
      'check_rate_limit_bucket',
      expect.objectContaining({
        p_limit: 10,
        p_window_ms: 60000
      })
    );
  });

  test('returns 429 when RPC says request is over limit', async () => {
    const resetAt = Date.now() + 60000;

    mockRpc.mockResolvedValue({
      data: [{
        allowed: false,
        count: 11,
        reset_at: resetAt
      }],
      error: null
    });

    const res = mockRes();

    const limited = await checkRateLimitDistributed(
      'public',
      cfg,
      mockReq(),
      res,
      'test-identity',
      false
    );

    expect(limited).toBe(true);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      error: 'Too many requests. Please try again later.'
    });
  });

  test('fails closed on malformed RPC response when requested', async () => {
    mockRpc.mockResolvedValue({
      data: [{ unexpected: true }],
      error: null
    });

    const res = mockRes();

    const limited = await checkRateLimitDistributed(
      'funding_case_guest_lookup_global',
      cfg,
      mockReq(),
      res,
      'test-identity',
      true
    );

    expect(limited).toBe(true);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('60');
    expect(res.body).toEqual({
      error: 'Too many requests. Please try again later.'
    });
  });

  test('fails closed on RPC error when requested', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' }
    });

    const res = mockRes();

    const limited = await checkRateLimitDistributed(
      'funding_case_guest_lookup_global',
      cfg,
      mockReq(),
      res,
      'test-identity',
      true
    );

    expect(limited).toBe(true);
    expect(res.statusCode).toBe(429);
  });
});
