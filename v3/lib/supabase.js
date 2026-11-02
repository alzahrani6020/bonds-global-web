const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || (process.env.VERCEL_ENV === 'preview'
      ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
      : null);

  if (!url || !key) {
    throw new Error('Missing Supabase credentials for V3 runtime');
  }

  return createClient(url, key);
}

module.exports = { getSupabaseClient };
