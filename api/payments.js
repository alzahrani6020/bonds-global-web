// ============================================
// Payments API router
// Merges: checkout, moyasar, billing
// Requires bodyParser: false for Stripe/Moyasar webhooks
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const getSupabase = require('../lib/api/supabase');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { processStripeWebhook } = require('../v3/api/billing');
const { createInvoice, getInvoice, getTierLabel } = require('../lib/api/moyasar-helper');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Stripe-Signature');
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) return resolve(req.body);
    if (typeof req.body === 'string') return resolve(Buffer.from(req.body, 'utf8'));
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  const raw = await getRawBody(req);
  if (!raw || raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch (err) {
    throw new Error('Invalid JSON body');
  }
}

// ── Stripe Checkout ────────────────────────────────────────
const CHECKOUT_PRODUCT_META = {
  ai_report: { name: 'AI Analysis Report', description: 'Full AI feasibility or credit assessment report' },
  expert_review: { name: 'Expert Advisor Review', description: 'One expert review of your AI analysis' },
  approved_report: { name: 'Certified Approved Report', description: 'Official stamped PDF report approved by a Bonds advisor' }
};

async function checkoutLoadPrices() {
  const supabase = getSupabase();
  const { data } = await supabase.from('site_settings').select('key, value');
  const settings = {};
  (data || []).forEach(s => settings[s.key] = s.value);
  return {
    ai_report: parseInt(settings.oneoff_ai_report_price_sar || '49', 10) * 100,
    expert_review: parseInt(settings.oneoff_expert_review_price_sar || '149', 10) * 100,
    approved_report: parseInt(settings.oneoff_approved_report_price_sar || '249', 10) * 100
  };
}

async function checkoutHandleCreate(req, res, user) {
  const userId = user.id;
  const userEmail = user.email;

  const { priceId, email, successUrl, cancelUrl, currency, vatPercent } = req.body || {};
  if (email && email !== userEmail) {
    return res.status(403).json({ error: 'email does not match authenticated user' });
  }

  if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
    return res.status(400).json({ error: 'Invalid or missing priceId' });
  }

  if (successUrl && !successUrl.startsWith(APP_URL)) {
    return res.status(400).json({ error: 'Invalid successUrl' });
  }
  if (cancelUrl && !cancelUrl.startsWith(APP_URL)) {
    return res.status(400).json({ error: 'Invalid cancelUrl' });
  }

  const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
  let customer = customers.data[0];
  if (!customer) {
    customer = await stripe.customers.create({
      email: userEmail,
      metadata: { supabaseUserId: userId }
    });
  }

  const subscriptionData = {
    metadata: { supabaseUserId: userId, currency: currency || 'SAR', vatPercent: vatPercent || 15 }
  };
  if (process.env.STRIPE_TAX_RATE_ID) {
    subscriptionData.default_tax_rates = [process.env.STRIPE_TAX_RATE_ID];
  }

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    subscription_data: subscriptionData,
    success_url: successUrl || `${APP_URL}/calculators/auth/?success=1`,
    cancel_url: cancelUrl || `${APP_URL}/pricing.html?canceled=1`,
    client_reference_id: userId,
  });

  return res.status(200).json({ sessionId: session.id, url: session.url });
}

async function checkoutHandleOneoff(req, res, user) {
  const { product } = req.body || {};
  if (!CHECKOUT_PRODUCT_META[product]) {
    return res.status(400).json({ error: 'Invalid product' });
  }

  const prices = await checkoutLoadPrices();
  const amount = prices[product];

  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  let customer = customers.data[0];
  if (!customer) {
    customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabaseUserId: user.id }
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'sar',
        product_data: { name: CHECKOUT_PRODUCT_META[product].name, description: CHECKOUT_PRODUCT_META[product].description },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    mode: 'payment',
    tax_id_collection: { enabled: true },
    metadata: { supabaseUserId: user.id, product, type: 'oneoff' },
    success_url: `${APP_URL}/calculators/auth/subscription.html?oneoff=success&product=${product}`,
    cancel_url: `${APP_URL}/pricing.html?canceled=1`,
    client_reference_id: user.id,
  });

  const supabase = getSupabase();
  await supabase.from('oneoff_purchases').insert({
    user_id: user.id,
    product,
    quantity: 1,
    amount: amount / 100,
    currency: 'SAR',
    status: 'pending',
    stripe_session_id: session.id,
    metadata: { product_name: CHECKOUT_PRODUCT_META[product].name }
  });

  return res.status(200).json({ sessionId: session.id, url: session.url });
}

