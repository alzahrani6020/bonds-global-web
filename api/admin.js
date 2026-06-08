/**
 * Unified Admin API
 * Routes: /api/admin?action=bank-transfers|settings|exceptions|analytics
 */

const getSupabase = require('./lib/supabase');

async function verifyAdmin(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // Owner fallback
  if (user.email === 'iiffund.dev@gmail.com') return user;
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin', 'support'].includes(role.role)) return null;
  return user;
}

async function verifyAdminStrict(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // Owner fallback
  if (user.email === 'iiffund.dev@gmail.com') return user;
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin'].includes(role.role)) return null;
  return user;
}

// ── Bank Transfers ──────────────────────────────────────────
async function getBankTransfers(sb) {
  const { data, error } = await sb.from('bank_transfer_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return { data };
}

async function updateBankTransfer(sb, body) {
  const { id, action } = body;
  if (!id || !['verified', 'rejected'].includes(action)) throw new Error('Invalid request');
  const { data: request } = await sb.from('bank_transfer_requests').select('*').eq('id', id).single();
  if (!request) throw new Error('Request not found');
  await sb.from('bank_transfer_requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', id);
  if (action === 'verified') {
    const { data: users } = await sb.from('profiles').select('id').eq('email', request.email).limit(1);
    if (users?.length) await sb.from('profiles').update({ tier: request.tier, updated_at: new Date().toISOString() }).eq('id', users[0].id);
  }
  return { success: true };
}

// ── Settings ────────────────────────────────────────────────
async function getSettings(sb) {
  const { data, error } = await sb.from('site_settings').select('*');
  if (error) throw error;
  const settings = {};
  (data || []).forEach(s => settings[s.key] = s.value);
  return settings;
}

async function updateSettings(sb, body, admin) {
  if (!admin) throw new Error('Admin required');
  for (const [key, value] of Object.entries(body)) {
    await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  }
  return { success: true };
}

// ── Exceptions ──────────────────────────────────────────────
async function getExceptions(sb, admin) {
  if (!admin) throw new Error('Admin required');
  const { data, error } = await sb.from('usage_exceptions').select('*, profiles:user_id(email, restaurant_name)').order('created_at', { ascending: false });
  if (error) throw error;
  return { data };
}

async function createException(sb, body, admin) {
  if (!admin) throw new Error('Admin required');
  const { user_id, calculator, limit_override, reason } = body;
  if (!user_id || !limit_override) throw new Error('user_id and limit_override required');
  const { data, error } = await sb.from('usage_exceptions').insert([{
    user_id, calculator: calculator || 'all', limit_override, reason, created_by: admin.id,
  }]).select().single();
  if (error) throw error;
  return { success: true, data };
}

async function deleteException(sb, id, admin) {
  if (!admin) throw new Error('Admin required');
  if (!id) throw new Error('id required');
  const { error } = await sb.from('usage_exceptions').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ── Analytics ───────────────────────────────────────────────
async function getAnalytics(sb, admin) {
  if (!admin) throw new Error('Admin required');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count: totalUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true });
  const { count: proUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro');
  const { count: entUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise');

  const { data: usageData } = await sb.from('usage_logs').select('calculator').gte('created_at', thirtyDaysAgo);
  const calcStats = {};
  (usageData || []).forEach(u => { calcStats[u.calculator] = (calcStats[u.calculator] || 0) + 1; });

  const { data: pendingTransfers } = await sb.from('bank_transfer_requests').select('*').eq('status', 'pending');
  const { data: verifiedTransfers } = await sb.from('bank_transfer_requests').select('amount_sar').eq('status', 'verified');
  const bankRevenue = (verifiedTransfers || []).reduce((sum, t) => sum + (t.amount_sar || 0), 0);

  const { data: activeSubs } = await sb.from('subscriptions').select('status, tier').eq('status', 'active');
  const stripeRevenue = (activeSubs || []).reduce((sum, s) => sum + (s.tier === 'enterprise' ? 212 : s.tier === 'pro' ? 82 : 0), 0);

  return {
    users: { total: totalUsers || 0, pro: proUsers || 0, enterprise: entUsers || 0, free: (totalUsers || 0) - (proUsers || 0) - (entUsers || 0) },
    usage: { total: usageData?.length || 0, byCalculator: calcStats },
    revenue: { stripe: stripeRevenue, bank: bankRevenue, total: stripeRevenue + bankRevenue },
    pendingTransfers: pendingTransfers?.length || 0,
  };
}


// ── Verify Admin ────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  super_admin: ['users', 'subscriptions', 'messages', 'roles', 'analytics', 'users_write', 'export'],
  admin: ['users', 'subscriptions', 'messages', 'analytics', 'users_write', 'export'],
  support: ['users', 'messages', 'analytics'],
  viewer: ['analytics']
};

async function verifyAdminUser(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // Owner fallback
  if (user.email === 'iiffund.dev@gmail.com') return { user, role: 'super_admin' };
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role) return null;
  return { user, role: role.role };
}

