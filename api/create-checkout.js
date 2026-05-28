// ============================================
// Stripe Checkout Session Creator
// POST /api/create-checkout
// Body: { priceId, userId, email, successUrl, cancelUrl }
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
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

  // Input validation
  const { priceId, userId, email, successUrl, cancelUrl } = req.body || {};

  if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
    res.status(400).json({ error: 'Invalid or missing priceId' });
    return;
  }
  if (!userId || typeof userId !== 'string' || userId.length < 10) {
    res.status(400).json({ error: 'Invalid or missing userId' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid or missing email' });
    return;
  }

  try {
    // Create or retrieve Stripe Customer
    const customers = await stripe.customers.list({ email: email, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        email: email,
        metadata: { supabaseUserId: userId }
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      subscription_data: {
        metadata: { supabaseUserId: userId }
      },
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/calculators/auth/?success=1`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing.html?canceled=1`,
      client_reference_id: userId,
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
