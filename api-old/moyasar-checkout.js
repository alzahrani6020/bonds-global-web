// ============================================
// Moyasar Invoice Creator (SADAD / Bank Transfer)
// POST /api/moyasar-checkout
// Body: { tier, userId, email, successUrl, cancelUrl }
// ============================================

const getSupabase = require('./lib/supabase');

const MOYASAR_API = 'https://api.moyasar.com/v1/invoices';

module.exports = async function handler(req, res) {
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

  const { tier, userId, email, successUrl, cancelUrl } = req.body || {};

  if (!tier || !['pro', 'enterprise'].includes(tier)) {
    res.status(400).json({ error: 'Invalid tier. Use pro or enterprise' });
    return;
  }
  if (!userId || typeof userId !== 'string' || userId.length < 10) {
    res.status(400).json({ error: 'Invalid userId' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Invalid email' });
    return;
  }

  const secretKey = process.env.MOYASAR_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'Moyasar not configured' });
    return;
  }

  // Prices in halalah (SAR * 100) — inclusive of VAT
  const PRICES = {
    pro: 8200,        // SAR 82.00
    enterprise: 21200 // SAR 212.00
  };

  const NAMES = {
    pro: 'Bonds Pro - Monthly (incl. VAT 15%)',
    enterprise: 'Bonds Enterprise - Monthly (incl. VAT 15%)'
  };

  try {
    // Create invoice via Moyasar
    const auth = Buffer.from(secretKey + ':').toString('base64');
    const response = await fetch(MOYASAR_API, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: PRICES[tier],
        currency: 'SAR',
        description: NAMES[tier],
        callback_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/calculators/auth/subscription.html?moyasar=success`,
        metadata: {
          tier: tier,
          userId: userId,
          email: email,
          cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing.html?canceled=1`
        }
      })
    });

    const invoice = await response.json();

    if (!response.ok) {
      console.error('Moyasar error:', invoice);
      res.status(500).json({ error: invoice.message || 'Moyasar invoice creation failed' });
      return;
    }

    // Store pending invoice in Supabase for tracking
    const supabase = getSupabase();
    await supabase.from('moyasar_invoices').insert([{
      invoice_id: invoice.id,
      user_id: userId,
      tier: tier,
      amount: PRICES[tier],
      status: invoice.status,
      url: invoice.url,
      metadata: invoice.metadata || {}
    }]);

    res.status(200).json({
      invoiceId: invoice.id,
      url: invoice.url,
      status: invoice.status
    });

  } catch (err) {
    console.error('Moyasar checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
