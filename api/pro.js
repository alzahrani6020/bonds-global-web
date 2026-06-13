const getSupabase = require('../lib/api/supabase');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { calculateProject, aiInsight, buildHTMLReport } = require('../pro/pro-engine');

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase auth environment variables missing');
  return createClient(url, key);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handleCalculate(req, res) {
  const body = req.body || {};
  const { sector, activity, capital, revenue } = body;
  if (!sector || !activity || !capital || !revenue) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const result = calculateProject({ sector, activity, capital: parseFloat(capital), revenue: parseFloat(revenue) });
  const ai = aiInsight(result);
  res.status(200).json({ result, ai });
}

async function handleReport(req, res) {
  const params = req.method === 'GET' ? req.query : req.body || {};
  const { sector, activity, capital, revenue, format = 'json' } = params;
  if (!sector || !activity || !capital || !revenue) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const result = calculateProject({ sector, activity, capital: parseFloat(capital), revenue: parseFloat(revenue) });
  const insight = aiInsight(result);
  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildHTMLReport(result, insight));
  }
  res.status(200).json({ result, insight });
}

async function handleStripe(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = req.body || {};
  const { plan = 'single', email } = body;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';
  const priceId = plan === 'monthly' ? process.env.STRIPE_PRICE_ENTERPRISE : process.env.STRIPE_PRICE_PRO;

  const sessionConfig = {
    payment_method_types: ['card'],
    mode: 'payment',
    success_url: `${appUrl}/pro/report.html?paid=1`,
    cancel_url: `${appUrl}/pro/index.html`,
    customer_email: email || undefined
  };

  if (priceId) {
    sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
  } else {
    sessionConfig.line_items = [{
      price_data: {
        currency: 'sar',
        product_data: { name: plan === 'monthly' ? 'Bonds Pro Monthly' : 'Bonds Pro Report' },
        unit_amount: plan === 'monthly' ? 19900 : 4900
      },
      quantity: 1
    }];
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  res.status(200).json({ url: session.url });
}

async function handleAuth(req, res) {
  const { action, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  if (action === 'signup') {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    return res.status(200).json({ success: true, user: { id: data.user.id, email: data.user.email } });
  }

  const authClient = getAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.status(200).json({ success: true, token: data.session.access_token, refresh_token: data.session.refresh_token, user: data.user });
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Determine action from pathname or query
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  let action = url.searchParams.get('action') || url.pathname.replace(/^\/api\/pro\/?/, '').replace(/\/$/, '');
  if (!action && req.body && req.body.action) action = req.body.action;

  try {
    switch (action) {
      case 'calculate': return await handleCalculate(req, res);
      case 'report': return await handleReport(req, res);
      case 'stripe': return await handleStripe(req, res);
      case 'auth': return await handleAuth(req, res);
      default: return res.status(404).json({ error: 'Unknown pro action' });
    }
  } catch (err) {
    console.error(`[pro/${action}] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
};
