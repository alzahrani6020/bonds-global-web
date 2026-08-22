/**
 * @jest-environment node
 */

const handler = require('../../api/admin.js');

const USERS = {
  'valid-admin-token': { id: 'admin-user-id', email: 'admin@example.com' },
  'valid-nonadmin-token': { id: 'nonadmin-user-id', email: 'user@example.com' },
};

let mockConfig = {
  failAuthCreate: false,
  failInsertProfiles: false,
  failUpdateUserById: false,
};

function resetMockConfig() {
  mockConfig.failAuthCreate = false;
  mockConfig.failInsertProfiles = false;
  mockConfig.failUpdateUserById = false;
}

function mockResolveBuilder(builder) {
  const { table, operation, payload, filters, terminal } = builder;

  if (table === 'admin_roles' && operation === 'select' && (terminal === 'single' || terminal === 'maybeSingle')) {
    const filter = filters.find(f => f.col === 'user_id');
    if (filter?.val === USERS['valid-admin-token'].id) {
      return { data: { role: 'admin' }, error: null };
    }
    return { data: null, error: { message: 'not found' } };
  }

  if (table === 'profiles' && operation === 'select' && (terminal === 'single' || terminal === 'maybeSingle')) {
    return { data: { email: 'target@example.com' }, error: null };
  }

  if (table === 'site_settings' && operation === 'select' && (terminal === 'single' || terminal === 'maybeSingle')) {
    return { data: { value: 'false' }, error: null };
  }

  if (operation === 'insert') {
    if (table === 'profiles' && mockConfig.failInsertProfiles) {
      return { data: null, error: { message: 'profiles insert failed' } };
    }
    if (table === 'admin_audit_log') {
      return { data: payload, error: null };
    }
    return { data: payload, error: null };
  }

  if (operation === 'update') return { data: null, error: null };
  if (operation === 'upsert') return { data: null, error: null };
  if (operation === 'delete') return { data: null, error: null };

  return { data: null, error: null };
}

function mockCreateBuilder(table, operation, payload, filters, terminal) {
  const state = { table, operation, payload, filters: filters || [], terminal: terminal || null };

  const chain = {
    select: () => mockCreateBuilder(table, 'select', null, state.filters),
    insert: (data) => mockCreateBuilder(table, 'insert', data, state.filters),
    update: (data) => mockCreateBuilder(table, 'update', data, state.filters),
    upsert: (data, _opts) => mockCreateBuilder(table, 'upsert', data, state.filters),
    delete: () => mockCreateBuilder(table, 'delete', null, state.filters),
    eq: (col, val) => mockCreateBuilder(table, operation, payload, [...state.filters, { col, val }]),
    single: () => mockCreateBuilder(table, operation, payload, state.filters, 'single'),
    maybeSingle: () => mockCreateBuilder(table, operation, payload, state.filters, 'maybeSingle'),
    in: () => chain,
    or: () => chain,
    ilike: () => chain,
    limit: () => chain,
    order: () => chain,
    range: () => chain,
    is: () => chain,
    neq: () => chain,
    gt: () => chain,
    lt: () => chain,
    count: () => chain,
    then: (onResolve, onReject) => Promise.resolve(mockResolveBuilder(state)).then(onResolve, onReject),
  };

  return chain;
}

function mockCreateClient() {
  return {
    from: (table) => mockCreateBuilder(table),
    auth: {
      getUser: jest.fn(async (token) => {
        if (USERS[token]) {
          return { data: { user: USERS[token] }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }),
      admin: {
        createUser: jest.fn(async ({ email }) => {
          if (mockConfig.failAuthCreate) {
            return { data: null, error: { message: 'create user failed' } };
          }
          return { data: { user: { id: 'new-id', email } }, error: null };
        }),
        updateUserById: jest.fn(async (_id, _updates) => {
          if (mockConfig.failUpdateUserById) {
            return { data: null, error: { message: 'update user failed' } };
          }
          return { data: { user: {} }, error: null };
        }),
        getUserById: jest.fn(async () => ({
          data: { user: { email: 'target@example.com' } },
          error: null,
        })),
      },
    },
  };
}

jest.mock('../../lib/api/supabase', () => {
  return jest.fn(() => mockCreateClient());
});

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => false),
}));

