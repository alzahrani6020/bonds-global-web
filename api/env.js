// ============================================
// Runtime Environment Variables Injector
// Serves as JS: <script src="/api/env"></script>
// Call BEFORE any Bonds scripts in HTML <head>
// ============================================

const { withRateLimit } = require('../lib/api/rate-limit');

function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');

  const env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || '',
    STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || '',
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
    SENTRY_DSN: process.env.SENTRY_DSN || '',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAILS || '').split(',')[0].trim() || '',
  };

  res.status(200).end(`window.__ENV = ${JSON.stringify(env)};`);
}

module.exports = withRateLimit('public', handler);
