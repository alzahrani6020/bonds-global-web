const { createClient } = require('@supabase/supabase-js');

let client = null;

module.exports = function getSupabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables missing');
    }
    client = createClient(url, key);
  }
  return client;
};
