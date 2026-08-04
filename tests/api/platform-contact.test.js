/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();

function createChain(result = { data: null, error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (cb) => cb(result)
  };
  return chain;
}

const mockSupabaseClient = {
  from: mockFrom,
  auth: { getUser: jest.fn() }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));
jest.mock('../../lib/api/email', () => ({
  sendEmail: jest.fn(() => Promise.resolve({ success: true }))
}));
jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(false))
}));

const handler = require('../../api/platform');

function mockReq(overrides = {}) {
  return {
    method: 'POST',
    headers: { host: 'localhost' },
    query: { action: 'contact' },
    body: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    _json: null,
    _sent: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; },
    json(data) { this._json = data; return this; },
    send(data) { this._sent = data; return this; }
  };
  return res;
}

describe('/api/contact?action=contact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => createChain({ data: { id: 'c1' }, error: null }));
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('ok') }));
  });

  test('accepts complete contact and marks valid', async () => {
    const req = mockReq({
      url: '/api/contact?action=contact',
      body: {
        name: 'Ali',
        phone: '+966567566616',
        email: 'ali@example.com',
        city: 'Riyadh',
        sector: 'تجارة',
        service: 'جدوى',
        message: 'Need feasibility study'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.validation_status).toBe('valid');
  });

  test('accepts missing name and phone and marks invalid', async () => {
    const req = mockReq({
      url: '/api/contact?action=contact',
      body: { message: 'Need help' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.validation_status).toBe('invalid');
  });

  test('accepts invalid email and marks invalid', async () => {
    const req = mockReq({
      url: '/api/contact?action=contact',
      body: {
        name: 'Ali',
        phone: '+966567566616',
        email: 'not-an-email',
        city: 'Riyadh',
        sector: 'تجارة',
        message: 'Need help'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.validation_status).toBe('invalid');
  });

  test('accepts missing city and business activity and marks invalid', async () => {
    const req = mockReq({
      url: '/api/contact?action=contact',
      body: {
        name: 'Ali',
        phone: '+966567566616',
        email: 'ali@example.com',
        message: 'Need help'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.validation_status).toBe('invalid');
  });

  test('honeypot website field returns success without saving', async () => {
    mockFrom.mockImplementation(() => createChain({ data: null, error: null }));
    const req = mockReq({
      url: '/api/contact?action=contact',
      body: { name: 'Bot', website: 'spam.com' }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
