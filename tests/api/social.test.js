/**
 * @jest-environment node
 */

const mockSupabaseClient = {
  from: jest.fn(),
  auth: { getUser: jest.fn() }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));

const mockVerifyAdminOrEditor = jest.fn();
jest.mock('../../lib/api/admin-auth', () => ({
  verifyAdminOrEditor: (...args) => mockVerifyAdminOrEditor(...args)
}));

const socialFeedHandler = require('../../api/social-feed');
const socialAccountsHandler = require('../../api/social-accounts');
const socialPublishHandler = require('../../api/social-publish');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    socket: {},
    ...overrides
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    _json: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; },
    json(data) { this._json = data; return this; }
  };
}

describe('/api/social-feed', () => {
  const originalEnv = process.env.SOCIAL_FEED_ENABLED;

  afterAll(() => {
    process.env.SOCIAL_FEED_ENABLED = originalEnv;
  });

  test('returns disabled when SOCIAL_FEED_ENABLED is not true', async () => {
    delete process.env.SOCIAL_FEED_ENABLED;
    const req = mockReq();
    const res = mockRes();
    await socialFeedHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.disabled).toBe(true);
  });

  test('returns empty posts when enabled but credentials missing', async () => {
    process.env.SOCIAL_FEED_ENABLED = 'true';
    const req = mockReq();
    const res = mockRes();
    await socialFeedHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.posts).toEqual([]);
  });
});

describe('/api/social-accounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ error: null, data: { user: { id: 'user-123' } } });
  });

  test('GET rejects unauthenticated requests', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: false, reason: 'missing' });
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await socialAccountsHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('GET returns account status for admin', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    const req = mockReq({ method: 'GET', headers: { authorization: 'Bearer token' } });
    const res = mockRes();
    await socialAccountsHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.accounts).toHaveLength(3);
  });

  test('POST rejects unknown platform', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { action: 'test', platform: 'facebook' } });
    const res = mockRes();
    await socialAccountsHandler(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('/api/social-publish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ error: null, data: { user: { id: 'user-123' } } });
  });

  test('POST rejects unauthenticated requests', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: false, reason: 'missing' });
    const req = mockReq({ method: 'POST' });
    const res = mockRes();
    await socialPublishHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('POST validates platforms', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { text: 'Hello' } });
    const res = mockRes();
    await socialPublishHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.error).toContain('platforms');
  });

  test('POST returns per-platform results without credentials', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    const req = mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { platforms: ['x', 'instagram'], text: 'Hello' }
    });
    const res = mockRes();
    await socialPublishHandler(req, res);
    expect(res.statusCode).toBe(207);
    expect(res._json.results).toHaveLength(2);
  });
});
