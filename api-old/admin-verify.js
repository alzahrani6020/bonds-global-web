// ============================================
// Admin Access Verification API
// Verifies JWT token and checks admin privileges
// ============================================

const getSupabase = require('./lib/supabase');

// Admin user IDs or emails can be set via env
// Format: comma-separated UUIDs or emails
const ADMIN_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Permission matrix per role
const PERMISSIONS = {
  super_admin: ['dashboard', 'users', 'users_write', 'subscriptions', 'messages', 'messages_write', 'roles', 'settings', 'export', 'analytics'],
  admin:       ['dashboard', 'users', 'users_write', 'subscriptions', 'messages', 'messages_write', 'export', 'analytics'],
  support:     ['dashboard', 'users', 'messages', 'messages_write', 'analytics'],
  viewer:      ['dashboard', 'users', 'messages', 'analytics']
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const supabase = getSupabase();

    // Verify the JWT by getting the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase();

    // Check admin_roles table first (new RBAC system)
    const { data: roleRow } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    let role = null;
    let isAdmin = false;

    if (roleRow) {
      role = roleRow.role;
      isAdmin = true;
    } else {
      // Fallback: env-based ACL or enterprise tier
      const isConfigured = ADMIN_IDS.length > 0 || ADMIN_EMAILS.length > 0;
      if (isConfigured) {
        isAdmin = ADMIN_IDS.includes(userId) || ADMIN_EMAILS.includes(userEmail);
        role = isAdmin ? 'admin' : null;
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', userId)
          .single();
        if (profile?.tier === 'enterprise') {
          isAdmin = true;
          role = 'admin';
        }
      }
    }

    const permissions = role ? PERMISSIONS[role] || [] : [];

    res.status(200).json({
      success: true,
      isAdmin,
      role,
      permissions,
      user: { id: userId, email: userEmail },
      demo: !role && isAdmin
    });

  } catch (err) {
    console.error('[admin-verify] Error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
