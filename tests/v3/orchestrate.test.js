/**
 * @jest-environment node
 */

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null })
  }))
};

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockSupabaseClient)
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => false)
}));

const handler = require('../../v3/api/index.js');

function mockReq(overrides = {}) {
  const body = overrides.body;
  const chunks = body ? [JSON.stringify(body)] : [];
  return {
    method: 'GET',
    headers: { host: 'localhost' },
    url: '/api/v3/orchestrate/intents',
    socket: { remoteAddress: '127.0.0.1' },
    on(event, cb) {
      if (event === 'data') chunks.forEach(cb);
      if (event === 'end') cb();
      return this;
    },
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
    end(data) {
      if (data) {
        try { this._json = JSON.parse(data); } catch { /* ignore non-JSON */ }
      }
      return this;
    },
    json(data) { this._json = data; return this; }
  };
  return res;
}

describe('/api/v3/orchestrate', () => {
  test('GET /orchestrate/intents returns intents list', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/orchestrate/intents' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.intents)).toBe(true);
    expect(res._json.intents.length).toBeGreaterThan(0);
  });

  test('POST /orchestrate/form returns dynamic form', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/orchestrate/form',
      body: {
        input: 'أريد دراسة جدوى لمطعم في الرياض',
        sector: 'restaurant',
        country: 'SA',
        language: 'ar'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.intent).toBeDefined();
    expect(res._json.form).toBeDefined();
    expect(Array.isArray(res._json.form.fields)).toBe(true);
  });

  test('POST /orchestrate runs full pipeline', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/orchestrate',
      body: {
        input: 'أريد دراسة جدوى لمطعم في الرياض',
        sector: 'restaurant',
        country: 'SA',
        language: 'ar',
        userTier: 'pro',
        values: {
          monthly_revenue: 100000,
          food_cost_percentage: 30,
          labor_cost: 20000,
          rent: 15000
        }
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.confidence).toBeDefined();
    expect(res._json.explanation).toBeDefined();
    expect(res._json.ucp).toBeDefined();
  });

  test('OPTIONS request returns 204', async () => {
    const req = mockReq({ method: 'OPTIONS', url: '/api/v3/orchestrate' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
  });
});
