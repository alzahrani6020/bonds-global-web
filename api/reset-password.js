/**
 * Admin-only password reset link generator
 * Bypasses Supabase email rate limits by generating link server-side
 */
const getSupabase = require('../lib/api/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  const adminEmail = process.env.ADMIN_EMAIL || '';

  if (!email || email !== adminEmail) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'https://bonds-global.com/calculators/auth/reset.html' }
    });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      resetLink: data.properties?.action_link || data.properties?.recovery_url || null
    });
  } catch (err) {
    console.error('[ResetPassword]', err);
    return res.status(500).json({ error: err.message });
  }
};
