#!/usr/bin/env node
/**
 * Deprecated fail-closed wrapper.
 *
 * The former V3 helper targeted an obsolete Vercel hostname, overwrote the
 * shared STRIPE_WEBHOOK_SECRET, and triggered a production deployment.
 * Stripe webhook provisioning is centralized in scripts/setup-stripe.js.
 */
console.error(
  'Deprecated: do not run v3/scripts/create-stripe-webhook.js. ' +
  'Use scripts/setup-stripe.js with STRIPE_WEBHOOK_URL=https://bonds-global.com/api/webhook.'
);
process.exit(1);
