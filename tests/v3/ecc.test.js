const { eccRouter } = require('../../v3/api/ecc');

class MockSupabase {
  constructor() {
    this.rows = {};
    this.lastQuery = {};
  }

  from(table) {
    this.lastQuery = { table };
    return this;
  }

  select(columns) {
    this.lastQuery.select = columns;
    return this;
  }

  eq(field, value) {
    this.lastQuery.eq = { field, value };
    return this;
  }

  order() { return this; }
  limit(n) { this.lastQuery.limit = n; return this; }

  async single() {
    return { data: null, error: { code: 'PGRST116', message: 'not found' } };
  }
}

function mockReq({ method = 'GET', body = null, url = 'http://localhost/ecc/project-status' } = {}) {
  return {
    method,
    url,
    headers: { host: 'localhost' },
    on(event, cb) {
      if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
      if (event === 'end') cb();
    }
  };
}

function mockRes() {
  return {
    statusCode: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(data) { this.data = data; }
  };
}

describe('ECC API Router', () => {
  const user = { id: 'u1' };

  test('POST /ecc/project-status returns 400 when projectId missing', async () => {
    const supabase = new MockSupabase();
    const req = mockReq({ method: 'POST', body: {}, url: 'http://localhost/ecc/project-status' });
    const res = mockRes();
    await eccRouter(req, res, '/ecc/project-status', supabase, user);
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.data);
    expect(json.error).toContain('projectId');
  });

  test('POST /ecc/advisor returns 400 when message missing', async () => {
    const supabase = new MockSupabase();
    const req = mockReq({ method: 'POST', body: { projectId: 'p1' }, url: 'http://localhost/ecc/advisor' });
    const res = mockRes();
    await eccRouter(req, res, '/ecc/advisor', supabase, user);
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.data);
    expect(json.error).toContain('message');
  });

  test('GET /ecc/project-status returns 405', async () => {
    const supabase = new MockSupabase();
    const req = mockReq({ method: 'GET', url: 'http://localhost/ecc/project-status' });
    const res = mockRes();
    await eccRouter(req, res, '/ecc/project-status', supabase, user);
    expect(res.statusCode).toBe(405);
  });
});
