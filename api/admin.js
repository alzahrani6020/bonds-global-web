/**
 * Unified Admin API
 * Routes: /api/admin?action=bank-transfers|settings|exceptions|analytics
 */

const getSupabase = require('../lib/api/supabase');
const { withRateLimit } = require('../lib/api/rate-limit');

const OWNER_EMAIL = process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAILS || '').split(',')[0].trim() || '';

async function verifyAdmin(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // Owner fallback
  if (OWNER_EMAIL && user.email === OWNER_EMAIL) return user;
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
  // Owner fallback — always super_admin
  if (OWNER_EMAIL && user.email === OWNER_EMAIL) return user;
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin'].includes(role.role)) return null;
  return user;
}

// ── Audit logging ───────────────────────────────────────────
async function getActorRole(sb, admin) {
  if (OWNER_EMAIL && admin.email === OWNER_EMAIL) return 'super_admin';
  try {
    const { data } = await sb.from('admin_roles').select('role').eq('user_id', admin.id).single();
    return data?.role || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

async function logAdminAction(sb, admin, action, targetType, targetId, targetEmail, details, req) {
  try {
    const role = await getActorRole(sb, admin);
    const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '';
    await sb.from('admin_audit_log').insert({
      actor_id: admin.id,
      actor_email: admin.email,
      actor_role: role,
      action,
      target_type: targetType || '',
      target_id: String(targetId || ''),
      target_email: targetEmail || '',
      details: details || {},
      ip_address: ip
    });
  } catch (e) {
    console.warn('[AuditLog] failed:', e.message || e);
  }
}

async function getAuditLog(sb, opts = {}) {
  const { limit = 100, offset = 0 } = opts;
  const { data, error, count } = await sb
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { success: true, logs: data || [], count: count || 0 };
}

// ── Bank Transfers ──────────────────────────────────────────
async function getBankTransfers(sb) {
  const { data, error } = await sb.from('bank_transfer_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return { data };
}

async function updateBankTransfer(sb, body, admin, req) {
  const { id, action } = body;
  if (!id || !['verified', 'rejected'].includes(action)) throw new Error('Invalid request');
  const { data: request } = await sb.from('bank_transfer_requests').select('*').eq('id', id).single();
  if (!request) throw new Error('Request not found');
  await sb.from('bank_transfer_requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', id);
  let affectedUserId = null;
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
    if (userId) {
      affectedUserId = userId;
      await sb.from('profiles').update({ tier: request.tier, updated_at: new Date().toISOString() }).eq('id', userId);
    }
  }
  await logAdminAction(sb, admin, 'bank_transfer_' + action, 'bank_transfer', id, request.email, { amount_sar: request.amount_sar, tier: request.tier, affected_user_id: affectedUserId }, req);
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

async function updateSettings(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  for (const [key, value] of Object.entries(body)) {
    await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() });
  }
  await logAdminAction(sb, admin, 'settings_update', 'settings', null, null, { keys: Object.keys(body) }, req);
  return { success: true };
}

// ── Exceptions ──────────────────────────────────────────────
async function getExceptions(sb, admin) {
  if (!admin) throw new Error('Admin required');
  const { data, error } = await sb.from('usage_exceptions').select('*, profiles:user_id(email, restaurant_name)').order('created_at', { ascending: false });
  if (error) throw error;
  return { data };
}

async function createException(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { user_id, calculator, limit_override, reason, expires_at } = body;
  if (!user_id || !limit_override) throw new Error('user_id and limit_override required');
  const insert = {
    user_id, calculator: calculator || 'all', limit_override, reason, created_by: admin.id,
  };
  if (expires_at) insert.expires_at = expires_at;
  const { data, error } = await sb.from('usage_exceptions').insert([insert]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'exception_create', 'usage_exception', data?.id, null, { user_id, calculator, limit_override, reason, expires_at }, req);
  return { success: true, data };
}

async function deleteException(sb, id, admin, req) {
  if (!admin) throw new Error('Admin required');
  if (!id) throw new Error('id required');
  const { error } = await sb.from('usage_exceptions').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction(sb, admin, 'exception_delete', 'usage_exception', id, null, {}, req);
  return { success: true };
}

// ── Analytics ───────────────────────────────────────────────
async function getAnalytics(sb, admin) {
  if (!admin) throw new Error('Admin required');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalUsers = await getTotalUsers(sb);

  const { count: proUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro');
  const { count: entUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise');

  const { data: usageData } = await sb.from('usage_logs').select('calculator, user_id, created_at').gte('created_at', thirtyDaysAgo);
  const calcStats = {};
  const userStats = {};
  const dayStats = {};
  (usageData || []).forEach(u => {
    calcStats[u.calculator] = (calcStats[u.calculator] || 0) + 1;
    userStats[u.user_id] = (userStats[u.user_id] || 0) + 1;
    const day = u.created_at?.split('T')[0] || 'unknown';
    dayStats[day] = (dayStats[day] || 0) + 1;
  });

  // Top users
  const topUserIds = Object.entries(userStats).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  let topUsers = [];
  if (topUserIds.length) {
    const { data: topProfiles } = await sb.from('profiles').select('id, restaurant_name, email').in('id', topUserIds);
    topUsers = (topProfiles || []).map(p => ({ name: p.restaurant_name || p.email || '—', count: userStats[p.id] || 0 }));
  }

  const { data: pendingTransfers } = await sb.from('bank_transfer_requests').select('*').eq('status', 'pending');
  const { data: verifiedTransfers } = await sb.from('bank_transfer_requests').select('amount_sar').eq('status', 'verified');
  const bankRevenue = (verifiedTransfers || []).reduce((sum, t) => sum + (t.amount_sar || 0), 0);

  const { data: activeSubs } = await sb.from('subscriptions').select('status, tier').eq('status', 'active');
  const stripeRevenue = (activeSubs || []).reduce((sum, s) => sum + (s.tier === 'enterprise' ? 212 : s.tier === 'pro' ? 82 : 0), 0);

  return {
    users: { total: totalUsers, pro: proUsers || 0, enterprise: entUsers || 0, free: Math.max(0, totalUsers - (proUsers || 0) - (entUsers || 0)) },
    usage: { total: usageData?.length || 0, byCalculator: calcStats, byDay: dayStats, topUsers },
    revenue: { stripe: stripeRevenue, bank: bankRevenue, total: stripeRevenue + bankRevenue },
    pendingTransfers: pendingTransfers?.length || 0,
  };
}


// ── Page Views & Sessions ───────────────────────────────────
async function getPageViews(sb) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Views by section/page/day (last 7 days)
  const { data: views7 } = await sb.from('page_views').select('page, section, created_at').gte('created_at', sevenDaysAgo);
  const sectionStats = {};
  const pageStats = {};
  const dayStats = {};
  (views7 || []).forEach(v => {
    sectionStats[v.section || v.page || 'unknown'] = (sectionStats[v.section || v.page || 'unknown'] || 0) + 1;
    pageStats[v.page || 'unknown'] = (pageStats[v.page || 'unknown'] || 0) + 1;
    const day = v.created_at?.split('T')[0] || 'unknown';
    dayStats[day] = (dayStats[day] || 0) + 1;
  });

  // Sessions duration (last 30 days)
  const { data: sessions } = await sb.from('page_sessions').select('page, duration_seconds, started_at').gte('started_at', thirtyDaysAgo);
  const pageDuration = {};
  const pageSessionCount = {};
  (sessions || []).forEach(s => {
    const p = s.page || 'unknown';
    pageDuration[p] = (pageDuration[p] || 0) + (s.duration_seconds || 0);
    pageSessionCount[p] = (pageSessionCount[p] || 0) + 1;
  });
  const avgDurationByPage = Object.keys(pageDuration).map(p => ({
    page: p,
    totalSeconds: pageDuration[p],
    sessions: pageSessionCount[p],
    avgSeconds: Math.round(pageDuration[p] / pageSessionCount[p]),
    avgMinutes: (pageDuration[p] / pageSessionCount[p] / 60).toFixed(1)
  })).sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    success: true,
    views7d: { total: views7?.length || 0, bySection: sectionStats, byPage: pageStats, byDay: dayStats },
    sessions30d: { total: sessions?.length || 0, byPage: avgDurationByPage }
  };
}

// ── AI Review Requests ──────────────────────────────────────
async function getAiReviews(sb, admin) {
  if (!admin) throw new Error('Admin required');
  const { data, error } = await sb
    .from('ai_review_requests')
    .select(`
      *,
      ai_requests!inner(
        id, type, payload, model, tokens_input, tokens_output, cost_usd, created_at,
        ai_results(result, risk_score)
      ),
      profiles:user_id(email, full_name)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { data: data || [] };
}

async function updateAiReview(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id, status, assigned_to, admin_notes } = body;
  if (!id) throw new Error('id required');
  const update = { updated_at: new Date().toISOString() };
  if (status) {
    update.status = status;
    if (status === 'approved') update.reviewed_by = admin.id;
  }
  if (assigned_to !== undefined) {
    let assigneeId = null;
    const email = (assigned_to || '').trim();
    if (email) {
      // Allow UUID or email; resolve email to user id via profiles
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
      if (isUuid) {
        assigneeId = email;
      } else {
        const { data: profileUsers } = await sb.from('profiles').select('id').eq('email', email).limit(1);
        if (profileUsers?.length) assigneeId = profileUsers[0].id;
      }
    }
    update.assigned_to = assigneeId;
  }
  if (admin_notes !== undefined) update.admin_notes = admin_notes || null;
  const { error } = await sb.from('ai_review_requests').update(update).eq('id', id);
  if (error) throw error;
  await logAdminAction(sb, admin, 'ai_review_update', 'ai_review_request', id, null, { status, assigned_to, admin_notes }, req);
  return { success: true };
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
  if (OWNER_EMAIL && user.email === OWNER_EMAIL) return { user, role: 'super_admin' };
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

async function updateMessage(sb, body, admin, req) {
  const { action: subAction, id } = body;
  if (!id) throw new Error('id required');
  if (subAction === 'mark_read') {
    const { error } = await sb.from('contact_messages').update({ read: true }).eq('id', id);
    if (error) throw error;
    if (admin) await logAdminAction(sb, admin, 'message_mark_read', 'contact_message', id, null, {}, req);
    return { success: true };
  }
  if (subAction === 'delete') {
    const { error } = await sb.from('contact_messages').delete().eq('id', id);
    if (error) throw error;
    if (admin) await logAdminAction(sb, admin, 'message_delete', 'contact_message', id, null, {}, req);
    return { success: true };
  }
  throw new Error('Invalid sub-action');
}

// ── Roles ───────────────────────────────────────────────────
async function getRoles(sb) {
  const { data: roles, error } = await sb.from('admin_roles').select('*').order('created_at', { ascending: false });
  if (error) throw error;

  // Get user emails/names manually since FK relationship may not be in schema cache
  const userIds = (roles || []).map(r => r.user_id).filter(Boolean);
  let profileMap = {};
  if (userIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, email, restaurant_name').in('id', userIds);
    (profiles || []).forEach(p => profileMap[p.id] = p);
  }

  const merged = (roles || []).map(r => ({
    ...r,
    profiles: {
      email: profileMap[r.user_id]?.email || r.user_id,
      restaurant_name: profileMap[r.user_id]?.restaurant_name || 'مستخدم'
    }
  }));

  return { success: true, roles: merged };
}

async function addRole(sb, body, admin, req) {
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

  const { data, error } = await sb.from('admin_roles').insert({ user_id: targetId, role }).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'role_grant', 'admin_role', data?.id || targetId, email, { role, target_id: targetId }, req);
  return { success: true };
}

async function removeRole(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id } = body;
  if (!id) throw new Error('id required');
  const { data: roleRow } = await sb.from('admin_roles').select('user_id, role').eq('id', id).single();
  const { error } = await sb.from('admin_roles').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction(sb, admin, 'role_remove', 'admin_role', id, null, { target_id: roleRow?.user_id, role: roleRow?.role }, req);
  return { success: true };
}

// ── Users ───────────────────────────────────────────────────
async function getTotalUsers(sb) {
  try {
    const { data: authList } = await sb.auth.admin.listUsers();
    return authList?.users?.length || 0;
  } catch (e) {
    const { count } = await sb.from('profiles').select('*', { count: 'exact', head: true });
    return count || 0;
  }
}

async function getUsers(sb) {
  let authUsers = [];
  let useAuth = true;
  try {
    const { data: authList } = await sb.auth.admin.listUsers();
    authUsers = authList?.users || [];
  } catch (e) {
    useAuth = false;
  }
  // If auth admin API is unavailable or returns no users (e.g. missing service-role key),
  // fall back to the profiles table so the admin UI is never empty because of auth-only logic.
  if (useAuth && authUsers.length === 0) {
    useAuth = false;
  }

  const { data: profileList, error: profileErr } = await sb.from('profiles')
    .select('id, restaurant_name, email, phone, country, city, business_type, bio, needs, employee_count, branch_count, tier, tier_expires_at, status, created_at')
    .order('created_at', { ascending: false });
  if (profileErr) throw profileErr;

  const profileMap = {};
  (profileList || []).forEach(p => profileMap[p.id] = p);

  let merged = [];
  if (useAuth) {
    merged = authUsers.map(u => {
      const p = profileMap[u.id] || {};
      return {
        id: u.id,
        restaurant_name: p.restaurant_name || u.user_metadata?.restaurant_name || 'مستخدم جديد',
        email: u.email,
        phone: p.phone || u.user_metadata?.phone || u.phone || '',
        country: p.country || u.user_metadata?.country || '',
        city: p.city || u.user_metadata?.city || '',
        business_type: p.business_type || u.user_metadata?.business_type || '',
        bio: p.bio || u.user_metadata?.bio || '',
        needs: p.needs || u.user_metadata?.needs || '',
        employee_count: p.employee_count || parseInt(u.user_metadata?.employee_count) || 0,
        branch_count: p.branch_count || parseInt(u.user_metadata?.branch_count) || 1,
        tier: p.tier || 'free',
        tier_expires_at: p.tier_expires_at || null,
        status: p.status || 'active',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null
      };
    });
  } else {
    merged = (profileList || []).map(p => ({
      id: p.id,
      restaurant_name: p.restaurant_name || p.email || 'مستخدم جديد',
      email: p.email,
      phone: p.phone || '',
      country: p.country || '',
      city: p.city || '',
      business_type: p.business_type || '',
      bio: p.bio || '',
      needs: p.needs || '',
      employee_count: p.employee_count || 0,
      branch_count: p.branch_count || 1,
      tier: p.tier || 'free',
      tier_expires_at: p.tier_expires_at || null,
      status: p.status || 'active',
      created_at: p.created_at,
      last_sign_in_at: null
    }));
  }

  return { success: true, recentUsers: merged };
}

async function updateUser(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id, tier, status, city, business_type, bio, needs, employee_count } = body;
  if (!id) throw new Error('id required');
  const updates = {};
  if (tier !== undefined) updates.tier = tier;
  if (status !== undefined) updates.status = status;
  if (city !== undefined) updates.city = city;
  if (business_type !== undefined) updates.business_type = business_type;
  if (bio !== undefined) updates.bio = bio;
  if (needs !== undefined) updates.needs = needs;
  if (employee_count !== undefined) updates.employee_count = employee_count;
  updates.updated_at = new Date().toISOString();
  const { error } = await sb.from('profiles').update(updates).eq('id', id);
  if (error) throw error;
  await logAdminAction(sb, admin, 'user_update', 'user', id, body.email || null, updates, req);
  return { success: true };
}

async function grantAccess(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id, tier, expires_at, reason } = body;
  if (!id) throw new Error('id required');
  if (!tier || !['free', 'pro', 'enterprise'].includes(tier)) throw new Error('valid tier required');

  const now = new Date().toISOString();
  const profileUpdates = { tier, updated_at: now };
  if (expires_at) profileUpdates.tier_expires_at = expires_at;
  else profileUpdates.tier_expires_at = null;
  const { error: profileErr } = await sb.from('profiles').update(profileUpdates).eq('id', id);
  if (profileErr) throw profileErr;

  const sub = {
    user_id: id,
    tier,
    status: tier === 'free' ? 'inactive' : 'active',
    payment_method: 'manual',
    current_period_end: expires_at || null,
    updated_at: now,
  };
  const { error: subErr } = await sb.from('subscriptions').upsert(sub, { onConflict: 'user_id' });
  if (subErr) throw subErr;

  if (reason) {
    await sb.from('usage_exceptions').insert([{
      user_id: id,
      calculator: 'all',
      limit_override: 9999,
      reason: reason || 'Temporary admin grant',
      expires_at: expires_at || null,
      created_by: admin.id,
    }]);
  }

  await logAdminAction(sb, admin, 'grant_access', 'user', id, null, { tier, expires_at, reason }, req);
  return { success: true };
}

async function deleteUser(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id } = body;
  if (!id) throw new Error('id required');
  const { error } = await sb.from('profiles').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction(sb, admin, 'user_delete', 'user', id, body.email || null, {}, req);
  return { success: true };
}

async function resetPassword(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id, password } = body;
  if (!id || !password || password.length < 6) throw new Error('id and password (min 6 chars) required');
  const { error } = await sb.auth.admin.updateUserById(id, { password });
  if (error) throw error;
  await logAdminAction(sb, admin, 'user_reset_password', 'user', id, body.email || null, {}, req);
  return { success: true };
}

async function createUserAdmin(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { email, password, restaurant_name, phone, country, city, business_type, tier, status, employee_count, branch_count } = body;
  if (!email || !password) throw new Error('email and password required');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { restaurant_name: restaurant_name || '', phone: phone || '', country: country || '', city: city || '', business_type: business_type || '' }
  });
  if (authError) throw authError;
  if (!authData?.user) throw new Error('User creation failed');

  const { error: profileError } = await sb.from('profiles').insert([{
    id: authData.user.id,
    email,
    restaurant_name: restaurant_name || 'مستخدم جديد',
    phone: phone || '',
    country: country || '',
    city: city || '',
    business_type: business_type || '',
    tier: tier || 'free',
    status: status || 'active',
    employee_count: parseInt(employee_count) || 0,
    branch_count: parseInt(branch_count) || 1,
    created_at: new Date().toISOString()
  }]);
  if (profileError) throw profileError;

  await logAdminAction(sb, admin, 'user_create', 'user', authData.user.id, email, { restaurant_name, tier, status }, req);
  return { success: true, user: { id: authData.user.id, email: authData.user.email } };
}

// ── Password reset endpoints (merged from api/password.js) ──
const ADMIN_EMAIL_PASSWORD = (process.env.ADMIN_EMAIL || '').trim().toLowerCase() ||
  (process.env.ADMIN_EMAILS || '').split(',')[0].trim().toLowerCase();

function isAdminEmail(email) {
  if (!email || !ADMIN_EMAIL_PASSWORD) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL_PASSWORD;
}

async function handleForceReset(sb, body) {
  const { email, password } = body || {};
  if (!isAdminEmail(email)) throw new Error('Unauthorized');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileError || !profile) throw new Error('User not found');

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

  return {
    success: true,
    message: 'تم تغيير كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.'
  };
}

async function handleResetLink(sb, body) {
  const { email } = body || {};
  if (!isAdminEmail(email)) throw new Error('Unauthorized');

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://bonds-global.com/calculators/auth/reset.html' }
  });

  if (error) throw error;

  return {
    success: true,
    resetLink: data.properties?.action_link || data.properties?.recovery_url || null
  };
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
  const totalUsers = await getTotalUsers(sb);

  const [
    { count: proCount },
    { count: enterpriseCount },
    { count: scenariosCount },
    { data: recentSubs },
    { data: profileList }
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro'),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise'),
    sb.from('scenarios').select('*', { count: 'exact', head: true }),
    sb.from('subscriptions').select('user_id, tier, status, current_period_end, created_at').order('created_at', { ascending: false }).limit(10),
    sb.from('profiles').select('id, restaurant_name, email, phone, country, tier, status, created_at').order('created_at', { ascending: false }).limit(10)
  ]);

  const recentUsers = (profileList || []).map(p => ({
    id: p.id,
    restaurant_name: p.restaurant_name || p.email || 'مستخدم جديد',
    email: p.email,
    phone: p.phone || '',
    country: p.country || '',
    tier: p.tier || 'free',
    status: p.status || 'active',
    created_at: p.created_at
  }));

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
async function handler(req, res) {
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
      if (action === 'stats') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getStats(sb));
      }
      if (action === 'messages') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getMessages(sb));
      }
      if (action === 'roles') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getRoles(sb));
      }
      if (action === 'users') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getUsers(sb));
      }
      if (action === 'subscriptions') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getSubscriptions(sb));
      }
      if (action === 'analytics') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getAnalytics(sb, admin));
      }
      if (action === 'page-views') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getPageViews(sb));
      }
      if (action === 'ai-reviews') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getAiReviews(sb, admin));
      }
      if (action === 'audit-log') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const limit = Math.min(parseInt(req.query?.limit) || 100, 500);
        const offset = parseInt(req.query?.offset) || 0;
        return res.status(200).json(await getAuditLog(sb, { limit, offset }));
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'POST') {
      if (action === 'force-reset') {
        try {
          return res.status(200).json(await handleForceReset(sb, req.body));
        } catch (err) {
          if (err.message === 'Unauthorized') return res.status(403).json({ error: err.message });
          if (err.message === 'User not found') return res.status(404).json({ error: err.message });
          if (err.message === 'Password must be at least 6 characters') return res.status(400).json({ error: err.message });
          throw err;
        }
      }
      if (action === 'reset-password') {
        try {
          return res.status(200).json(await handleResetLink(sb, req.body));
        } catch (err) {
          if (err.message === 'Unauthorized') return res.status(403).json({ error: err.message });
          throw err;
        }
      }
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
        return res.status(200).json(await updateBankTransfer(sb, req.body, admin, req));
      }
      if (action === 'settings') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await updateSettings(sb, req.body, admin, req));
      }
      if (action === 'exceptions') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await createException(sb, req.body, admin, req));
      }
      if (action === 'users') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const subAction = req.body?.action;
        if (subAction === 'create') return res.status(200).json(await createUserAdmin(sb, req.body, admin, req));
        if (subAction === 'update') return res.status(200).json(await updateUser(sb, req.body, admin, req));
        if (subAction === 'grant-access') return res.status(200).json(await grantAccess(sb, req.body, admin, req));
        if (subAction === 'delete') return res.status(200).json(await deleteUser(sb, req.body, admin, req));
        if (subAction === 'reset-password') return res.status(200).json(await resetPassword(sb, req.body, admin, req));
        return res.status(400).json({ error: 'Invalid sub-action' });
      }
      if (action === 'messages') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await updateMessage(sb, req.body, admin, req));
      }
      if (action === 'roles') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const subAction = req.body?.action;
        if (subAction === 'add') return res.status(200).json(await addRole(sb, req.body, admin, req));
        if (subAction === 'remove') return res.status(200).json(await removeRole(sb, req.body, admin, req));
        return res.status(400).json({ error: 'Invalid sub-action' });
      }
      if (action === 'ai-reviews') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await updateAiReview(sb, req.body, admin, req));
      }
      if (action === 'makeOwnerAdmin') {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(403).json({ error: 'Token required' });
        const token = authHeader.slice(7);
        const { data: { user }, error } = await sb.auth.getUser(token);
        if (error || !user) return res.status(403).json({ error: 'Invalid token' });
        if (!OWNER_EMAIL || user.email !== OWNER_EMAIL) return res.status(403).json({ error: 'Not authorized' });
        // Upsert super_admin (insert or update)
        const { error: upsertErr } = await sb.from('admin_roles')
          .upsert({ user_id: user.id, role: 'super_admin', granted_by: user.id }, { onConflict: 'user_id' });
        if (upsertErr) return res.status(500).json({ error: upsertErr.message });
        return res.status(200).json({ success: true, role: 'super_admin' });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'DELETE') {
      if (action === 'exceptions') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await deleteException(sb, req.query.id, admin, req));
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Admin API error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = withRateLimit('strict', handler);
