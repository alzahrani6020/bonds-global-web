// ============================================
// Health Check Endpoint
// GET /api/health
// Returns status of Supabase, Stripe, and app version
// ============================================

const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let supabaseStatus = 'unknown';
  let stripeStatus = 'unknown';

  // Check Supabase
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true });
      supabaseStatus = error ? 'degraded: ' + error.message : 'connected';
    } catch (e) {
      supabaseStatus = 'error: ' + e.message;
    }
  } else {
    supabaseStatus = 'missing_env';
  }

  // Check Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      await stripe.customers.list({ limit: 1 });
      stripeStatus = 'connected';
    } catch (e) {
      stripeStatus = 'error: ' + e.message;
    }
  } else {
    stripeStatus = 'missing_env';
  }

  const allHealthy = supabaseStatus === 'connected' && stripeStatus === 'connected';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      supabase: supabaseStatus,
      stripe: stripeStatus,
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    uptime: process.uptime(),
  });
};
