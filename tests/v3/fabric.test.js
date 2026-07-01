/**
 * @jest-environment node
 */

function createMockQuery(data = []) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    contains: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => Promise.resolve({ data, error: null })),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => Promise.resolve({ error: null })),
    single: jest.fn(() => Promise.resolve({ data: data[0] || { id: 'uuid' }, error: null }))
  };
  return chain;
}

const mockSupabaseClient = {
  from: jest.fn(() => createMockQuery([]))
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
    url: '/api/v3/fabric/connectors',
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

describe('/api/v3/fabric', () => {
  test('GET /fabric/connectors lists connectors', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/fabric/connectors' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.connectors)).toBe(true);
    expect(res._json.connectors.length).toBeGreaterThan(0);
  });

  test('GET /fabric/connectors/health returns health', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/fabric/connectors/health' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.health)).toBe(true);
  });

  test('POST /fabric/resolve returns consensus result', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/fabric/resolve',
      body: {
        metricCode: 'rent',
        dataType: 'number',
        records: [
          { sourceId: 'a', sourceCode: 'A', value: 100, confidence: 80, collectedAt: new Date().toISOString() },
          { sourceId: 'b', sourceCode: 'B', value: 102, confidence: 80, collectedAt: new Date().toISOString() }
        ]
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.value).toBe(101);
    expect(res._json.provenance).toBeDefined();
  });

  test('GET /fabric/marketplace returns items', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/fabric/marketplace' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.items)).toBe(true);
  });

  test('POST /fabric/plugins/validate validates manifest', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/fabric/plugins/validate',
      body: {
        pluginCode: 'test',
        name: 'Test',
        version: '1.0.0',
        permissions: [],
        dependencies: [],
        supportedVersions: ['1.x']
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.valid).toBe(true);
  });
});
