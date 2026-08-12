/**
 * @jest-environment node
 */

const mockSendEmail = jest.fn(() => Promise.resolve({ success: true }));

jest.mock('../../lib/api/email', () => ({
  sendEmail: mockSendEmail
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(false))
}));

jest.mock('../../lib/api/supabase', () => jest.fn(() => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) }))
  })),
  auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })) }
})));

const handler = require('../../api/funding');

function mockReq(overrides = {}) {
  return {
    method: 'POST',
    headers: {},
    query: { action: 'funding-request' },
    body: {},
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
    end() { return this; },
    json(data) { this._json = data; return this; }
  };
  return res;
}

describe('/api/funding?action=funding-request', () => {
  beforeEach(() => {
    mockSendEmail.mockClear();
  });

  test('accepts a valid request and sends email', async () => {
    const req = mockReq({
      body: {
        lang: 'ar',
        name: 'Ali Ahmad',
        company: 'Ahmad Trading',
        email: 'ali@example.com',
        phone: '+966567566616',
        country: 'السعودية',
        financingType: 'شركات ومؤسسات',
        amount: '500000',
        purpose: 'توسعة',
        letter: 'تحية طيبة'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.attachments).toEqual([]);
  });

  test('returns 400 for missing required fields', async () => {
    const req = mockReq({ body: { name: 'Ali' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.success).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid email', async () => {
    const req = mockReq({
      body: {
        name: 'Ali',
        company: 'Ahmad Trading',
        email: 'not-an-email',
        phone: '+966567566616',
        country: 'السعودية',
        financingType: 'شركات',
        amount: '100000'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.success).toBe(false);
  });

  test('accepts valid file attachments', async () => {
    const tinyPdf = 'data:application/pdf;base64,JVBERi0xLjAKJcKiwg==';
    const req = mockReq({
      body: {
        lang: 'en',
        name: 'John Doe',
        company: 'Doe LLC',
        email: 'john@example.com',
        phone: '+12025550123',
        country: 'United States',
        financingType: 'Startups',
        amount: '250000',
        letter: 'Hello',
        files: [{ name: 'plan.pdf', type: 'application/pdf', data: tinyPdf }]
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.attachments.length).toBe(1);
    expect(emailArgs.attachments[0].filename).toBe('plan.pdf');
  });

  test('returns 400 for disallowed file type', async () => {
    const req = mockReq({
      body: {
        lang: 'ar',
        name: 'Ali',
        company: 'Co',
        email: 'ali@example.com',
        phone: '+966567566616',
        country: 'السعودية',
        financingType: 'شركات',
        amount: '100000',
        letter: 'تحية',
        files: [{ name: 'app.exe', type: 'application/x-msdownload', data: 'data:application/x-msdownload;base64,AAAA' }]
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._json.success).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('returns 400 for missing action', async () => {
    const req = mockReq({ query: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('handles honeypot submission gracefully', async () => {
    const req = mockReq({ body: { website: 'spam-site.com' } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
