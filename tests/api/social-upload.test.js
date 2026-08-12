/**
 * @jest-environment node
 */

const mockStorage = {
  from: jest.fn(() => mockStorage),
  upload: jest.fn(),
  getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/social-media/file.jpg' } }))
};

const mockSupabaseClient = {
  storage: mockStorage,
  auth: { getUser: jest.fn() }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));

const mockVerifyAdminOrEditor = jest.fn();
jest.mock('../../lib/api/admin-auth', () => ({
  verifyAdminOrEditor: (...args) => mockVerifyAdminOrEditor(...args)
}));

const handler = require('../../api/social-upload');

function mockReq(overrides = {}) {
  return {
    method: 'POST',
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

describe('/api/social-upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({ error: null, data: { user: { id: 'user-123' } } });
  });

  test('rejects unauthenticated', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: false, reason: 'missing' });
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects unsupported content type', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    const res = mockRes();
    await handler(mockReq({
      headers: { authorization: 'Bearer token' },
      body: { filename: 'a.pdf', contentType: 'application/pdf', base64: 'abcd' }
    }), res);
    expect(res.statusCode).toBe(400);
  });

  test('uploads image and returns public url', async () => {
    mockVerifyAdminOrEditor.mockResolvedValue({ authorized: true, userId: 'user-123', role: 'admin' });
    mockStorage.upload.mockResolvedValue({ data: { path: 'user-123/file.jpg' }, error: null });
    const res = mockRes();
    await handler(mockReq({
      headers: { authorization: 'Bearer token' },
      body: { filename: 'test.jpg', contentType: 'image/jpeg', base64: Buffer.from('image-data').toString('base64') }
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.url).toContain('cdn.example.com');
  });
});
