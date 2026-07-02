const { eccRouter } = require('../../v3/api/ecc');
const { aggregatePortfolioStatus, generateNotifications, executiveSearch } = require('../../lib/ecc');

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


function createEmptyPortfolioSupabase() {
  return {
    from(table) {
      this._table = table;
      return this;
    },
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return this; },
    single() {
      if (this._table === 'profiles') {
        return Promise.resolve({ data: { role: 'owner' }, error: null });
      }
      return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'not found' } });
    },
    then(cb) {
      if (this._table === 'bonds_projects') {
        return Promise.resolve(cb({ data: [], error: null }));
      }
      return Promise.resolve(cb({ data: null, error: null }));
    }
  };
}

describe('ECC Portfolio Aggregator', () => {
  test('returns empty portfolio when user has no projects', async () => {
    const supabase = createEmptyPortfolioSupabase();
    const result = await aggregatePortfolioStatus({ userId: 'u1', supabase });
    expect(result.summary.totalProjects).toBe(0);
    expect(result.projects).toEqual([]);
    expect(result.alerts).toEqual([]);
    expect(result.upcomingActions).toEqual([]);
    expect(result.meta.aggregatedCount).toBe(0);
  });
});

describe('ECC Portfolio API', () => {
  const user = { id: 'u1' };

  test('POST /ecc/portfolio returns portfolio summary', async () => {
    const supabase = createEmptyPortfolioSupabase();
    const req = mockReq({ method: 'POST', body: {}, url: 'http://localhost/ecc/portfolio' });
    const res = mockRes();
    await eccRouter(req, res, '/ecc/portfolio', supabase, user);
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.data);
    expect(json.summary.totalProjects).toBe(0);
    expect(Array.isArray(json.projects)).toBe(true);
    expect(Array.isArray(json.alerts)).toBe(true);
  });
});


describe('ECC Notification Engine', () => {
  test('returns empty notifications when user has no projects', async () => {
    const supabase = createEmptyPortfolioSupabase();
    const result = await generateNotifications({ userId: 'u1', supabase });
    expect(Array.isArray(result.notifications)).toBe(true);
    expect(result.notifications.length).toBe(0);
    expect(result.unreadCount).toBe(0);
  });
});

describe('ECC Notifications API', () => {
  const user = { id: 'u1' };

  test('POST /ecc/notifications returns empty feed', async () => {
    const supabase = createEmptyPortfolioSupabase();
    const req = mockReq({ method: 'POST', body: {}, url: 'http://localhost/ecc/notifications' });
    const res = mockRes();
    await eccRouter(req, res, '/ecc/notifications', supabase, user);
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.data);
    expect(Array.isArray(json.notifications)).toBe(true);
    expect(json.notifications.length).toBe(0);
  });
});


describe('ECC Executive Search Engine', () => {
  test('returns empty results for empty query after tokenization', async () => {
    const supabase = createEmptyPortfolioSupabase();
    const result = await executiveSearch({ userId: 'u1', supabase, query: 'في من' });
    expect(result.query).toBe('في من');
    expect(result.results).toEqual([]);
    expect(result.meta.totalResults).toBe(0);
  });

  test('returns empty results when user has no projects', async () => {
    const supabase = createEmptyPortfolioSupabase();
    const result = await executiveSearch({ userId: 'u1', supabase, query: 'manufacturing feasibility' });
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBe(0);
  });
});

describe('ECC Search API', () => {
  const user = { id: 'u1' };

  test('POST /ecc/search returns 400 when query missing', async () => {
    const supabase = createEmptyPortfolioSupabase();
    const req = mockReq({ method: 'POST', body: {}, url: 'http://localhost/ecc/search' });
    const res = mockRes();
    await eccRouter(req, res, '/ecc/search', supabase, user);
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.data);
    expect(json.error).toContain('query');
  });
});
