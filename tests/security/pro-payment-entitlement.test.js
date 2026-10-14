const fs = require('fs');
const path = require('path');

describe('Bonds Pro payment entitlement contract', () => {
  const platform = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'platform.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'pro', 'app.js'), 'utf8');
  const report = fs.readFileSync(path.join(__dirname, '..', '..', 'pro', 'report.html'), 'utf8');

  test('monthly checkout is a real Stripe subscription and single report is a payment', () => {
    expect(platform).toContain("mode: monthly ? 'subscription' : 'payment'");
    expect(platform).toContain("priceData.recurring = { interval: 'month' }");
    expect(platform).toContain("subscription_data = { metadata }");
  });

  test('checkout binds the analyzed project into Stripe metadata', () => {
    for (const key of ['bonds_pro', 'plan', 'sector', 'activity', 'capital', 'revenue']) {
      expect(platform).toContain(key);
    }
    expect(app).toContain("JSON.stringify({ action: 'stripe', plan, email, project })");
  });

  test('paid report requires a verified Stripe Checkout session', () => {
    expect(platform).toContain("stripe.checkout.sessions.retrieve(sessionId)");
    expect(platform).toContain("session.payment_status === 'paid'");
    expect(platform).toContain("stripe.subscriptions.retrieve(session.subscription)");
    expect(report).toContain("params.get('session_id')");
    expect(report).toContain("action: 'report'");
  });

  test('client-side paid query flag cannot unlock the report', () => {
    expect(report).not.toContain('p.paid');
    expect(report).not.toContain('?paid=1');
    expect(platform).not.toContain('/pro/report.html?paid=1');
  });

  test('Bonds Pro uses dedicated optional price IDs instead of unrelated plan prices', () => {
    expect(platform).toContain('STRIPE_PRICE_PRO_REPORT');
    expect(platform).toContain('STRIPE_PRICE_PRO_MONTHLY');
    expect(platform).not.toContain("plan === 'monthly' ? process.env.STRIPE_PRICE_ENTERPRISE : process.env.STRIPE_PRICE_PRO");
  });
});
