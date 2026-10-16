const checkRateLimit = jest.fn();
const analyzeDocument = jest.fn();
const v3Handler = jest.fn();

jest.mock('../../lib/api/rate-limit', () => ({ checkRateLimit }));
jest.mock('../../lib/api/analyze-document', () => analyzeDocument);
jest.mock('../../v3/api/index.js', () => v3Handler);
jest.mock('../../lib/api/cors', () => ({ setAllowedOrigin: jest.fn() }));

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

describe('document analysis rate-limit routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkRateLimit.mockResolvedValue(false);
    analyzeDocument.mockResolvedValue(undefined);
  });

  test('POST passes through the existing document_analysis limiter before the parser', async () => {
    const req = createRequest('POST');
    const res = createResponse();

    await handler(req, res);

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(checkRateLimit).toHaveBeenCalledWith('document_analysis', req, res, undefined, true);
    expect(analyzeDocument).toHaveBeenCalledTimes(1);
    expect(checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      analyzeDocument.mock.invocationCallOrder[0]
    );
  });

  test('rate-limit denial returns 429 and parser does not start', async () => {
    checkRateLimit.mockImplementationOnce(async (_category, _req, res) => {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return true;
    });

    const req = createRequest('POST');
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(analyzeDocument).not.toHaveBeenCalled();
  });

  test('OPTIONS remains allowed without invoking limiter or parser', async () => {
    const req = createRequest('OPTIONS');
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(analyzeDocument).not.toHaveBeenCalled();
  });

  test.each(['GET', 'PUT', 'DELETE'])('%s remains 405 without invoking parser', async method => {
    const req = createRequest(method);
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(analyzeDocument).not.toHaveBeenCalled();
  });
});
