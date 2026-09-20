/**
 * @jest-environment node
 */

const mockInsertSingle = jest.fn(() =>
  Promise.resolve({
    data: { id: 'req-1' },
    error: null
  })
);

const mockInsert = jest.fn(() => ({
  select: jest.fn(() => ({
    single: mockInsertSingle
  }))
}));

jest.mock('../../lib/api/supabase', () => jest.fn(() => ({
  from: jest.fn(() => ({
    insert: mockInsert
  }))
})));

const mockCheckRateLimit = jest.fn(() => Promise.resolve(false));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit
}));

jest.mock('../../lib/api/auth-helper', () => ({
  verifyBearer: jest.fn()
}));

jest.mock('../../lib/api/cors', () => ({
  setAllowedOrigin: jest.fn()
}));

jest.mock('../../lib/api/funding-request-handler', () => ({
  handleFundingExtractionRequest: jest.fn()
}));

describe('funding bank-transfer notification hardening', () => {
  const oldApiKey = process.env.RESEND_API_KEY;
  const oldAdminEmail = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    jest.resetModules();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (oldApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldApiKey;

    if (oldAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = oldAdminEmail;

    delete global.fetch;
  });

  test('escapes user-controlled fields in admin notification HTML', async () => {
    const handler = require('../../api/funding');

    const req = {
      method: 'POST',
      headers: {},
      query: { action: 'bank-transfer' },
      body: {
        name: '<img src=x onerror=alert(1)>',
        email: 'test@example.com',
        phone: '0555555555',
        tier: 'pro'
      }
    };

    const res = {
      statusCode: 200,
      body: null,
      setHeader() { return this; },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      end() {
        return this;
      }
    };

    await handler(req, res);

    // Notification is intentionally fire-and-forget.
    await new Promise(resolve => setImmediate(resolve));

    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalled();

    const [, options] = global.fetch.mock.calls[0];
    const payload = JSON.parse(options.body);

    expect(payload.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(payload.html).not.toContain('<b>0555555555</b>');

    expect(payload.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(payload.html).toContain('0555555555');
  });

  test('rejects invalid email', async () => {
    const handler = require('../../api/funding');

    const req = {
      method: 'POST',
      headers: {},
      query: { action: 'bank-transfer' },
      body: {
        name: 'Test User',
        email: 'not-an-email',
        phone: '0555555555',
        tier: 'pro'
      }
    };

    const res = {
      statusCode: 200,
      body: null,
      setHeader() { return this; },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      end() {
        return this;
      }
    };

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid email' });
  });

  test('rejects invalid phone', async () => {
    const handler = require('../../api/funding');

    const req = {
      method: 'POST',
      headers: {},
      query: { action: 'bank-transfer' },
      body: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '<b>0555555555</b>',
        tier: 'pro'
      }
    };

    const res = {
      statusCode: 200,
      body: null,
      setHeader() { return this; },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      end() {
        return this;
      }
    };

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid phone' });
  });

  test('applies bank-transfer rate limit category and stops when limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce(true);

    const handler = require('../../api/funding');

    const req = {
      method: 'POST',
      headers: {},
      query: { action: 'bank-transfer' },
      body: {
        name: 'Rate Limit Test',
        email: 'rate-limit@example.com',
        phone: '0555555555',
        tier: 'pro'
      }
    };

    const res = {
      statusCode: 200,
      body: null,
      setHeader() {
        return this;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      end() {
        return this;
      }
    };

    await handler(req, res);

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      'bank_transfer',
      req,
      res
    );

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
