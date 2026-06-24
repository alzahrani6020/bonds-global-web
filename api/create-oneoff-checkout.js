// ============================================
// One-Off Purchase Checkout (Pay-Per-Report)
// POST /api/create-oneoff-checkout
// Body: { product } where product is ai_report | expert_review | approved_report
// Authorization: Bearer <supabase-jwt>
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { withRateLimit } = require('../lib/api/rate-limit');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const getSupabase = require('../lib/api/supabase');

const PRODUCT_META = {
  ai_report: { name: 'AI Analysis Report', description: 'Full AI feasibility or credit assessment report' },
  expert_review: { name: 'Expert Advisor Review', description: 'One expert review of your AI analysis' },
  approved_report: { name: 'Certified Approved Report', description: 'Official stamped PDF report approved by a Bonds advisor' }
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';

async function loadPrices() {
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

async function handler(req, res) {
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

  const { product } = req.body || {};
  if (!PRODUCT_META[product]) {
    return res.status(400).json({ error: 'Invalid product' });
  }

  try {
    const prices = await loadPrices();
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
          product_data: { name: PRODUCT_META[product].name, description: PRODUCT_META[product].description },
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

    const supabase = require('../lib/api/supabase')();
    await supabase.from('oneoff_purchases').insert({
      user_id: user.id,
      product,
      quantity: 1,
      amount: amount / 100,
      currency: 'SAR',
      status: 'pending',
      stripe_session_id: session.id,
      metadata: { product_name: PRODUCT_META[product].name }
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Oneoff checkout error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = withRateLimit('auth', handler);
