/**
 * @jest-environment node
 */

const mockGetUser = jest.fn();
const mockSendEmail = jest.fn();
const mockCheckRateLimit = jest.fn(() => Promise.resolve(false));

const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: jest.fn()
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));
jest.mock('../../lib/api/email', () => ({
  sendEmail: (...args) => mockSendEmail(...args)
}));
jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: (...args) => mockCheckRateLimit(...args)
}));

const handler = require('../../api/platform');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; },
    send(data) { this.body = data; return this; }
  };
}

describe('/api/send-letter authentication contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
  });

  test('POST without Authorization is rejected with 401 before email sending', async () => {
    const req = {
      method: 'POST',
      url: '/api/send-letter',
      headers: { host: 'localhost' },
      query: {},
      body: {
        subject: 'verification-only',
        text: 'verification-only'
      },
      socket: { remoteAddress: '127.0.0.1' }
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, error: 'Authentication required' });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('POST with invalid bearer token is rejected before email sending', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' }
    });

    const req = {
      method: 'POST',
      url: '/api/send-letter',
      headers: {
        host: 'localhost',
        authorization: 'Bearer invalid-test-token'
      },
      query: {},
      body: {
        subject: 'verification-only',
        text: 'verification-only'
      },
      socket: { remoteAddress: '127.0.0.1' }
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, error: 'Authentication required' });
    expect(mockGetUser).toHaveBeenCalledWith('invalid-test-token');
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
