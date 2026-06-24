// ============================================
// Moyasar Webhook Handler
// POST /api/moyasar-webhook
// Receives Moyasar payment events and activates subscriptions
// ============================================

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');
const { getInvoice } = require('../lib/api/moyasar-helper');

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

async function handler(req, res) {
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

  const invoiceId = payload?.id;
  if (!invoiceId) {
    return res.status(400).json({ error: 'Missing invoice id' });
  }

  try {
    // Verify invoice state with Moyasar API
    const invoice = await getInvoice(invoiceId);
    const metadata = invoice.metadata || {};
    const userId = metadata.user_id;
    const tier = metadata.tier;

    if (!userId || !tier) {
      console.error('Moyasar invoice missing metadata:', invoiceId);
      return res.status(400).json({ error: 'Missing metadata' });
    }

    const supabase = getSupabase();

    // Update invoice record
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

const wrapped = withRateLimit('webhook', handler);
wrapped.config = { api: { bodyParser: false } };
module.exports = wrapped;
