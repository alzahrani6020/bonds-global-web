/**
 * Unified Billing API
 * POST /api/billing?action=cancel|portal|stripe-webhook|v3-stripe-webhook
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');
const { verifyBearerAndUser } = require('../lib/api/auth-helper');
const { processStripeWebhook } = require('../v3/api/billing');

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

async function parseJsonBody(req) {
  const raw = await getRawBody(req);
  if (!raw || raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch (err) {
    throw new Error('Invalid JSON body');
  }
}

async function handleCancel(sb, userId) {
  const { data: sub } = await sb.from('subscriptions').select('stripe_subscription_id').eq('user_id', userId).single();
  if (sub?.stripe_subscription_id) {
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  }
  await sb.from('subscriptions').update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq('user_id', userId);
  return { success: true };
}

async function handlePortal(sb, userId) {
  const { data: profile } = await sb.from('profiles').select('stripe_customer_id, email').eq('id', userId).single();
  if (!profile?.stripe_customer_id) throw new Error('No Stripe customer found');
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com'}/calculators/auth/subscription.html`,
  });
  return { url: session.url };
}

async function handleLegacyWebhook(req, res) {
  const supabase = getSupabase();
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    console.error('Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return res.status(400).json({ error: 'Missing webhook configuration' });
  }

  const rawBody = await getRawBody(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    await supabase.from('webhook_events').upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
      processed: false,
    }, { onConflict: 'stripe_event_id' });
  } catch (logErr) {
    console.error('Failed to log webhook event:', logErr);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.supabaseUserId;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;
        if (!userId) break;

        await supabase.from('profiles').update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          status: 'trialing',
          stripe_subscription_id: stripeSubscriptionId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const stripeSubscriptionId = invoice.subscription;
        if (!stripeSubscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;
        const tier = getTierFromPriceId(priceId);

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          tier: tier,
          status: 'active',
          stripe_subscription_id: stripeSubscriptionId,
          stripe_price_id: priceId,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        await supabase.from('profiles').update({
          tier: tier,
          status: 'active',
          stripe_subscription_id: stripeSubscriptionId,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeSubscriptionId = invoice.subscription;
        if (!stripeSubscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;

        await supabase.from('subscriptions').update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', stripeSubscriptionId);

        await supabase.from('profiles').update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;

        await supabase.from('subscriptions').update({
          status: 'cancelled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscription.id);

        await supabase.from('profiles').update({
          tier: 'free',
          status: 'inactive',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabaseUserId;
        if (!userId) break;
        const priceId = subscription.items.data[0]?.price?.id;
        const tier = getTierFromPriceId(priceId);

        await supabase.from('subscriptions').update({
          tier: tier,
          status: subscription.status === 'active' ? 'active' : subscription.status,
          stripe_price_id: priceId,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscription.id);

        await supabase.from('profiles').update({
          tier: tier,
          status: subscription.status === 'active' ? 'active' : subscription.status,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await supabase.from('webhook_events').update({ processed: true }).eq('stripe_event_id', event.id);
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  return res.status(200).json({ received: true });
}

async function handleV3Webhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);
  try {
    const result = await processStripeWebhook(rawBody, sig);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[v3-stripe-webhook]', err.message);
    const isSignatureError = err.type === 'StripeSignatureVerificationError' ||
      (err.message && /signature|Missing signature|webhook secret/i.test(err.message));
    return res.status(isSignatureError ? 400 : 500).json({
      error: isSignatureError ? 'Invalid webhook signature' : 'Webhook processing failed'
    });
  }
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Stripe-Signature');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action;

  if (action === 'stripe-webhook') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleLegacyWebhook(req, res);
  }

  if (action === 'v3-stripe-webhook') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleV3Webhook(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  req.body = body;

  let user;
  try {
    user = await verifyBearerAndUser(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const userId = user.id;
  const sb = getSupabase();
  const resolvedAction = action || body?.action;

  try {
    if (resolvedAction === 'cancel') {
      return res.status(200).json(await handleCancel(sb, userId));
    }
    if (resolvedAction === 'portal') {
      return res.status(200).json(await handlePortal(sb, userId));
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Billing API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = withRateLimit('webhook', handler);
module.exports.config = { api: { bodyParser: false } };

function getTierFromPriceId(priceId) {
  const PRO_PRICE = process.env.STRIPE_PRICE_PRO;
  const ENTERPRISE_PRICE = process.env.STRIPE_PRICE_ENTERPRISE;
  if (priceId === ENTERPRISE_PRICE) return 'enterprise';
  if (priceId === PRO_PRICE) return 'pro';
  return 'free';
}