async function checkoutHandler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const action = req.query?.action || req.body?.action || 'create';

  try {
    if (action === 'create') return await checkoutHandleCreate(req, res, user);
    if (action === 'oneoff') return await checkoutHandleOneoff(req, res, user);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Checkout API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Billing (Stripe subscriptions + webhooks) ──────────────
async function billingHandleCancel(sb, userId) {
  const { data: sub } = await sb.from('subscriptions').select('stripe_subscription_id').eq('user_id', userId).single();
  if (sub?.stripe_subscription_id) {
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  }
  await sb.from('subscriptions').update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq('user_id', userId);
  return { success: true };
}

async function billingHandlePortal(sb, userId) {
  const { data: profile } = await sb.from('profiles').select('stripe_customer_id, email').eq('id', userId).single();
  if (!profile?.stripe_customer_id) throw new Error('No Stripe customer found');
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${APP_URL}/calculators/auth/subscription.html`,
  });
  return { url: session.url };
}

async function billingHandleLegacyWebhook(req, res) {
  const supabase = getSupabase();
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    console.error('Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return res.status(400).json({ error: 'Missing webhook configuration' });
  }

  const rawBody = await getRawBody(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    await supabase.from('webhook_events').upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
      processed: false,
    }, { onConflict: 'stripe_event_id' });
  } catch (logErr) {
    console.error('Failed to log webhook event:', logErr);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.supabaseUserId;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;
        if (!userId) break;

        await supabase.from('profiles').update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          status: 'trialing',
          stripe_subscription_id: stripeSubscriptionId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const stripeSubscriptionId = invoice.subscription;
        if (!stripeSubscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;
        const tier = billingGetTierFromPriceId(priceId);

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          tier: tier,
          status: 'active',
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: priceId,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        await supabase.from('profiles').update({
          tier: tier,
          status: 'active',
          stripe_subscription_id: stripeSubscriptionId,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeSubscriptionId = invoice.subscription;
        if (!stripeSubscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;

        await supabase.from('subscriptions').update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', stripeSubscriptionId);

        await supabase.from('profiles').update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;

        await supabase.from('subscriptions').update({
          status: 'cancelled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscription.id);

        await supabase.from('profiles').update({
          tier: 'free',
          status: 'inactive',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;
        const priceId = subscription.items.data[0]?.price?.id;
        const tier = billingGetTierFromPriceId(priceId);

        await supabase.from('subscriptions').update({
          tier: tier,
          status: subscription.status === 'active' ? 'active' : subscription.status,
          stripe_price_id: priceId,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscription.id);

        await supabase.from('profiles').update({
          tier: tier,
          status: subscription.status === 'active' ? 'active' : subscription.status,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await supabase.from('webhook_events').update({ processed: true }).eq('stripe_event_id', event.id);
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  return res.status(200).json({ received: true });
}

async function billingHandleV3Webhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);
  try {
    const result = await processStripeWebhook(rawBody, sig);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[v3-stripe-webhook]', err.message);
    const isSignatureError = err.type === 'StripeSignatureVerificationError' ||
      (err.message && /signature|Missing signature|webhook secret/i.test(err.message));
    return res.status(isSignatureError ? 400 : 500).json({
      error: isSignatureError ? 'Invalid webhook signature' : 'Webhook processing failed'
    });
  }
}

async function billingHandler(req, res) {
  setCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action;

  if (action === 'stripe-webhook') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return billingHandleLegacyWebhook(req, res);
  }

  if (action === 'v3-stripe-webhook') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return billingHandleV3Webhook(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  req.body = body;

  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const userId = user.id;
  const sb = getSupabase();
  const resolvedAction = action || body?.action;

  try {
    if (resolvedAction === 'cancel') {
      return res.status(200).json(await billingHandleCancel(sb, userId));
    }
    if (resolvedAction === 'portal') {
      return res.status(200).json(await billingHandlePortal(sb, userId));
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Billing API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function billingGetTierFromPriceId(priceId) {
  const PRO_PRICE = process.env.STRIPE_PRICE_PRO;
  const ENTERPRISE_PRICE = process.env.STRIPE_PRICE_ENTERPRISE;
  if (priceId === ENTERPRISE_PRICE) return 'enterprise';
  if (priceId === PRO_PRICE) return 'pro';
  return 'free';
}

// ── Moyasar ────────────────────────────────────────────────
async function moyasarGetJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await getRawBody(req);
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return {};
  }
}

async function moyasarActivateSubscription(supabase, userId, tier) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase.from('subscriptions').upsert({
    user_id: userId,
    tier,
    status: 'active',
    payment_method: 'moyasar',
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' });

  await supabase.from('profiles').update({
    tier,
    status: 'active',
    updated_at: now.toISOString(),
  }).eq('id', userId);
}

async function moyasarCheckoutAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const body = await moyasarGetJsonBody(req);
  const { tier, successUrl, cancelUrl } = body || {};
  if (!['pro', 'enterprise'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const safeSuccess = successUrl && successUrl.startsWith(APP_URL) ? successUrl : `${APP_URL}/calculators/auth/subscription.html?moyasar=success`;
  const safeCancel = cancelUrl && cancelUrl.startsWith(APP_URL) ? cancelUrl : `${APP_URL}/pricing.html?canceled=1`;

  try {
    const supabase = getSupabase();
    const { data: settingsRows } = await supabase.from('site_settings').select('key, value');
    const settings = {};
    (settingsRows || []).forEach(s => settings[s.key] = s.value);
    const pricePro = parseInt(settings.moyasar_pro_price_sar || settings.price_pro_sar || '82', 10);
    const priceEnt = parseInt(settings.moyasar_enterprise_price_sar || settings.price_enterprise_sar || '212', 10);
    const amount = (tier === 'enterprise' ? priceEnt : pricePro) * 100;
    const invoice = await createInvoice({
      amount,
      currency: 'SAR',
      description: `${getTierLabel(tier)} — Monthly subscription`,
      callbackUrl: `${APP_URL}/api/moyasar-webhook`,
      metadata: { user_id: user.id, tier, email: user.email },
      successUrl: safeSuccess,
      backUrl: safeCancel,
    });

    const { error: dbError } = await supabase.from('moyasar_invoices').insert({
      invoice_id: invoice.id,
      user_id: user.id,
      tier,
      amount,
      currency: 'SAR',
      status: invoice.status || 'initiated',
      url: invoice.url,
      metadata: invoice.metadata || { user_id: user.id, tier },
    });

    if (dbError) {
      console.error('Failed to store moyasar invoice:', dbError);
    }

    res.status(200).json({ invoiceId: invoice.id, url: invoice.url });
  } catch (err) {
    console.error('Moyasar checkout error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create invoice' });
  }
}

async function moyasarVerifyAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const body = await moyasarGetJsonBody(req);
  const { invoiceId } = body || {};
  if (!invoiceId) return res.status(400).json({ error: 'Missing invoiceId' });

  try {
    const supabase = getSupabase();
    const { data: localInvoice, error: localError } = await supabase
      .from('moyasar_invoices')
      .select('id, user_id, tier')
      .eq('invoice_id', invoiceId)
      .maybeSingle();

    if (localError) throw localError;
    if (!localInvoice || localInvoice.user_id !== user.id) {
      return res.status(403).json({ error: 'Invoice not found' });
    }

    const invoice = await getInvoice(invoiceId);

    await supabase.from('moyasar_invoices').update({
      status: invoice.status,
      paid_at: invoice.paid_at ? new Date(invoice.paid_at).toISOString() : null,
      metadata: invoice.metadata,
      updated_at: new Date().toISOString(),
    }).eq('invoice_id', invoiceId);

    if (invoice.status === 'paid') {
      await moyasarActivateSubscription(supabase, user.id, localInvoice.tier);
    }

    res.status(200).json({ status: invoice.status, tier: localInvoice.tier });
  } catch (err) {
    console.error('Moyasar verify error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Verification failed' });
  }
}

async function moyasarWebhookAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookToken = process.env.MOYASAR_WEBHOOK_SECRET;
  const providedToken = req.headers['x-moyasar-webhook-secret'];
  if (!webhookToken || providedToken !== webhookToken) {
    console.error('Moyasar webhook unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let payload;
  try {
    const raw = await getRawBody(req);
    payload = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    console.error('Failed to parse Moyasar webhook payload:', err);
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const invoiceId = payload?.invoice_id || payload?.id;
  if (!invoiceId) {
    return res.status(400).json({ error: 'Missing invoice id' });
  }

  try {
    const invoice = await getInvoice(invoiceId);
    const metadata = invoice.metadata || {};
    const userId = metadata.user_id;
    const tier = metadata.tier;

    if (!userId || !tier) {
      console.error('Moyasar invoice missing metadata:', invoiceId);
      return res.status(400).json({ error: 'Missing metadata' });
    }

    const supabase = getSupabase();
    await supabase.from('moyasar_invoices').update({
      status: invoice.status,
      paid_at: invoice.paid_at ? new Date(invoice.paid_at).toISOString() : null,
      metadata: invoice.metadata,
      updated_at: new Date().toISOString(),
    }).eq('invoice_id', invoiceId);

    if (invoice.status === 'paid') {
      await moyasarActivateSubscription(supabase, userId, tier);
    }

    res.status(200).json({ received: true, status: invoice.status });
  } catch (err) {
    console.error('Moyasar webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function moyasarHandler(req, res) {
  const action = req.query?.action || req.body?.action;
  switch (action) {
    case 'checkout': return moyasarCheckoutAction(req, res);
    case 'verify': return moyasarVerifyAction(req, res);
    case 'webhook': return moyasarWebhookAction(req, res);
    default:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.status(200).end();
      return res.status(400).json({ error: 'Invalid or missing action' });
  }
}

// ── Main Router ────────────────────────────────────────────
async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // Stripe checkout
    if (pathname === '/api/checkout' || pathname === '/api/checkout/') {
      const body = await parseJsonBody(req);
      req.body = body;
      if (checkRateLimit('auth', req, res)) return;
      return checkoutHandler(req, res);
    }
    if (pathname === '/api/create-checkout' || pathname === '/api/create-checkout/') {
      const body = await parseJsonBody(req);
      req.body = body;
      req.query = req.query || {}; req.query.action = 'create';
      if (checkRateLimit('auth', req, res)) return;
      return checkoutHandler(req, res);
    }
    if (pathname === '/api/create-oneoff-checkout' || pathname === '/api/create-oneoff-checkout/') {
      const body = await parseJsonBody(req);
      req.body = body;
      req.query = req.query || {}; req.query.action = 'oneoff';
      if (checkRateLimit('auth', req, res)) return;
      return checkoutHandler(req, res);
    }

    // Billing
    if (pathname === '/api/billing' || pathname === '/api/billing/') {
      const action = req.query?.action || req.body?.action;
      const category = (action === 'stripe-webhook' || action === 'v3-stripe-webhook') ? 'webhook' : 'auth';
      if (checkRateLimit(category, req, res)) return;
      return billingHandler(req, res);
    }
    if (pathname === '/api/webhook' || pathname === '/api/webhook/') {
      req.query = req.query || {}; req.query.action = 'stripe-webhook';
      if (checkRateLimit('webhook', req, res)) return;
      return billingHandler(req, res);
    }
    if (pathname === '/api/v3/billing/webhook' || pathname === '/api/v3/billing/webhook/') {
      req.query = req.query || {}; req.query.action = 'v3-stripe-webhook';
      if (checkRateLimit('webhook', req, res)) return;
      return billingHandler(req, res);
    }

    // Moyasar
    if (pathname === '/api/moyasar-checkout' || pathname === '/api/moyasar-checkout/') {
      req.query = req.query || {}; req.query.action = 'checkout';
      if (checkRateLimit('auth', req, res)) return;
      return moyasarHandler(req, res);
    }
    if (pathname === '/api/moyasar-verify' || pathname === '/api/moyasar-verify/') {
      req.query = req.query || {}; req.query.action = 'verify';
      if (checkRateLimit('auth', req, res)) return;
      return moyasarHandler(req, res);
    }
    if (pathname === '/api/moyasar-webhook' || pathname === '/api/moyasar-webhook/') {
      req.query = req.query || {}; req.query.action = 'webhook';
      if (checkRateLimit('webhook', req, res)) return;
      return moyasarHandler(req, res);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('[payments] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
