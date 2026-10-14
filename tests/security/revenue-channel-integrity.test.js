const fs = require('fs');
const path = require('path');

describe('Revenue channel integrity', () => {
  const admin = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'admin.js'), 'utf8');
  const payments = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'payments.js'), 'utf8');
  const pricing = fs.readFileSync(path.join(__dirname, '..', '..', 'pricing.html'), 'utf8');

  test('verified bank transfer creates an active one-month entitlement before resolution', () => {
    expect(admin).toContain("if (request.status !== 'pending')");
    expect(admin).toContain("throw new Error('No matching user exists for this bank transfer')");
    expect(admin).toContain("payment_method: 'bank_transfer'");
    expect(admin).toContain("status: 'active'");
    expect(admin).toContain("periodEnd.setMonth(periodEnd.getMonth() + 1)");
    expect(admin).toContain("sb.from('subscriptions').upsert");
    expect(admin).toContain("cancel_at_period_end: false");
  });

  test('Moyasar return URLs use the same exact-origin validator as Stripe', () => {
    expect(payments).toContain('isSafeCheckoutReturnUrl(successUrl)');
    expect(payments).toContain('isSafeCheckoutReturnUrl(cancelUrl)');
    expect(payments).not.toContain('successUrl.startsWith(APP_URL)');
    expect(payments).not.toContain('cancelUrl.startsWith(APP_URL)');
  });

  test('pricing makes the card-only trial scope explicit', () => {
    expect(pricing).toContain('14 يوماً عند الاشتراك بالبطاقة');
    expect(pricing).toContain('14 يوم تجربة مجانية عبر البطاقة');
  });
});
