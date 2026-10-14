const { Readable } = require('stream');

const mockCustomersList = jest.fn();
const mockCustomersCreate = jest.fn();
const mockCheckoutCreate = jest.fn();

jest.mock('stripe', () => jest.fn(() => ({
  customers: {
    list: mockCustomersList,
    create: mockCustomersCreate,
  },
  checkout: {
    sessions: {
      create: mockCheckoutCreate,
    },
  },
  subscriptions: {
    update: jest.fn(),
    retrieve: jest.fn(),
  },
  billingPortal: {
    sessions: {
      create: jest.fn(),
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
})));

jest.mock('../../lib/api/auth-helper', () => ({
  verifyBearerAndUser: jest.fn(async () => ({
    id: 'user_123',
    email: 'customer@example.com',
  })),
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(async () => false),
}));

jest.mock('../../lib/api/cors', () => ({
  setAllowedOrigin: jest.fn(),
}));

jest.mock('../../lib/api/supabase', () => jest.fn(() => ({
  from: jest.fn(() => ({
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  })),
})));

jest.mock('../../v3/api/billing', () => ({
  processStripeWebhook: jest.fn(),
}));

jest.mock('../../lib/api/moyasar-helper', () => ({
  createInvoice: jest.fn(),
  getInvoice: jest.fn(),
  getTierLabel: jest.fn(),
}));

const handler = require('../../api/payments');

function request(body) {
  const req = Readable.from([JSON.stringify(body)]);
  req.method = 'POST';
  req.url = '/api/create-checkout';
  req.headers = {
    host: 'bonds-global.com',
    authorization: 'Bearer test-token',
    origin: 'https://bonds-global.com',
  };
  req.query = {};
  return req;
}

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
  };
}

describe('Pricing Stripe checkout integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_PRICE_PRO = 'price_pro_approved';
    process.env.STRIPE_PRICE_ENTERPRISE = 'price_enterprise_approved';
    process.env.NEXT_PUBLIC_APP_URL = 'https://bonds-global.com';
    delete process.env.STRIPE_TAX_RATE_ID;

    mockCustomersList.mockResolvedValue({
      data: [{ id: 'cus_123' }],
    });
    mockCheckoutCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
  });

  test('approved Pro price creates a 14-day trial subscription', async () => {
    const req = request({
      priceId: 'price_pro_approved',
      email: 'customer@example.com',
      currency: 'SAR',
      vatPercent: 15,
      successUrl: 'https://bonds-global.com/calculators/restaurant.html?subscribed=1',
      cancelUrl: 'https://bonds-global.com/pricing.html?canceled=1',
    });
    const res = response();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');
    expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);

    const config = mockCheckoutCreate.mock.calls[0][0];
    expect(config.mode).toBe('subscription');
    expect(config.line_items).toEqual([{ price: 'price_pro_approved', quantity: 1 }]);
    expect(config.subscription_data.trial_period_days).toBe(14);
    expect(config.subscription_data.metadata).toMatchObject({
      supabaseUserId: 'user_123',
      tier: 'pro',
      currency: 'SAR',
    });
  });

  test('approved Enterprise price records enterprise tier', async () => {
    const req = request({
      priceId: 'price_enterprise_approved',
      email: 'customer@example.com',
    });
    const res = response();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const config = mockCheckoutCreate.mock.calls[0][0];
    expect(config.subscription_data.metadata.tier).toBe('enterprise');
    expect(config.subscription_data.trial_period_days).toBe(14);
  });

  test('rejects arbitrary Stripe prices even when they look valid', async () => {
    const req = request({
      priceId: 'price_attacker_controlled',
      email: 'customer@example.com',
    });
    const res = response();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unapproved priceId/i);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  test('rejects lookalike external success URLs', async () => {
    const req = request({
      priceId: 'price_pro_approved',
      email: 'customer@example.com',
      successUrl: 'https://bonds-global.com.evil.example/steal',
    });
    const res = response();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid successUrl');
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });
});
