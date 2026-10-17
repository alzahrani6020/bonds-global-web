const { Resend } = require('resend');
const getSupabase = require('../lib/api/supabase');

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[email-webhook] RESEND_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ error: 'Webhook verification is not configured' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const resend = new Resend(process.env.RESEND_API_KEY || 're_webhook_verification_only');
    event = await resend.webhooks.verify({
      payload: rawBody.toString('utf8'),
      headers: {
        id: req.headers['svix-id'],
        timestamp: req.headers['svix-timestamp'],
        signature: req.headers['svix-signature']
      },
      webhookSecret
    });
  } catch (err) {
    console.warn('[email-webhook] signature verification failed');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    const type = String(event?.type || '');
    const recipient = Array.isArray(event?.data?.to)
      ? event.data.to[0]
      : (event?.data?.to || event?.data?.email || null);

    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(recipient))) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const email = String(recipient).toLowerCase().trim();
    const now = new Date().toISOString();
    const supabase = getSupabase();

    if (type === 'email.bounced' || type === 'email.delivery_failed' || type === 'email.failed') {
      const { error } = await supabase
        .from('calculator_leads')
        .update({ bounced_at: now })
        .eq('email', email);
      if (error) throw error;
    } else if (type === 'email.complained' || type === 'email.complaint') {
      const { error } = await supabase
        .from('calculator_leads')
        .update({ complained_at: now })
        .eq('email', email);
      if (error) throw error;
    } else {
      return res.status(200).json({ success: true, ignored: true, type });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[email-webhook] processing error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
