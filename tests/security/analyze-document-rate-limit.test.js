const mockCheckRateLimit = jest.fn();
const mockAnalyzeDocument = jest.fn();
const mockV3Handler = jest.fn();
const mockCreateClient = jest.fn();
const mockParseDocument = jest.fn();
const mockDocumentParserError = class DocumentParserError extends Error {
  constructor(code) {
    super('normalized parser error');
    this.code = code;
  }
};

jest.mock('../../lib/api/rate-limit', () => ({ checkRateLimit: mockCheckRateLimit }));
jest.mock('../../lib/api/analyze-document', () => mockAnalyzeDocument);
jest.mock('../../v3/api/index.js', () => mockV3Handler);
jest.mock('../../lib/api/cors', () => ({ setAllowedOrigin: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));
jest.mock('../../lib/api/document-parser', () => ({
  parseDocument: mockParseDocument,
  DocumentParserError: mockDocumentParserError
}));

const handler = require('../../api/v3/index.js');

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader: jest.fn(function(name, value) {
      this.headers[name] = value;
    }),
    status: jest.fn(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function(body) {
      this.body = body;
      return this;
    }),
    end: jest.fn(function() {
      return this;
    })
  };
}

function createRequest(method = 'POST') {
  return {
    method,
    url: '/api/v3/analyze-document',
    headers: { host: 'localhost', authorization: 'Bearer test-token' },
    query: {},
    body: { documentId: 'doc-1' },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function arrayBufferOf(bytes) {
  const value = Buffer.from(bytes);
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

describe('document analysis rate-limit routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
    mockAnalyzeDocument.mockResolvedValue(undefined);
  });

  test('POST passes through the existing document_analysis limiter before the parser', async () => {
    const req = createRequest('POST');
    const res = createResponse();

    await handler(req, res);

    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('document_analysis', req, res, undefined, true);
    expect(mockAnalyzeDocument).toHaveBeenCalledTimes(1);
    expect(mockCheckRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mockAnalyzeDocument.mock.invocationCallOrder[0]
    );
  });

  test('rate-limit denial returns 429 and parser does not start', async () => {
    mockCheckRateLimit.mockImplementationOnce(async (_category, _req, res) => {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return true;
    });

    const req = createRequest('POST');
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(mockAnalyzeDocument).not.toHaveBeenCalled();
  });

  test('OPTIONS remains allowed without invoking limiter or parser', async () => {
    const req = createRequest('OPTIONS');
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockAnalyzeDocument).not.toHaveBeenCalled();
  });

  test.each(['GET', 'PUT', 'DELETE'])('%s remains 405 without invoking parser', async method => {
    const req = createRequest(method);
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockAnalyzeDocument).not.toHaveBeenCalled();
  });
});

