// ============================================
// Moyasar Invoice Creator
// POST /api/moyasar-checkout
// Body: { tier, successUrl, cancelUrl }
// Authorization: Bearer <supabase-jwt>
// ============================================

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { createInvoice, getTierLabel } = require('../lib/api/moyasar-helper');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';

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

  const { tier, successUrl, cancelUrl } = req.body || {};
  if (!['pro', 'enterprise'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  // Prevent open redirects
  const safeSuccess = successUrl && successUrl.startsWith(APP_URL) ? successUrl : `${APP_URL}/calculators/auth/subscription.html?moyasar=success`;
  const safeCancel = cancelUrl && cancelUrl.startsWith(APP_URL) ? cancelUrl : `${APP_URL}/pricing.html?canceled=1`;

  try {
    const supabase = getSupabase();
    const { data: settingsRows } = await supabase.from('site_settings').select('key, value');
    const settings = {};
    (settingsRows || []).forEach(s => settings[s.key] = s.value);
    const pricePro = parseInt(settings.moyasar_pro_price_sar || settings.price_pro_sar || '82', 10);
    const priceEnt = parseInt(settings.moyasar_enterprise_price_sar || settings.price_enterprise_sar || '212', 10);
    const amount = (tier === 'enterprise' ? priceEnt : pricePro) * 100; // halalas
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
      // Non-fatal: invoice exists in Moyasar
    }

    res.status(200).json({ invoiceId: invoice.id, url: invoice.url });
  } catch (err) {
    console.error('Moyasar checkout error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to create invoice' });
  }
}

module.exports = withRateLimit('auth', handler);
