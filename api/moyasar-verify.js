// ============================================
// Moyasar Invoice Verifier
// POST /api/moyasar-verify
// Body: { invoiceId }
// Authorization: Bearer <supabase-jwt>
// ============================================

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { getInvoice } = require('../lib/api/moyasar-helper');

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

  const { invoiceId } = req.body || {};
  if (!invoiceId) return res.status(400).json({ error: 'Missing invoiceId' });

  try {
    const supabase = getSupabase();

    // Ensure the invoice belongs to the user
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
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        tier: localInvoice.tier,
        status: 'active',
        payment_method: 'moyasar',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });

      await supabase.from('profiles').update({
        tier: localInvoice.tier,
        status: 'active',
        updated_at: now.toISOString(),
      }).eq('id', user.id);
    }

    res.status(200).json({ status: invoice.status, tier: localInvoice.tier });
  } catch (err) {
    console.error('Moyasar verify error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Verification failed' });
  }
}

module.exports = withRateLimit('auth', handler);
