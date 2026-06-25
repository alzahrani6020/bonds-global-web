// ============================================
// Moyasar API dispatcher
// Routes by ?action=checkout|verify|webhook
// ============================================

const getSupabase = require('../lib/api/supabase');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { createInvoice, getInvoice, getTierLabel } = require('../lib/api/moyasar-helper');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';

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

async function getJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await getRawBody(req);
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return {};
  }
}

async function activateSubscription(supabase, userId, tier) {
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

async function checkoutAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit('auth', req, res)) return;

  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const body = await getJsonBody(req);
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

async function verifyAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit('auth', req, res)) return;

  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const body = await getJsonBody(req);
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
      await activateSubscription(supabase, user.id, localInvoice.tier);
    }

    res.status(200).json({ status: invoice.status, tier: localInvoice.tier });
  } catch (err) {
    console.error('Moyasar verify error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Verification failed' });
  }
}

async function webhookAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit('webhook', req, res)) return;

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
      await activateSubscription(supabase, userId, tier);
    }

    res.status(200).json({ received: true, status: invoice.status });
  } catch (err) {
    console.error('Moyasar webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handler(req, res) {
  const action = req.query?.action || req.body?.action;
  switch (action) {
    case 'checkout': return checkoutAction(req, res);
    case 'verify': return verifyAction(req, res);
    case 'webhook': return webhookAction(req, res);
    default:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.status(200).end();
      return res.status(400).json({ error: 'Invalid or missing action' });
  }
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