describe('document analysis auth, ownership, and parser error regression', () => {
  const originalEnv = process.env;
  const actualAnalyzeDocument = jest.requireActual('../../lib/api/analyze-document');

  beforeEach(() => {
    jest.clearAllMocks();
    mockParseDocument.mockResolvedValue({
      text: 'parsed',
      rows: null,
      summary: 'parsed safely',
      method: 'local'
    });
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('missing bearer token remains 401 before document access', async () => {
    const req = { headers: {}, body: { documentId: 'doc-1' } };
    const res = createResponse();

    await actualAnalyzeDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockParseDocument).not.toHaveBeenCalled();
  });

  test('authenticated non-owner remains 403 before download or parsing', async () => {
    const download = jest.fn();
    const update = jest.fn();
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'doc-1',
        storage_path: 'user-b/doc-1.docx',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        advisory_clients: { auth_user_id: 'user-b' }
      },
      error: null
    });
    const selectEq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq: selectEq }));
    const sb = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }) },
      from: jest.fn(() => ({ select, update })),
      storage: { from: jest.fn(() => ({ download })) }
    };
    mockCreateClient.mockReturnValue(sb);

    const req = {
      headers: { authorization: 'Bearer valid-token' },
      body: { documentId: 'doc-1' }
    };
    const res = createResponse();

    await actualAnalyzeDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(download).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(mockParseDocument).not.toHaveBeenCalled();
  });

  test('authenticated owner reaches parser only after ownership and download succeed', async () => {
    const fileBlob = { arrayBuffer: jest.fn().mockResolvedValue(arrayBufferOf('PK fixture')) };
    const download = jest.fn().mockResolvedValue({ data: fileBlob, error: null });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'doc-1',
        storage_path: 'user-a/doc-1.docx',
        storage_bucket: 'client-documents',
        security_status: 'clean',
        security_verdict: 'clean',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: 'doc-1.docx',
        advisory_clients: { auth_user_id: 'user-a' }
      },
      error: null
    });
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));
    const sb = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }) },
      from: jest.fn(() => ({
        select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle })) })),
        update
      })),
      storage: { from: jest.fn(() => ({ download })) }
    };
    mockCreateClient.mockReturnValue(sb);

    const req = {
      headers: { authorization: 'Bearer valid-token' },
      body: { documentId: 'doc-1' }
    };
    const res = createResponse();

    await actualAnalyzeDocument(req, res);

    expect(download).toHaveBeenCalledWith('user-a/doc-1.docx');
    expect(mockParseDocument).toHaveBeenCalledTimes(1);
    expect(download.mock.invocationCallOrder[0]).toBeLessThan(mockParseDocument.mock.invocationCallOrder[0]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(updateEq).toHaveBeenCalledWith('id', 'doc-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      success: true,
      extracted: {
        text: 'parsed',
        summary: 'parsed safely'
      }
    });
  });

  test('authenticated owner image flow remains available without parser invocation', async () => {
    const fileBlob = { arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)) };
    const download = jest.fn().mockResolvedValue({ data: fileBlob, error: null });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'doc-1',
        storage_path: 'user-a/doc-1.png',
        storage_bucket: 'client-documents',
        security_status: 'clean',
        security_verdict: 'clean',
        mime_type: 'image/png',
        filename: 'doc-1.png',
        advisory_clients: { auth_user_id: 'user-a' }
      },
      error: null
    });
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));
    const sb = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }) },
      from: jest.fn(() => ({
        select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle })) })),
        update
      })),
      storage: { from: jest.fn(() => ({ download })) }
    };
    mockCreateClient.mockReturnValue(sb);

    const req = {
      headers: { authorization: 'Bearer valid-token' },
      body: { documentId: 'doc-1' }
    };
    const res = createResponse();

    await actualAnalyzeDocument(req, res);

    expect(download).toHaveBeenCalledWith('user-a/doc-1.png');
    expect(mockParseDocument).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(updateEq).toHaveBeenCalledWith('id', 'doc-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('internal parser failures are normalized before persistence and response', async () => {
    const fileBlob = { arrayBuffer: jest.fn().mockResolvedValue(arrayBufferOf('fake-docx')) };
    const download = jest.fn().mockResolvedValue({ data: fileBlob, error: null });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'doc-1',
        storage_path: 'user-a/doc-1.docx',
        storage_bucket: 'client-documents',
        security_status: 'clean',
        security_verdict: 'clean',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: 'doc-1.docx',
        advisory_clients: { auth_user_id: 'user-a' }
      },
      error: null
    });
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));
    const sb = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }) },
      from: jest.fn(() => ({
        select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle })) })),
        update
      })),
      storage: { from: jest.fn(() => ({ download })) }
    };
    mockCreateClient.mockReturnValue(sb);

    const internal = new mockDocumentParserError('MALFORMED_ARCHIVE');
    internal.message = '/tmp/private/customer.docx: XML parser stack detail';
    mockParseDocument.mockRejectedValueOnce(internal);

    const req = {
      headers: { authorization: 'Bearer valid-token' },
      body: { documentId: 'doc-1' }
    };
    const res = createResponse();

    await actualAnalyzeDocument(req, res);

    const persisted = update.mock.calls[0][0].extracted_data;
    expect(persisted.error_code).toBe('MALFORMED_ARCHIVE');
    expect(persisted.error).toBe('تعذر معالجة الملف بأمان');
    expect(persisted.summary).toBe('تعذر معالجة الملف بأمان');
    expect(JSON.stringify(persisted)).not.toContain('/tmp/private');
    expect(JSON.stringify(res.body)).not.toContain('XML parser stack detail');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
