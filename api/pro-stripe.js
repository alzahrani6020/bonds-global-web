const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = req.body || {};
    const { plan = 'single', email } = body;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';
    const priceId = plan === 'monthly' ? process.env.STRIPE_PRICE_ENTERPRISE : process.env.STRIPE_PRICE_PRO;

    if (!priceId) {
      // Fallback: use price_data if no env price ID
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'sar',
            product_data: { name: plan === 'monthly' ? 'Bonds Pro Monthly' : 'Bonds Pro Report' },
            unit_amount: plan === 'monthly' ? 19900 : 4900
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `${appUrl}/pro/report.html?paid=1`,
        cancel_url: `${appUrl}/pro/index.html`,
        customer_email: email || undefined
      });
      return res.status(200).json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${appUrl}/pro/report.html?paid=1`,
      cancel_url: `${appUrl}/pro/index.html`,
      customer_email: email || undefined
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[pro-stripe] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
