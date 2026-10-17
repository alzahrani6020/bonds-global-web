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

  test('payment return URLs trust the canonical Bonds origins plus configured app origin only', () => {
    expect(payments).toContain("'https://bonds-global.com'");
    expect(payments).toContain("'https://www.bonds-global.com'");
    expect(payments).toContain('PAYMENT_RETURN_ORIGINS.has(new URL(candidate).origin)');
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


describe('Release completeness payment invariants', () => {
  const payments = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'payments.js'), 'utf8');
  const auth = fs.readFileSync(path.join(__dirname, '..', '..', 'bonds-auth-2026.js'), 'utf8');
  const v3Billing = fs.readFileSync(path.join(__dirname, '..', '..', 'v3', 'api', 'billing.js'), 'utf8');
  const enPricing = fs.readFileSync(path.join(__dirname, '..', '..', 'en', 'pricing.html'), 'utf8');
  const arSubscription = fs.readFileSync(path.join(__dirname, '..', '..', 'calculators', 'auth', 'subscription.html'), 'utf8');
  const enSubscription = fs.readFileSync(path.join(__dirname, '..', '..', 'en', 'calculators', 'auth', 'subscription.html'), 'utf8');
  const platform = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'platform.js'), 'utf8');
  const legacyWebhookScript = fs.readFileSync(path.join(__dirname, '..', '..', 'v3', 'scripts', 'create-stripe-webhook.js'), 'utf8');

  test('one-off payment is fulfilled only after Stripe reports paid through the atomic database RPC', () => {
    expect(payments).toContain("session.metadata?.type === 'oneoff'");
    expect(payments).toContain("session.payment_status !== 'paid'");
    expect(payments).toContain("'fulfill_oneoff_purchase_atomic'");
    expect(payments).toContain("p_stripe_session_id: session.id");
    expect(payments).toContain("p_user_id: userId");
    expect(payments).toContain("p_product: product");
    expect(payments).toContain("p_payment_intent_id: paymentIntentId");
    expect(payments).toContain("checkout.session.async_payment_succeeded");
    expect(payments).not.toContain("oneoff_credits: credits");
  });

  test('unknown Stripe prices fail closed in legacy and V3 billing', () => {
    expect(payments).toContain('Refusing paid entitlement for unapproved Stripe price');
    expect(payments).toContain('Refusing subscription update for unapproved Stripe price');
    expect(v3Billing).toContain('Invalid or unapproved priceId');
    expect(v3Billing).toContain('Refusing unapproved Stripe price');
  });

  test('V3 checkout authenticates user, allowlists price and creates the same 14-day trial', () => {
    expect(v3Billing).toContain('const user = await getUserFromToken(req)');
    expect(v3Billing).toContain("if (!user) return sendJson(res, 401");
    expect(v3Billing).toContain('trial_period_days: 14');
    expect(v3Billing).toContain('supabaseUserId: user.id');
    expect(v3Billing).toContain("payment_method: 'stripe'");
  });

  test('Moyasar payment transition cannot repeatedly extend entitlement', () => {
    expect(payments).toContain(".neq('status', 'paid')");
    expect(payments).toContain('normalizeMoyasarInvoiceStatus');
    expect(payments).toContain('const invoice = await getInvoice(invoiceId)');
    expect(payments).not.toContain("req.headers['x-moyasar-webhook-secret']");
  });

  test('subscription rows are authoritative and inactive rows fail closed', () => {
    expect(auth).toContain('const hasSubscriptionRecord = Boolean(sub)');
    expect(auth).toContain("hasSubscriptionRecord ? 'free'");
    expect(arSubscription).toContain("sub.status === 'active' || sub.status === 'trialing'");
    expect(enSubscription).toContain("sub.status === 'active' || sub.status === 'trialing'");
  });

  test('English pricing and subscription pages preserve payment semantics', () => {
    expect(enPricing).toContain('14-day free trial via card');
    expect(enPricing).toContain('/en/calculators/auth/subscription.html?moyasar=success');
    expect(arSubscription).toContain("paymentMethod === 'stripe'");
    expect(enSubscription).toContain("paymentMethod === 'stripe'");
    expect(enSubscription).toContain("'Trial'");
  });

  test('customer-facing Pro redirects use canonical public URL', () => {
    expect(platform).toContain("BONDS_PUBLIC_APP_URL || 'https://bonds-global.com'");
    expect(platform).toContain('PUBLIC_APP_URL');
  });

  test('stale V3 webhook provisioning cannot deploy production', () => {
    expect(legacyWebhookScript).toContain('Deprecated: do not run');
    expect(legacyWebhookScript).not.toContain("vercel', ['--prod'");
    expect(legacyWebhookScript).not.toContain('bonds-v3.vercel.app');
  });
});


describe('Provisioning and webhook consolidation invariants', () => {
  const payments = fs.readFileSync(path.join(__dirname, '..', '..', 'api', 'payments.js'), 'utf8');
  const setupStripe = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'setup-stripe.js'), 'utf8');

  test('V3 webhook alias uses the canonical verified Stripe handler', () => {
    expect(payments).not.toContain("processStripeWebhook");
    expect(payments).not.toContain("billingHandleV3Webhook");
    expect(payments).toContain("action === 'v3-stripe-webhook'");
    expect(payments).toContain('return billingHandleLegacyWebhook(req, res)');
  });

  test('Stripe provisioning selects canonical active SAR monthly prices', () => {
    expect(setupStripe).toContain("active: true");
    expect(setupStripe).toContain("p.currency === 'sar'");
    expect(setupStripe).toContain("p.unit_amount === 7100");
    expect(setupStripe).toContain("p.unit_amount === 18400");
    expect(setupStripe).toContain("p.recurring?.interval === 'month'");
    expect(setupStripe).toContain("tr.inclusive === false");
    expect(setupStripe).toContain("'checkout.session.async_payment_succeeded'");
  });
});
