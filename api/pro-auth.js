const { createClient } = require('@supabase/supabase-js');
const getSupabase = require('../lib/api/supabase');

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase auth environment variables missing');
  }
  return createClient(url, key);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (action === 'signup') {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (error) throw error;
      return res.status(200).json({ success: true, user: { id: data.user.id, email: data.user.email } });
    }

    // signin
    const authClient = getAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    res.status(200).json({
      success: true,
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user
    });
  } catch (err) {
    console.error('[pro-auth] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
