/**
 * Unified Billing API
 * POST /api/billing?action=cancel|portal
 * Authorization: Bearer <supabase-jwt>
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');

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

  const userId = user.id;
  const sb = getSupabase();
  const action = req.query?.action || req.body?.action;

  try {
    if (action === 'cancel') {
      const { data: sub } = await sb.from('subscriptions').select('stripe_subscription_id').eq('user_id', userId).single();
      if (sub?.stripe_subscription_id) {
        await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
      }
      await sb.from('subscriptions').update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq('user_id', userId);
      return res.status(200).json({ success: true });
    }

    if (action === 'portal') {
      const { data: profile } = await sb.from('profiles').select('stripe_customer_id, email').eq('id', userId).single();
      if (!profile?.stripe_customer_id) return res.status(404).json({ error: 'No Stripe customer found' });
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com'}/calculators/auth/subscription.html`,
      });
      return res.status(200).json({ url: session.url });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Billing API error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = withRateLimit('auth', handler);
