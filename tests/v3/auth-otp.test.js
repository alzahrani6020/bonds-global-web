/**
 * @jest-environment node
 */

const mockCreateUser = jest.fn(() => Promise.resolve({ data: { user: { id: 'u1', email: 'test@example.com' } }, error: null }));
const mockUpdateUserById = jest.fn(() => Promise.resolve({ error: null }));
const mockListUsers = jest.fn(() => Promise.resolve({
  data: {
    users: [{
      id: 'u1',
      email: 'test@example.com',
      user_metadata: {
        bonds_otp: '123456',
        bonds_otp_expires_at: Date.now() + 600_000
      }
    }]
  },
  error: null
}));
const mockSignInWithPassword = jest.fn(() => Promise.resolve({
  data: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { access_token: 'at', refresh_token: 'rt', expires_at: 9999999999 }
  },
  error: null
}));

const mockSupabaseClient = {
  auth: {
    admin: {
      createUser: mockCreateUser,
      updateUserById: mockUpdateUserById,
      listUsers: mockListUsers
    },
    signInWithPassword: mockSignInWithPassword
  }
};

// The service role client uses the same object for auth.admin calls.
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockSupabaseClient)
}));

// The anon key client is used for signInWithOtp.
jest.mock('../../v3/lib/auth', () => ({
  getAuthClient: jest.fn(() => mockSupabaseClient),
  getUserFromToken: jest.fn(() => null)
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
    url: '/api/v3/auth/me',
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

describe('/api/v3/auth OTP proxy', () => {
  beforeEach(() => {
    mockCreateUser.mockClear();
    mockUpdateUserById.mockClear();
    mockListUsers.mockClear();
    mockSignInWithPassword.mockClear();
  });

  test('POST /auth/send-otp creates user and sends OTP', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/auth/send-otp',
      body: { email: 'Test@Example.com', shouldCreateUser: true, metadata: { country: 'EG' }, language: 'ar' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockUpdateUserById).toHaveBeenCalled();
  });

  test('POST /auth/send-otp rejects invalid email', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/auth/send-otp',
      body: { email: 'not-an-email' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/email/i);
  });

  test('POST /auth/send-otp rate limits repeated attempts', async () => {
    const body = { email: 'test@example.com', shouldCreateUser: true, language: 'ar' };
    let lastStatus;
    for (let i = 0; i < 8; i++) {
      const req = mockReq({ method: 'POST', url: '/api/v3/auth/send-otp', body });
      const res = mockRes();
      await handler(req, res);
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
  });

  test('POST /auth/verify-otp returns session', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/auth/verify-otp',
      body: { email: 'test@example.com', token: '123456', pendingPassword: 'StrongPass1!' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.session.access_token).toBe('at');
    expect(mockUpdateUserById).toHaveBeenCalled();
    expect(mockSignInWithPassword).toHaveBeenCalled();
  });

  test('POST /auth/verify-otp rejects missing token', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/auth/verify-otp',
      body: { email: 'test@example.com' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/required/i);
  });
});
