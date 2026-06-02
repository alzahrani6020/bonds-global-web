// ============================================
// Stripe Webhook Handler
// POST /api/webhook
// Receives Stripe events and syncs to Supabase
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const getSupabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabase = getSupabase();

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    console.error('Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    res.status(400).json({ error: 'Missing webhook configuration' });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  // Log the event
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
        const userId = session.client_reference_id || session.subscription_metadata?.supabaseUserId;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        if (!userId) {
          console.error('No userId found in checkout session');
          break;
        }

        // Update profile with Stripe customer ID
        await supabase.from('profiles').update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        // Create subscription record (will be updated by subscription events)
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

        // Fetch subscription to get tier
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        const userId = subscription.metadata?.supabaseUserId;

        if (!userId) {
          console.error('No userId in subscription metadata');
          break;
        }

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

        // Update profile tier
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

    // Mark event as processed
    await supabase.from('webhook_events').update({
      processed: true,
    }).eq('stripe_event_id', event.id);

  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
    return;
  }

  res.status(200).json({ received: true });
};

function getTierFromPriceId(priceId) {
  const PRO_PRICE = process.env.STRIPE_PRICE_PRO;
  const ENTERPRISE_PRICE = process.env.STRIPE_PRICE_ENTERPRISE;

  if (priceId === ENTERPRISE_PRICE) return 'enterprise';
  if (priceId === PRO_PRICE) return 'pro';
  return 'free';
}
