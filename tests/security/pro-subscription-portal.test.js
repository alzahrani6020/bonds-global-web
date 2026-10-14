const mockCheckoutRetrieve = jest.fn();
const mockSubscriptionRetrieve = jest.fn();
const mockPortalCreate = jest.fn();

jest.mock('stripe', () => jest.fn(() => ({
  checkout: { sessions: { retrieve: mockCheckoutRetrieve, create: jest.fn() } },
  subscriptions: { retrieve: mockSubscriptionRetrieve },
  billingPortal: { sessions: { create: mockPortalCreate } },
})));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(async () => false),
}));

jest.mock('../../lib/api/supabase', () => jest.fn(() => ({
  auth: { getUser: jest.fn() },
})));

jest.mock('../../lib/api/email', () => ({
  sendEmail: jest.fn(),
}));

const handler = require('../../api/platform');

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; return this; },
    send(body) { this.body = body; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
  };
}

function request(body) {
  return {
    method: 'POST',
    url: '/api/pro',
    headers: { host: 'bonds-global.com', origin: 'https://bonds-global.com' },
    body,
    query: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
}

describe('Bonds Pro Stripe customer portal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.NEXT_PUBLIC_APP_URL = 'https://bonds-global.com';
  });

  test('active monthly subscription gets a Stripe billing portal session', async () => {
    mockCheckoutRetrieve.mockResolvedValue({
      metadata: { bonds_pro: '1', plan: 'monthly' },
      subscription: 'sub_123',
      customer: 'cus_123',
    });
    mockSubscriptionRetrieve.mockResolvedValue({ status: 'active' });
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/test_123' });

    const res = response();
    await handler(request({ action: 'portal', session_id: 'cs_test_123' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBe('https://billing.stripe.com/p/session/test_123');
    expect(mockSubscriptionRetrieve).toHaveBeenCalledWith('sub_123');
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://bonds-global.com/pro/',
    });
  });

  test('one-time report cannot open subscription portal', async () => {
    mockCheckoutRetrieve.mockResolvedValue({
      metadata: { bonds_pro: '1', plan: 'single' },
      subscription: null,
      customer: 'cus_123',
    });

    const res = response();
    await handler(request({ action: 'portal', session_id: 'cs_test_single' }), res);

    expect(res.statusCode).toBe(403);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  test('inactive monthly subscription cannot open portal', async () => {
    mockCheckoutRetrieve.mockResolvedValue({
      metadata: { bonds_pro: '1', plan: 'monthly' },
      subscription: 'sub_inactive',
      customer: 'cus_123',
    });
    mockSubscriptionRetrieve.mockResolvedValue({ status: 'canceled' });

    const res = response();
    await handler(request({ action: 'portal', session_id: 'cs_test_inactive' }), res);

    expect(res.statusCode).toBe(402);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });
});
