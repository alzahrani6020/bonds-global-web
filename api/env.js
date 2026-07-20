// ============================================
// Runtime Environment Variables Injector
// Serves as JS: <script src="/api/env"></script>
// Call BEFORE any Bonds scripts in HTML <head>
// ============================================

// NOTE: This endpoint is loaded on every page load before auth, so it must
// never be blocked by rate limiting. It only serves public browser-safe keys.
const getSupabase = require('../lib/api/supabase');

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');

  let adminEnforceMfa = process.env.ADMIN_ENFORCE_MFA === 'true';
  try {
    const sb = getSupabase();
    const { data } = await sb.from('site_settings').select('value').eq('key', 'admin_enforce_mfa').single();
    if (data?.value === 'true') adminEnforceMfa = true;
    else if (data?.value === 'false') adminEnforceMfa = false;
  } catch (e) {
    // keep env fallback
  }

  const env = {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || '',
    STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || '',
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || '',
    SENTRY_DSN: process.env.SENTRY_DSN || '',
    GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '',
    CALENDLY_URL: process.env.CALENDLY_URL || 'https://calendly.com/iiffund-dev/30min',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAILS || '').split(',')[0].trim() || '',
    ADMIN_ENFORCE_MFA: adminEnforceMfa ? 'true' : 'false',
  };

  res.status(200).end(`window.__ENV = ${JSON.stringify(env)};`);
}

module.exports = handler;
