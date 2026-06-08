// ============================================
// Moyasar Invoice Verification
// GET /api/moyasar-verify?invoiceId=xxx
// Checks invoice status and activates subscription if paid
// ============================================

const getSupabase = require('./lib/supabase');

const MOYASAR_API = 'https://api.moyasar.com/v1/invoices';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { invoiceId } = req.query || {};
  if (!invoiceId) {
    res.status(400).json({ error: 'Missing invoiceId' });
    return;
  }

  const secretKey = process.env.MOYASAR_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'Moyasar not configured' });
    return;
  }

  try {
    const auth = Buffer.from(secretKey + ':').toString('base64');
    const response = await fetch(`${MOYASAR_API}/${invoiceId}`, {
      headers: { 'Authorization': 'Basic ' + auth }
    });

    const invoice = await response.json();
    if (!response.ok) {
      res.status(500).json({ error: invoice.message || 'Verification failed' });
      return;
    }

    const supabase = getSupabase();

    // Update invoice status in DB
    await supabase.from('moyasar_invoices').update({
      status: invoice.status,
      paid_at: invoice.status === 'paid' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }).eq('invoice_id', invoiceId);

    // If paid, activate subscription
    if (invoice.status === 'paid') {
      const { data: inv } = await supabase
        .from('moyasar_invoices')
        .select('user_id, tier')
        .eq('invoice_id', invoiceId)
        .single();

      if (inv?.user_id) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await supabase.from('subscriptions').upsert({
          user_id: inv.user_id,
          tier: inv.tier,
          status: 'active',
          payment_method: 'moyasar',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        await supabase.from('profiles').update({
          tier: inv.tier,
          status: 'active',
          updated_at: new Date().toISOString()
        }).eq('id', inv.user_id);
      }
    }

    res.status(200).json({
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      paidAt: invoice.paid_at,
      isPaid: invoice.status === 'paid'
    });

  } catch (err) {
    console.error('Moyasar verify error:', err);
    res.status(500).json({ error: err.message });
  }
};
