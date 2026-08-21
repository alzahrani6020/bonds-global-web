/**
 * @jest-environment node
 */

jest.mock('../../lib/api/email', () => ({
  sendEmail: jest.fn(() => Promise.resolve({ success: true }))
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(false))
}));

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

describe('/api/admin funding-cases client portal', () => {
  beforeEach(() => {
    mockGetSupabase.mockClear && mockGetSupabase.mockClear();
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
    test('returns limited case summary when email matches', async () => {
      const sb = mockCreateSb({
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
    });

    test('returns generic error when contact details do not match', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const sb = mockCreateSb({
        funding_cases: {
          data: {
            id: 'case-1',
            case_reference: 'BF-2026-000001',
            status: 'new',
            name: 'Ali',
            email: 'ali@example.com',
            phone: '+966500000000'
          },
          error: null
        }
      });
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
  });
});
