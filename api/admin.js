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
    // Find user by email (profiles first, then auth fallback)
    let userId = null;
    const { data: profileUsers } = await sb.from('profiles').select('id').eq('email', request.email).limit(1);
    if (profileUsers?.length) {
      userId = profileUsers[0].id;
    } else {
      const { data: authList } = await sb.auth.admin.listUsers();
      const authUser = (authList?.users || []).find(u => u.email === request.email);
      if (authUser) userId = authUser.id;
    }
    if (userId) await sb.from('profiles').update({ tier: request.tier, updated_at: new Date().toISOString() }).eq('id', userId);
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

  const { data: authList } = await sb.auth.admin.listUsers();
  const authUsers = authList?.users || [];
  const totalUsers = authUsers.length;

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
    users: { total: totalUsers, pro: proUsers || 0, enterprise: entUsers || 0, free: Math.max(0, totalUsers - (proUsers || 0) - (entUsers || 0)) },
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

// ── Messages ────────────────────────────────────────────────
async function getMessages(sb) {
  const { data, error } = await sb.from('contact_messages').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return { success: true, messages: data || [] };
}

async function updateMessage(sb, body) {
  const { action: subAction, id } = body;
  if (!id) throw new Error('id required');
  if (subAction === 'mark_read') {
    const { error } = await sb.from('contact_messages').update({ read: true }).eq('id', id);
    if (error) throw error;
    return { success: true };
  }
  if (subAction === 'delete') {
    const { error } = await sb.from('contact_messages').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }
  throw new Error('Invalid sub-action');
}

// ── Roles ───────────────────────────────────────────────────
async function getRoles(sb) {
  const { data, error } = await sb.from('admin_roles').select('*, profiles:user_id(restaurant_name, email)').order('created_at', { ascending: false });
  if (error) throw error;
  return { success: true, roles: data || [] };
}

async function addRole(sb, body, admin) {
  if (!admin) throw new Error('Admin required');
  const { email, role } = body;
  if (!email || !role) throw new Error('email and role required');

  // 1. Try profiles table first
  let { data: users } = await sb.from('profiles').select('id').eq('email', email).limit(1);
  let targetId = users?.[0]?.id;

  // 2. Fallback: search auth.users via admin API
  if (!targetId) {
    const { data: listData, error: listErr } = await sb.auth.admin.listUsers();
    if (listErr) throw listErr;
    const authUser = (listData?.users || []).find(u => u.email === email);
    if (!authUser) throw new Error('User not found');
    targetId = authUser.id;
  }

  const { error } = await sb.from('admin_roles').insert({ user_id: targetId, role }).select().single();
  if (error) throw error;
  return { success: true };
}

async function removeRole(sb, body, admin) {
  if (!admin) throw new Error('Admin required');
  const { id } = body;
  if (!id) throw new Error('id required');
  const { error } = await sb.from('admin_roles').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ── Users ───────────────────────────────────────────────────
async function getUsers(sb) {
  const { data: authList, error: authErr } = await sb.auth.admin.listUsers();
  if (authErr) throw authErr;
  const authUsers = authList?.users || [];

  const { data: profileList, error: profileErr } = await sb.from('profiles').select('id, restaurant_name, email, phone, country, tier, status, created_at');
  if (profileErr) throw profileErr;

  const profileMap = {};
  (profileList || []).forEach(p => profileMap[p.id] = p);

  const merged = authUsers.map(u => {
    const p = profileMap[u.id] || {};
    return {
      id: u.id,
      restaurant_name: p.restaurant_name || u.user_metadata?.restaurant_name || 'مستخدم جديد',
      email: u.email,
      phone: p.phone || u.phone || '',
      country: p.country || u.user_metadata?.country || '',
      tier: p.tier || 'free',
      status: p.status || 'active',
      created_at: u.created_at
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return { success: true, recentUsers: merged };
}

async function updateUser(sb, body, admin) {
  if (!admin) throw new Error('Admin required');
  const { id, tier, status } = body;
  if (!id) throw new Error('id required');
  const updates = {};
  if (tier) updates.tier = tier;
  if (status) updates.status = status;
  updates.updated_at = new Date().toISOString();
  const { error } = await sb.from('profiles').update(updates).eq('id', id);
  if (error) throw error;
  return { success: true };
}

async function deleteUser(sb, body, admin) {
  if (!admin) throw new Error('Admin required');
  const { id } = body;
  if (!id) throw new Error('id required');
  const { error } = await sb.from('profiles').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ── Subscriptions ───────────────────────────────────────────
async function getSubscriptions(sb) {
  const { data: subs, error: subsError } = await sb.from('subscriptions').select('user_id, tier, status, current_period_end, created_at').order('created_at', { ascending: false });
  if (subsError) throw subsError;
  const { count: proCount } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro');
  const { count: entCount } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise');
  const monthlyRevenue = (proCount || 0) * 82 + (entCount || 0) * 212;
  return {
    success: true,
    stats: { proUsers: proCount || 0, enterpriseUsers: entCount || 0, monthlyRevenue },
    recentSubscriptions: subs || []
  };
}

// ── Stats ───────────────────────────────────────────────────
async function getStats(sb) {
  // Get auth users for accurate count
  const { data: authList, error: authErr } = await sb.auth.admin.listUsers();
  const authUsers = authList?.users || [];

  const [
    { count: proCount },
    { count: enterpriseCount },
    { count: scenariosCount },
    { data: recentSubs }
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro'),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise'),
    sb.from('scenarios').select('*', { count: 'exact', head: true }),
    sb.from('subscriptions').select('user_id, tier, status, current_period_end, created_at').order('created_at', { ascending: false }).limit(10)
  ]);

  // Build profile map
  const { data: profileList } = await sb.from('profiles').select('id, restaurant_name, email, phone, country, tier, status, created_at').order('created_at', { ascending: false });
  const profileMap = {};
  (profileList || []).forEach(p => profileMap[p.id] = p);

  // Merge auth users with profiles for recentUsers
  const recentUsers = authUsers.slice(0, 10).map(u => {
    const p = profileMap[u.id] || {};
    return {
      id: u.id,
      restaurant_name: p.restaurant_name || u.user_metadata?.restaurant_name || 'مستخدم جديد',
      email: u.email,
      phone: p.phone || u.phone || '',
      country: p.country || u.user_metadata?.country || '',
      tier: p.tier || 'free',
      status: p.status || 'active',
      created_at: u.created_at
    };
  });

  const totalUsers = authUsers.length;
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
    recentUsers,
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
      if (action === 'messages') { return res.status(200).json(await getMessages(sb)); }
      if (action === 'roles') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getRoles(sb));
      }
      if (action === 'users') { return res.status(200).json(await getUsers(sb)); }
      if (action === 'subscriptions') { return res.status(200).json(await getSubscriptions(sb)); }
      if (action === 'subscriptions') { return res.status(200).json(await getSubscriptions(sb)); }
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
      if (action === 'users') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const subAction = req.body?.action;
        if (subAction === 'update') return res.status(200).json(await updateUser(sb, req.body, admin));
        if (subAction === 'delete') return res.status(200).json(await deleteUser(sb, req.body, admin));
        return res.status(400).json({ error: 'Invalid sub-action' });
      }
      if (action === 'messages') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await updateMessage(sb, req.body));
      }
      if (action === 'roles') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const subAction = req.body?.action;
        if (subAction === 'add') return res.status(200).json(await addRole(sb, req.body, admin));
        if (subAction === 'remove') return res.status(200).json(await removeRole(sb, req.body, admin));
        return res.status(400).json({ error: 'Invalid sub-action' });
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
