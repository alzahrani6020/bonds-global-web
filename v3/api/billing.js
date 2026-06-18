/**
 * Bonds V3 — Billing & Subscriptions (Stripe)
 */

const { getSupabaseClient } = require('../lib/supabase');
const { getUserFromToken } = require('../lib/auth');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe not configured');
  if (!getStripe.instance) getStripe.instance = require('stripe')(key);
  return getStripe.instance;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function priceIdToTier(priceId) {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  return 'free';
}

function getBaseUrl(req) {
  const host = req.headers.host || 'bonds-v3.vercel.app';
  return `https://${host}`;
}

async function handlePlans(req, res) {
  sendJson(res, 200, {
    currency: 'SAR',
    plans: [
      {
        id: 'pro',
        name_ar: 'بوندز برو',
        name_en: 'Bonds Pro',
        price_id: process.env.STRIPE_PRICE_PRO,
        price_monthly_sar: 82,
        features: ['سيناريوهات غير محدودة', '22 دولة', 'تصدير PDF']
      },
      {
        id: 'enterprise',
        name_ar: 'بوندز إنتربرايز',
        name_en: 'Bonds Enterprise',
        price_id: process.env.STRIPE_PRICE_ENTERPRISE,
        price_monthly_sar: 212,
        features: ['كل مميزات Pro', 'Webhooks', 'دعم أولوي']
      }
    ]
  });
}

async function handleCheckout(req, res) {
  const body = await parseBody(req);
  const { priceId, email } = body;

  if (!priceId || !email) {
    return sendJson(res, 400, { error: 'priceId and email are required' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(res, 500, { error: 'Stripe is not configured' });
  }

  const baseUrl = getBaseUrl(req);

  try {
    // Find or create customer
    const customers = await getStripe().customers.list({ email, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await getStripe().customers.create({ email });
    }

    const lineItem = { price: priceId, quantity: 1 };
    if (process.env.STRIPE_TAX_RATE_ID) {
      lineItem.tax_rates = [process.env.STRIPE_TAX_RATE_ID];
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${baseUrl}/admin?subscription=success`,
      cancel_url: `${baseUrl}/admin?subscription=canceled`,
      metadata: { price_id: priceId, tier: priceIdToTier(priceId) }
    });

    sendJson(res, 200, { url: session.url });
  } catch (err) {
    console.error('[billing/checkout]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function upsertSubscription(supabase, subscription) {
  const stripeSubscriptionId = subscription.id;
  const customerId = subscription.customer;
  const status = subscription.status;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const tier = priceIdToTier(priceId);
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Find user by stripe_customer_id in subscriptions, or create mapping via checkout metadata
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id,user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  const { data: customer } = await getStripe().customers.retrieve(customerId);
  const userEmail = customer?.email;

  let userId = existing?.user_id;

  if (!userId && userEmail) {
    // Find Supabase user by email
    const { data: users, error } = await supabase.auth.admin.listUsers();
    const matchingUser = users?.users?.find(u => u.email === userEmail);
    if (matchingUser) userId = matchingUser.id;
  }

  if (!userId) {
    console.warn('[billing/webhook] No user found for customer', customerId);
    return;
  }

  const payload = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubscriptionId,
    status,
    tier,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    await supabase.from('subscriptions').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('subscriptions').insert(payload);
  }
}

async function handleWebhook(req, res) {
  const payload = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return sendJson(res, 400, { error: 'Missing signature or webhook secret' });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[billing/webhook]', err.message);
    return sendJson(res, 400, { error: 'Invalid signature' });
  }

  const supabase = getSupabaseClient();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.subscription) {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription);
        await upsertSubscription(supabase, subscription);
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await upsertSubscription(supabase, subscription);
    }

    sendJson(res, 200, { received: true });
  } catch (err) {
    console.error('[billing/webhook]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

async function handleSubscription(req, res) {
  const user = await getUserFromToken(req);
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[billing/subscription]', error.message);
    return sendJson(res, 500, { error: error.message });
  }

  sendJson(res, 200, {
    subscription: data || { tier: 'free', status: 'active' }
  });
}

async function billingRouter(req, res, path) {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[1];

  try {
    if (resource === 'plans' && req.method === 'GET') return await handlePlans(req, res);
    if (resource === 'checkout' && req.method === 'POST') return await handleCheckout(req, res);
    if (resource === 'webhook' && req.method === 'POST') return await handleWebhook(req, res);
    if (resource === 'subscription' && req.method === 'GET') return await handleSubscription(req, res);

    return sendJson(res, 404, { error: 'Billing endpoint not found' });
  } catch (err) {
    console.error('[billing]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

module.exports = { billingRouter };
