const { createClient } = require('@supabase/supabase-js');

let client = null;
let serviceClient = null;

module.exports = function getSupabase(options = {}) {
  if (options.requireServiceRole) {
    if (!serviceClient) {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key || key === '[SENSITIVE]') {
        const error = new Error('Supabase service role configuration missing');
        error.code = 'SUPABASE_SERVICE_ROLE_NOT_CONFIGURED';
        error.status = 503;
        throw error;
      }
      serviceClient = createClient(url, key);
    }
    return serviceClient;
  }

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
