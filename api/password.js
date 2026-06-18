/**
 * Combined password reset endpoints:
 * - POST /api/force-reset      admin force password update
 * - POST /api/reset-password   admin recovery link generation
 */
const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase() ||
  (process.env.ADMIN_EMAILS || '').split(',')[0].trim().toLowerCase();

function isAdminEmail(email) {
  if (!email || !ADMIN_EMAIL) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

async function handleForceReset(req, res) {
  const { email, password } = req.body || {};

  if (!isAdminEmail(email)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const sb = getSupabase();
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { error: updateError } = await sb.auth.admin.updateUserById(profile.id, { password });
  if (updateError) throw updateError;

  const { data: existingRole } = await sb
    .from('admin_roles')
    .select('role')
    .eq('user_id', profile.id)
    .single();

  if (!existingRole) {
    await sb.from('admin_roles').insert({ user_id: profile.id, role: 'super_admin' });
  }

  return res.status(200).json({
    success: true,
    message: 'تم تغيير كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.'
  });
}

async function handleResetLink(req, res) {
  const { email } = req.body || {};

  if (!isAdminEmail(email)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

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
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const path = (req.url || '').split('?')[0];

  try {
    if (path === '/api/force-reset' || path === '/force-reset') {
      return await handleForceReset(req, res);
    }
    if (path === '/api/reset-password' || path === '/reset-password') {
      return await handleResetLink(req, res);
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('[Password]', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = withRateLimit('strict', handler);
