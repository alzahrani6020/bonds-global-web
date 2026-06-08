/**
 * Force password reset for admin (server-side)
 */
const getSupabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  const adminEmail = process.env.ADMIN_EMAIL || '';

  if (!email || email !== adminEmail) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const sb = getSupabase();
    
    // Find user by email via profiles table
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { error: updateError } = await sb.auth.admin.updateUserById(profile.id, {
      password: password
    });

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.'
    });
  } catch (err) {
    console.error('[ForceReset]', err);
    return res.status(500).json({ error: err.message });
  }
};
