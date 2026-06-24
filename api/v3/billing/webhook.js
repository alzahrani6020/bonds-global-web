/**
 * Stripe webhook handler for V3 billing.
 * Runs with bodyParser disabled so the raw payload can be verified.
 */
const { processStripeWebhook } = require('../../../v3/api/billing');

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

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    const result = await processStripeWebhook(rawBody, sig);
    res.status(200).json(result);
  } catch (err) {
    console.error('[v3/billing/webhook]', err.message);
    const isSignatureError = err.type === 'StripeSignatureVerificationError' ||
      (err.message && /signature|Missing signature|webhook secret/i.test(err.message));
    res.status(isSignatureError ? 400 : 500).json({
      error: isSignatureError ? 'Invalid webhook signature' : 'Webhook processing failed'
    });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