function buildReq({ method = 'POST', action = 'users', subAction = null, body = {}, token = 'valid-admin-token' } = {}) {
  const fullBody = subAction ? { action: subAction, ...body } : { action, ...body };
  return {
    method,
    url: `/api/admin?action=${action}`,
    headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : {},
    query: { action },
    body: fullBody,
  };
}

function buildRes() {
  const res = {
    statusCode: null,
    headers: {},
    ended: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.ended = JSON.stringify(data); return this; },
    end(data) { this.ended = data; return this; },
  };
  return res;
}

async function call({ method = 'POST', action = 'users', subAction = null, body = {}, token = 'valid-admin-token', config = {} } = {}) {
  resetMockConfig();
  Object.assign(mockConfig, config);
  const req = buildReq({ method, action, subAction, body, token });
  const res = buildRes();
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.ended || '{}') };
}

describe('/api/admin user operations HTTP contracts', () => {
  describe('add user', () => {
    test('valid input → 200 success', async () => {
      const { status, json } = await call({
        subAction: 'create',
        body: { email: 'new@example.com', password: 'secure123', country: 'SA', city: 'Riyadh' }
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    test('short password → 400', async () => {
      const { status, json } = await call({
        subAction: 'create',
        body: { email: 'new@example.com', password: 'short', country: 'SA', city: 'Riyadh' }
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/password/i);
    });

    test('invalid email → 400', async () => {
      const { status, json } = await call({
        subAction: 'create',
        body: { email: 'not-an-email', password: 'secure123', country: 'SA', city: 'Riyadh' }
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/email/i);
    });

    test('missing data → 400', async () => {
      const { status, json } = await call({
        subAction: 'create',
        body: { email: 'new@example.com' }
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/password|required/i);
    });

    test('DB failure → 500', async () => {
      const { status, json } = await call({
        subAction: 'create',
        body: { email: 'new@example.com', password: 'secure123', country: 'SA', city: 'Riyadh' },
        config: { failInsertProfiles: true }
      });
      expect(status).toBe(500);
      expect(json.error).toBeDefined();
    });
  });

  describe('reset password', () => {
    test('valid → 200', async () => {
      const { status, json } = await call({
        subAction: 'reset-password',
        body: { id: 'user-1', password: 'newpass123' }
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    test('short password → 400', async () => {
      const { status, json } = await call({
        subAction: 'reset-password',
        body: { id: 'user-1', password: 'short' }
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/password/i);
    });

    test('missing id → 400', async () => {
      const { status, json } = await call({
        subAction: 'reset-password',
        body: { password: 'newpass123' }
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/id/i);
    });
  });

  describe('grant access', () => {
    test('valid → 200', async () => {
      const { status, json } = await call({
        subAction: 'grant-access',
        body: { id: 'user-1', tier: 'pro' }
      });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    test('missing id → 400', async () => {
      const { status, json } = await call({
        subAction: 'grant-access',
        body: { tier: 'pro' }
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/id/i);
    });

    test('invalid tier → 400', async () => {
      const { status, json } = await call({
        subAction: 'grant-access',
        body: { id: 'user-1', tier: 'ultra' }
      });
      expect(status).toBe(400);
      expect(json.error).toMatch(/tier/i);
    });
  });

  describe('authentication & authorization', () => {
    test('no Authorization header → 401', async () => {
      const { status, json } = await call({ token: null, subAction: 'create', body: { email: 'a@b.com', password: 'pass123', country: 'SA', city: 'Riyadh' } });
      expect(status).toBe(401);
      expect(json.error).toMatch(/unauthorized|authorization/i);
    });

    test('invalid or expired token → 401', async () => {
      const { status, json } = await call({ token: 'invalid-token', subAction: 'create', body: { email: 'a@b.com', password: 'pass123', country: 'SA', city: 'Riyadh' } });
      expect(status).toBe(401);
      expect(json.error).toMatch(/invalid|expired|unauthorized/i);
    });

    test('valid token but non-admin → 403', async () => {
      const { status, json } = await call({ token: 'valid-nonadmin-token', subAction: 'create', body: { email: 'a@b.com', password: 'pass123', country: 'SA', city: 'Riyadh' } });
      expect(status).toBe(403);
      expect(json.error).toMatch(/admin|forbidden/i);
    });
  });
});
