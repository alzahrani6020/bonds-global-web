/**
 * @jest-environment node
 */

// Regression: GET /api/admin?action=settings must require an authenticated
// admin. It previously returned the full settings object (commission rates,
// one-off pricing, admin MFA posture) to anonymous callers even though every
// legitimate consumer sends a Bearer token.

jest.mock('../../lib/api/email', () => ({
  sendEmail: jest.fn(() => Promise.resolve({ success: true }))
}));

jest.mock('../../lib/api/rate-limit-distributed', () => ({
  checkRateLimitDistributed: jest.fn(() => Promise.resolve(null))
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(false))
}));

function mockCreateChain(result = { data: null, error: null }) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve({ data: result.data, error: result.error })),
    single: jest.fn(() => Promise.resolve({ data: result.data, error: result.error })),
    then: (resolve) => resolve({ data: result.data, error: result.error })
  };
  return chain;
}

const mockSb = {
  auth: {
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: { message: 'invalid token' } }))
  },
  from: jest.fn(() => mockCreateChain()),
  storage: { from: jest.fn(() => ({ createSignedUrl: jest.fn() })) }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSb));

const handler = require('../../api/admin');

function mockReq(overrides = {}) {
  return { method: 'GET', headers: {}, query: {}, body: {}, ...overrides };
}

function mockRes() {
  const res = { statusCode: 200, headers: {}, _json: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res._json = body; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => {};
  return res;
}

describe('admin settings endpoint authorization', () => {
  test('anonymous GET settings is rejected and leaks no settings fields', async () => {
    const req = mockReq({ method: 'GET', query: { action: 'settings' } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._json.error).toMatch(/unauthorized|admin required|authorization header/i);
    expect(res._json.calc_limit).toBeUndefined();
    expect(res._json.admin_enforce_mfa).toBeUndefined();
    expect(res._json.advisor_default_commission_rate).toBeUndefined();
  });

  test('unknown actions are still rejected without touching settings data', async () => {
    const req = mockReq({ method: 'GET', query: { action: 'definitely-not-real' } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._json.error).toMatch(/unknown action/i);
  });
});
