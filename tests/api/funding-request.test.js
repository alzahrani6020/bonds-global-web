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

function mockCreateSupabase() {
  const createQuery = (defaultSingle = null) => {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      insert: jest.fn((rows) => {
        // Return a thenable that also exposes select/single for insert-select chains.
        const insertChain = {
          select: jest.fn(() => insertChain),
          single: jest.fn(() => Promise.resolve({ data: defaultSingle, error: null })),
          then: (resolve) => resolve({ data: Array.isArray(rows) ? rows : [rows], error: null })
        };
        return insertChain;
      }),
      update: jest.fn(() => chain),
      order: jest.fn(() => chain),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      single: jest.fn(() => Promise.resolve({ data: defaultSingle, error: null }))
    };
    return chain;
  };

  return jest.fn(() => ({
    from: jest.fn(() => mockCreateQuery({ id: 'case-1', case_reference: 'BF-2026-000001' })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: {}, error: null }))
      }))
    },
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })) }
  }));
}

function mockCreateQuery(defaultSingle) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    insert: jest.fn((rows) => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: defaultSingle, error: null }))
      })),
      then: (resolve) => resolve({ data: Array.isArray(rows) ? rows : [rows], error: null })
    })),
    update: jest.fn(() => chain),
    order: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    single: jest.fn(() => Promise.resolve({ data: defaultSingle, error: null }))
  };
  return chain;
}

jest.mock('../../lib/api/supabase', () => mockCreateSupabase());

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

  test('accepts a valid request, creates a case, and sends email', async () => {
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
        purposeCategory: 'توسع',
        purpose: 'توسعة',
        letter: 'تحية طيبة'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.caseReference).toBe('BF-2026-000001');
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
    expect(res._json.caseReference).toBe('BF-2026-000001');
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
