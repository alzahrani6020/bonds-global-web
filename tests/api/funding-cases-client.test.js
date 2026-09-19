/**
 * @jest-environment node
 */

jest.mock('../../lib/api/email', () => ({
  sendEmail: jest.fn(() => Promise.resolve({ success: true }))
}));

jest.mock('../../lib/api/rate-limit-distributed', () => ({
  checkRateLimitDistributed: jest.fn(() => Promise.resolve(null))
}));

jest.mock('../../lib/api/rate-limit', () => {
  const mock = jest.fn(() => Promise.resolve(false));
  return { checkRateLimit: mock, __mock: mock };
});

const crypto = require('crypto');

function mockCreateChain(result = { data: null, error: null }) {
  const state = {
    data: result.data,
    error: result.error
  };

  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    not: jest.fn(() => chain),
    or: jest.fn(() => chain),
    in: jest.fn(() => chain),
    ilike: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve({ data: state.data, error: state.error })),
    single: jest.fn(() => Promise.resolve({ data: state.data, error: state.error })),
    insert: jest.fn((rows) => {
      const inserted = Array.isArray(rows) ? rows[0] : rows;
      state.data = inserted;
      return {
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: inserted, error: null }))
        })),
        then: (resolve) => resolve({ data: Array.isArray(rows) ? rows : [rows], error: null })
      };
    }),
    update: jest.fn((set) => {
      if (set && typeof set === 'object') {
        state.data = { ...(state.data || {}), ...set };
      }
      return chain;
    }),
    upsert: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    then: (resolve) => resolve({ data: state.data, error: state.error })
  };

  return chain;
}

function mockCreateSb(overrides = {}) {
  const tableResults = {
    funding_cases: { data: null, error: null },
    funding_case_events: { data: [], error: null },
    funding_case_documents: { data: [], error: null },
    ...overrides
  };

  return {
    auth: {
      getUser: jest.fn((token) => {
        if (token === 'valid-token') {
          return Promise.resolve({ data: { user: { id: 'user-1', email: 'client@example.com' } }, error: null });
        }
        return Promise.resolve({ data: { user: null }, error: { message: 'invalid token' } });
      })
    },
    from: jest.fn((table) => mockCreateChain(tableResults[table] || { data: null, error: null })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: 'client-uploads/case-1/123_file.pdf' }, error: null })),
        createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed.url/file.pdf' }, error: null }))
      }))
    }
  };
}

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockCreateSb()));

const mockGetSupabase = require('../../lib/api/supabase');
const rateLimitModule = require('../../lib/api/rate-limit');
const checkRateLimit = rateLimitModule.checkRateLimit;
const { checkRateLimitDistributed } = require('../../lib/api/rate-limit-distributed');
const handler = require('../../api/admin');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    headers: {},
    query: {},
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

function hmacCaseReference(ref) {
  return crypto
    .createHmac('sha256', process.env.RATE_LIMIT_HMAC_SECRET)
    .update(String(ref).trim())
    .digest('hex');
}

const ORIGINAL_RATE_LIMIT_HMAC_SECRET = process.env.RATE_LIMIT_HMAC_SECRET;

