/**
 * @jest-environment node
 */

const mockSupabaseClient = {
  from: jest.fn((table) => {
    if (table === 'bonds_projects') {
      return createChain({
        id: 'proj-1',
        name: 'Test Project',
        sector: 'restaurant',
        capital: 1_000_000,
        revenue: 2_000_000,
        annual_profit: 400_000,
        language: 'ar',
        currency: 'SAR'
      });
    }
    if (table === 'bonds_assets') return createChain(null);
    if (table === 'bonds_valuations') return createChain(null);
    if (table === 'bonds_financing') return createChain(null);
    if (table === 'cities') return createChain({ name_ar: 'الرياض', name_en: 'Riyadh', country_code: 'SA', code: 'riyadh' });
    if (table === 'investment_memoranda') {
      return createChain({ id: 'memo-1', project_id: 'proj-1', user_id: 'user-1', content: {}, evidence_bundle: [], confidence_score: 70 });
    }
    if (table === 'investment_memoranda_versions') return createChain(null);
    if (table === 'investment_readiness_scores') return createChain(null);
    if (table === 'ai_investment_reviews') return createChain({ id: 'rev-1' });
    if (table === 'profiles') return createChain({ role: 'owner' });
    return createChain([]);
  })
};

function createChain(data) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve({ data: Array.isArray(data) ? data[0] || null : data, error: null })),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    in: jest.fn(() => chain)
  };
  // Final promise for insert/update/select chains
  chain.then = (cb) => Promise.resolve({ data: Array.isArray(data) ? data : (data || { id: 'gen-1' }), error: null }).then(cb);
  return chain;
}

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockSupabaseClient)
}));

jest.mock('../../v3/lib/auth', () => ({
  getUserFromToken: jest.fn(() => ({ id: 'user-1', email: 'test@bonds.com' }))
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
    url: '/api/v3/investment-intelligence/engines',
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
        try { this._json = JSON.parse(data); } catch { this._text = data; }
      }
      return this;
    },
    json(data) { this._json = data; return this; }
  };
  return res;
}

describe('/api/v3/investment-intelligence', () => {
  test('GET /investment-intelligence/engines lists engines', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/investment-intelligence/engines' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.engines)).toBe(true);
    expect(res._json.engines.length).toBeGreaterThan(0);
  });

  test('GET /investment-intelligence/readiness/:projectId returns score', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/investment-intelligence/readiness/proj-1?persist=false' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.engine).toBe('investment_readiness');
    expect(typeof res._json.output.readinessScore).toBe('number');
  });

  test('POST /investment-intelligence/memorandum creates memorandum', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/investment-intelligence/memorandum',
      body: { projectId: 'proj-1', language: 'ar', type: 'investment_memorandum', useAi: false }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.memorandum).toBeDefined();
    expect(res._json.generated.engine).toBe('investment_memorandum');
  });

  test('GET /investment-intelligence/memorandum/:id/html returns html', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/investment-intelligence/memorandum/memo-1/html' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/html');
    expect(res._text).toContain('<!DOCTYPE html>');
  });
});
