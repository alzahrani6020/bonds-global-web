// ============================================
// Stripe Checkout Session Creator
// POST /api/create-checkout
// Body: { priceId, userId, email, successUrl, cancelUrl, currency, vatPercent }
// Authorization: Bearer <supabase-jwt>
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { withRateLimit } = require('../lib/api/rate-limit');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');

async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Authenticate and authorize the requested userId
  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
    return;
  }

  const userId = user.id;
  const userEmail = user.email;

  // Reject mismatched identity claims from the body
  const { priceId, email, successUrl, cancelUrl, currency, vatPercent } = req.body || {};
  if (email && email !== userEmail) {
    res.status(403).json({ error: 'email does not match authenticated user' });
    return;
  }

  if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
    res.status(400).json({ error: 'Invalid or missing priceId' });
    return;
  }

  // Prevent open redirects
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';
  if (successUrl && !successUrl.startsWith(APP_URL)) {
    res.status(400).json({ error: 'Invalid successUrl' });
    return;
  }
  if (cancelUrl && !cancelUrl.startsWith(APP_URL)) {
    res.status(400).json({ error: 'Invalid cancelUrl' });
    return;
  }

  try {
    // Create or retrieve Stripe Customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabaseUserId: userId }
      });
    }

    // Build subscription_data with metadata and optional tax rate
    const subscriptionData = {
      metadata: { supabaseUserId: userId, currency: currency || 'SAR', vatPercent: vatPercent || 15 }
    };
    if (process.env.STRIPE_TAX_RATE_ID) {
      subscriptionData.default_tax_rates = [process.env.STRIPE_TAX_RATE_ID];
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      subscription_data: subscriptionData,
      success_url: successUrl || `${APP_URL}/calculators/auth/?success=1`,
      cancel_url: cancelUrl || `${APP_URL}/pricing.html?canceled=1`,
      client_reference_id: userId,
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = withRateLimit('auth', handler);