// ── Stats ───────────────────────────────────────────────────
async function getStats(sb) {
  const [
    { count: usersCount },
    { count: proCount },
    { count: enterpriseCount },
    { count: scenariosCount },
    { data: recentUsers },
    { data: recentSubs }
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro'),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise'),
    sb.from('scenarios').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('id, restaurant_name, email, phone, country, tier, status, created_at').order('created_at', { ascending: false }).limit(10),
    sb.from('subscriptions').select('user_id, tier, status, current_period_end, created_at').order('created_at', { ascending: false }).limit(10)
  ]);
  const totalUsers = usersCount || 0;
  const proUsers = proCount || 0;
  const enterpriseUsers = enterpriseCount || 0;
  const freeUsers = Math.max(0, totalUsers - proUsers - enterpriseUsers);
  const monthlyRevenue = proUsers * 82 + enterpriseUsers * 212;
  return {
    success: true,
    stats: {
      totalUsers, freeUsers, proUsers, enterpriseUsers,
      totalScenarios: scenariosCount || 0,
      monthlyRevenue,
      conversionRate: totalUsers > 0 ? ((proUsers + enterpriseUsers) / totalUsers * 100).toFixed(1) : '0.0',
      arpu: totalUsers > 0 ? (monthlyRevenue / totalUsers).toFixed(2) : '0.00'
    },
    recentUsers: recentUsers || [],
    recentSubscriptions: recentSubs || [],
    generatedAt: new Date().toISOString()
  };
}

// ── Main Handler ────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  const action = req.query?.action || req.body?.action;

  try {
    if (req.method === 'GET') {
      if (action === 'bank-transfers') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getBankTransfers(sb));
      }
      if (action === 'settings') {
        return res.status(200).json(await getSettings(sb));
      }
      if (action === 'exceptions') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getExceptions(sb, admin));
      }
      if (action === 'stats') { return res.status(200).json(await getStats(sb)); }
      if (action === 'analytics') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getAnalytics(sb, admin));
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'POST') {
      if (action === 'verify') {
        const result = await verifyAdminUser(req, sb);
        if (!result) return res.status(403).json({ success: false, isAdmin: false });
        const perms = ROLE_PERMISSIONS[result.role] || ROLE_PERMISSIONS.viewer;
        return res.status(200).json({
          success: true,
          isAdmin: true,
          role: result.role,
          permissions: perms,
          demo: false
        });
      }
      if (action === 'bank-transfers') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await updateBankTransfer(sb, req.body));
      }
      if (action === 'settings') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await updateSettings(sb, req.body, admin));
      }
      if (action === 'exceptions') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await createException(sb, req.body, admin));
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'DELETE') {
      if (action === 'exceptions') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await deleteException(sb, req.query.id, admin));
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Admin API error:', err);
    res.status(500).json({ error: err.message });
  }
};