describe('/api/admin funding-cases client portal', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_HMAC_SECRET = 'test-secret-for-rate-limit-hmac';
    checkRateLimit.mockClear && checkRateLimit.mockClear();
    checkRateLimit.mockReturnValue(Promise.resolve(false));
    checkRateLimitDistributed.mockClear && checkRateLimitDistributed.mockClear();
    checkRateLimitDistributed.mockReturnValue(Promise.resolve(null));
    mockGetSupabase.mockClear && mockGetSupabase.mockClear();
  });

  afterEach(() => {
    process.env.RATE_LIMIT_HMAC_SECRET = ORIGINAL_RATE_LIMIT_HMAC_SECRET;
  });

  describe('funding-cases-client-list', () => {
    test('returns 401 without bearer token', async () => {
      const req = mockReq({ method: 'GET', query: { action: 'funding-cases-client-list' } });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(401);
      expect(res._json.error).toMatch(/Authentication required/i);
    });

    test('returns cases for authenticated user', async () => {
      const sb = mockCreateSb({
        funding_cases: {
          data: [
            { id: 'case-1', case_reference: 'BF-2026-000001', status: 'new', name: 'Ali', company: 'Co', amount: 100000 }
          ],
          error: null
        }
      });
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'GET',
        query: { action: 'funding-cases-client-list' },
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.cases).toHaveLength(1);
      expect(res._json.cases[0].case_reference).toBe('BF-2026-000001');
    });
  });

  describe('funding-cases-client-detail', () => {
    test('returns case detail with events, documents and signed urls', async () => {
      const sb = mockCreateSb({
        funding_cases: {
          data: {
            id: 'case-1',
            case_reference: 'BF-2026-000001',
            status: 'documents_required',
            name: 'Ali',
            email: 'ali@example.com'
          },
          error: null
        },
        funding_case_events: {
          data: [{ id: 'event-1', case_id: 'case-1', event_type: 'status_changed' }],
          error: null
        },
        funding_case_documents: {
          data: [{ id: 'doc-1', case_id: 'case-1', storage_bucket: 'funding-documents', storage_path: 'case-1/file.pdf' }],
          error: null
        }
      });
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'GET',
        query: { action: 'funding-cases-client-detail', id: 'case-1' },
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.case.id).toBe('case-1');
      expect(res._json.events).toHaveLength(1);
      expect(res._json.documents).toHaveLength(1);
      expect(res._json.documents[0].signedUrl).toBe('https://signed.url/file.pdf');
    });
  });

  describe('funding-cases-client-upload', () => {
    test('uploads a document for an owned case', async () => {
      const sb = mockCreateSb({
        funding_cases: { data: { id: 'case-1' }, error: null }
      });
      mockGetSupabase.mockReturnValue(sb);

      const tinyPdf = 'data:application/pdf;base64,JVBERi0xLjAKJcKiwg==';
      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-client-upload' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          caseId: 'case-1',
          file: { name: 'statement.pdf', type: 'application/pdf', data: tinyPdf }
        }
      });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.document).toBeTruthy();
      expect(res._json.document.file_name).toBe('statement.pdf');
    });

    test('returns 403 when case does not belong to user', async () => {
      const sb = mockCreateSb({
        funding_cases: { data: null, error: { message: 'not found' } }
      });
      mockGetSupabase.mockReturnValue(sb);

      const tinyPdf = 'data:application/pdf;base64,JVBERi0xLjAKJcKiwg==';
      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-client-upload' },
        headers: { authorization: 'Bearer valid-token' },
        body: {
          caseId: 'case-1',
          file: { name: 'statement.pdf', type: 'application/pdf', data: tinyPdf }
        }
      });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(403);
      expect(res._json.error).toMatch(/Case not found/i);
    });
  });

  describe('funding-cases-guest-lookup', () => {
    function lookupSuccessSb() {
      return mockCreateSb({
        funding_cases: {
          data: {
            id: 'case-1',
            case_reference: 'BF-2026-000001',
            status: 'new',
            name: 'Ali',
            email: 'ali@example.com',
            phone: '+966500000000',
            country: 'SA',
            financing_type: 'Business',
            amount: 100000,
            purpose_category: 'Expansion',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z'
          },
          error: null
        }
      });
    }

    test('returns limited case summary when email matches', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: {
          caseReference: 'BF-2026-000001',
          email: 'ali@example.com'
        }
      });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.case.case_reference).toBe('BF-2026-000001');
      expect(res._json.portalLink).toContain('/client/funding-case.html?id=case-1');

      // Rate-limit categories and identities
      expect(checkRateLimit).toHaveBeenCalledTimes(2);
      expect(checkRateLimit).toHaveBeenNthCalledWith(
        1,
        'funding_case_guest_lookup_global',
        req,
        res,
        'funding-case-guest-lookup-global',
        true
      );
      expect(checkRateLimit).toHaveBeenNthCalledWith(
        2,
        'funding_case_guest_lookup_per_case',
        req,
        res,
        hmacCaseReference('BF-2026-000001'),
        true
      );
    });

    test('returns generic error when contact details do not match', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: {
          caseReference: 'BF-2026-000001',
          email: 'other@example.com'
        }
      });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(500);
      expect(res._json.error).toMatch(/Case not found or details do not match/i);
      errorSpy.mockRestore();
    });

    test('returns error when required fields are missing', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const sb = mockCreateSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: {}
      });
      const res = mockRes();
      await handler(req, res);
      expect(res.statusCode).toBe(500);
      expect(res._json.error).toMatch(/Case reference and email or phone are required/i);
      errorSpy.mockRestore();
    });

    test('uses dedicated global and per-case categories', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: { caseReference: 'BF-2026-000001', email: 'ali@example.com' }
      });
      const res = mockRes();
      await handler(req, res);

      const categories = checkRateLimit.mock.calls.map((call) => call[0]);
      expect(categories).toContain('funding_case_guest_lookup_global');
      expect(categories).toContain('funding_case_guest_lookup_per_case');
      expect(categories).not.toContain('public');
    });

    test('global identity is static and does not contain client IP information', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        headers: { 'x-forwarded-for': '1.2.3.4' },
        body: { caseReference: 'BF-2026-000001', email: 'ali@example.com' }
      });
      const res = mockRes();
      await handler(req, res);

      const globalCall = checkRateLimit.mock.calls.find((call) => call[0] === 'funding_case_guest_lookup_global');
      expect(globalCall[3]).toBe('funding-case-guest-lookup-global');
      expect(globalCall[3]).not.toContain('1.2.3.4');
      expect(globalCall[3]).not.toContain('x-forwarded-for');
    });

    test('per-case identity is HMAC-SHA256 of trimmed case_reference', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: { caseReference: '  BF-2026-000001  ', email: 'ali@example.com' }
      });
      const res = mockRes();
      await handler(req, res);

      const perCaseCall = checkRateLimit.mock.calls.find((call) => call[0] === 'funding_case_guest_lookup_per_case');
      expect(perCaseCall[3]).toBe(hmacCaseReference('BF-2026-000001'));
      expect(perCaseCall[3]).toBe(hmacCaseReference('  BF-2026-000001  '));
    });

    test('different case_references produce different per-case identities', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      for (const ref of ['BF-2026-000001', 'BF-2026-000002']) {
        checkRateLimit.mockClear();
        checkRateLimit.mockReturnValue(Promise.resolve(false));
        mockGetSupabase.mockReturnValue(sb);

        const req = mockReq({
          method: 'POST',
          query: { action: 'funding-cases-guest-lookup' },
          body: { caseReference: ref, email: 'ali@example.com' }
        });
        const res = mockRes();
        await handler(req, res);

        const perCaseCall = checkRateLimit.mock.calls.find((call) => call[0] === 'funding_case_guest_lookup_per_case');
        expect(perCaseCall[3]).toBe(hmacCaseReference(ref));
      }
    });

    test('per-case identity does not contain raw case_reference, email, or phone', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: { caseReference: 'BF-2026-000001', email: 'ali@example.com', phone: '+966500000000' }
      });
      const res = mockRes();
      await handler(req, res);

      const perCaseCall = checkRateLimit.mock.calls.find((call) => call[0] === 'funding_case_guest_lookup_per_case');
      const identity = perCaseCall[3];
      expect(identity).toMatch(/^[0-9a-f]{64}$/);
      expect(identity).not.toContain('BF-2026-000001');
      expect(identity).not.toContain('ali@example.com');
      expect(identity).not.toContain('+966500000000');
    });

    test('X-Forwarded-For and malformed forwarding headers do not affect identities', async () => {
      const sb = lookupSuccessSb();

      const headersList = [
        {},
        { 'x-forwarded-for': '1.2.3.4' },
        { 'x-forwarded-for': 'spoofed, 5.6.7.8, 9.10.11.12' },
        { 'x-forwarded-for': 'not-an-ip' },
        { 'x-real-ip': '2.3.4.5' },
        { 'cf-connecting-ip': '3.4.5.6' }
      ];

      const identities = [];
      for (const headers of headersList) {
        checkRateLimit.mockClear();
        checkRateLimit.mockReturnValue(Promise.resolve(false));
        mockGetSupabase.mockReturnValue(sb);

        const req = mockReq({
          method: 'POST',
          query: { action: 'funding-cases-guest-lookup' },
          headers,
          body: { caseReference: 'BF-2026-000001', email: 'ali@example.com' }
        });
        const res = mockRes();
        await handler(req, res);

        const globalCall = checkRateLimit.mock.calls.find((call) => call[0] === 'funding_case_guest_lookup_global');
        const perCaseCall = checkRateLimit.mock.calls.find((call) => call[0] === 'funding_case_guest_lookup_per_case');
        identities.push({ global: globalCall[3], perCase: perCaseCall[3] });
      }

      const first = identities[0];
      for (const id of identities) {
        expect(id.global).toBe(first.global);
        expect(id.perCase).toBe(first.perCase);
      }
    });

    test('global rate limit denial prevents database lookup', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);
      checkRateLimit.mockImplementation(async (category, req, res) => {
        if (category === 'funding_case_guest_lookup_global') {
          res.status(429).json({ error: 'Too many requests. Please try again later.' });
          return true;
        }
        return false;
      });

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: { caseReference: 'BF-2026-000001', email: 'ali@example.com' }
      });
      const res = mockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(429);
      expect(checkRateLimit).toHaveBeenCalledTimes(1);
      expect(sb.from).not.toHaveBeenCalledWith('funding_cases');
    });

    test('per-case rate limit denial prevents database lookup', async () => {
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);
      checkRateLimit.mockImplementation(async (category, req, res) => {
        if (category === 'funding_case_guest_lookup_per_case') {
          res.status(429).json({ error: 'Too many requests. Please try again later.' });
          return true;
        }
        return false;
      });

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: { caseReference: 'BF-2026-000001', email: 'ali@example.com' }
      });
      const res = mockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(429);
      expect(checkRateLimit).toHaveBeenCalledTimes(2);
      expect(sb.from).not.toHaveBeenCalledWith('funding_cases');
    });

    test('missing RATE_LIMIT_HMAC_SECRET fails closed with 429 and prevents lookup', async () => {
      process.env.RATE_LIMIT_HMAC_SECRET = '';
      const sb = lookupSuccessSb();
      mockGetSupabase.mockReturnValue(sb);

      const req = mockReq({
        method: 'POST',
        query: { action: 'funding-cases-guest-lookup' },
        body: { caseReference: 'BF-2026-000001', email: 'ali@example.com' }
      });
      const res = mockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(429);
      expect(res._json.error).toMatch(/Too many requests/i);
      const perCaseCalls = checkRateLimit.mock.calls.filter((call) => call[0] === 'funding_case_guest_lookup_per_case');
      expect(perCaseCalls).toHaveLength(0);
      expect(sb.from).not.toHaveBeenCalledWith('funding_cases');
    });

    test('distributed RPC failure fails closed for guest lookup', async () => {
      const { checkRateLimit: realCheckRateLimit } = jest.requireActual('../../lib/api/rate-limit');
      checkRateLimitDistributed.mockResolvedValue(null);

      const req = mockReq({ method: 'POST', headers: {} });
      const res = mockRes();
      const result = await realCheckRateLimit(
        'funding_case_guest_lookup_global',
        req,
        res,
        'funding-case-guest-lookup-global',
        true
      );

      expect(result).toBe(true);
      expect(res.statusCode).toBe(429);
      expect(res._json.error).toMatch(/Too many requests/i);
    });
  });

  describe('rate-limit isolation for unrelated endpoints', () => {
    test('unrelated admin action uses standard category without identity or failClosed', async () => {
      const req = mockReq({ method: 'GET', query: { action: 'settings' } });
      const res = mockRes();
      await handler(req, res);

      const rateCall = checkRateLimit.mock.calls[0];
      expect(rateCall[0]).not.toBe('funding_case_guest_lookup_global');
      expect(rateCall[0]).not.toBe('funding_case_guest_lookup_per_case');
      expect(rateCall[0]).not.toBe('public');
      expect(rateCall.length).toBe(3);
      expect(typeof rateCall[0]).toBe('string');
    });

    test('unrelated endpoint still falls back to local limiter on distributed RPC failure', async () => {
      const { checkRateLimit: realCheckRateLimit } = jest.requireActual('../../lib/api/rate-limit');
      checkRateLimitDistributed.mockResolvedValue(null);

      const req = mockReq({ method: 'GET', headers: {} });
      const res = mockRes();
      const result = await realCheckRateLimit('public', req, res, 'unrelated-test-identity');

      expect(result).toBe(false);
      expect(res.statusCode).toBe(200);
      expect(res.headers['X-RateLimit-Limit']).toBe('100');
    });
  });
});
