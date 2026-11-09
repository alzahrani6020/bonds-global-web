/**
 * @jest-environment node
 */

const captured = {};

jest.mock('../../lib/api/supabase', () => jest.fn(() => {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((column, value) => {
      captured.filters[column] = value;
      return query;
    }),
    ilike: jest.fn(() => query),
    or: jest.fn(() => query),
    order: jest.fn(() => query),
    range: jest.fn(() => Promise.resolve({
      data: captured.rows,
      error: null
    }))
  };
  return { from: jest.fn(() => query) };
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(false))
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

const handler = require('../../api/funding');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; }
  };
  return res;
}

describe('funding sources dispatcher', () => {
  beforeEach(() => {
    captured.filters = {};
    captured.rows = [
      { id: 'jo-1', name_ar: 'صندوق تنمية المحافظات', country_code: 'JO', type: 'government_program' }
    ];
  });

  test('infers sources action from /api/funding-sources without req.query', () => {
    expect(handler.inferFundingAction(
      { url: '/api/funding-sources?country_code=JO' },
      {}
    )).toBe('sources');
  });

  test('parses country_code from the request URL when req.query is missing', () => {
    const query = handler.parseRequestQuery({
      url: '/api/funding?action=sources&country_code=JO&type=government_program'
    });
    expect(query).toEqual({
      action: 'sources',
      country_code: 'JO',
      type: 'government_program'
    });
  });

  test('lists sources for Jordan from the rewritten local URL', async () => {
    const req = {
      method: 'GET',
      url: '/api/funding-sources?country_code=JO&type=government_program',
      headers: {}
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(captured.filters.country_code).toBe('JO');
    expect(captured.filters.type).toBe('government_program');
    expect(res.body.data[0].country_code).toBe('JO');
  });

  test('still rejects /api/funding without an action', async () => {
    const req = { method: 'GET', url: '/api/funding', headers: {}, query: {} };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/action/i);
  });
});
