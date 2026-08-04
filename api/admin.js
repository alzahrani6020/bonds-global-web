/**
 * Unified Admin API
 * Routes: /api/admin?action=bank-transfers|settings|exceptions|analytics
 */

const getSupabase = require('../lib/api/supabase');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { sendEmail } = require('../lib/api/email');
const { setAllowedOrigin } = require('../lib/api/cors');

const CONFIGURED_OWNER_EMAIL = process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAILS || '').split(',')[0].trim() || '';
const OWNER_EMAILS = ['iiffund.dev@gmail.com'].map(e => e.toLowerCase());
if (CONFIGURED_OWNER_EMAIL) OWNER_EMAILS.push(CONFIGURED_OWNER_EMAIL.toLowerCase());
const OWNER_EMAIL = CONFIGURED_OWNER_EMAIL || OWNER_EMAILS[0];

function isOwner(email) {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase());
}

function decodeJwtAal(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return payload.aal || 'aal1';
  } catch (e) {
    return 'aal1';
  }
}

async function isAdminMfaEnforced(sb) {
  try {
    const { data } = await sb.from('site_settings').select('value').eq('key', 'admin_enforce_mfa').single();
    if (data?.value === 'true') return true;
  } catch (e) {}
  return process.env.ADMIN_ENFORCE_MFA === 'true';
}

async function checkAdminMfa(req, sb) {
  if (!await isAdminMfaEnforced(sb)) return true;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return false;
  return decodeJwtAal(authHeader.slice(7)) === 'aal2';
}

async function getAdminRoleForUser(sb, userId) {
  try {
    const { data } = await sb.from('admin_roles').select('role').eq('user_id', userId).single();
    return data?.role || null;
  } catch (e) {
    return null;
  }
}

async function getTargetEmailAndRole(sb, userId) {
  let email = '';
  try {
    const { data: profile } = await sb.from('profiles').select('email').eq('id', userId).single();
    if (profile?.email) email = profile.email;
  } catch (e) {}
  if (!email) {
    try {
      const { data: authUser } = await sb.auth.admin.getUserById(userId);
      email = authUser?.email || '';
    } catch (e) {}
  }
  const role = await getAdminRoleForUser(sb, userId);
  return { email, role };
}

function assertNotOwner(email, action) {
  if (isOwner(email)) throw new Error(`Cannot ${action} owner account`);
}

function assertNotAdmin(role, action) {
  if (role) throw new Error(`Cannot ${action} admin account`);
}

async function verifyAdmin(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // Owner fallback
  if (isOwner(user.email)) {
    if (!(await checkAdminMfa(req, sb))) return null;
    return user;
  }
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin', 'support'].includes(role.role)) return null;
  if (!(await checkAdminMfa(req, sb))) return null;
  return user;
}

async function verifyAdminStrict(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  // Owner fallback — always super_admin
  if (isOwner(user.email)) {
    if (!(await checkAdminMfa(req, sb))) return null;
    return user;
  }
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin'].includes(role.role)) return null;
  if (!(await checkAdminMfa(req, sb))) return null;
  return user;
}

async function verifyExecutiveAccess(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  if (isOwner(user.email)) {
    if (!(await checkAdminMfa(req, sb))) return null;
    return user;
  }
  const { data: adminRole } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (adminRole && ['super_admin', 'admin', 'support'].includes(adminRole.role)) {
    if (!(await checkAdminMfa(req, sb))) return null;
    return user;
  }
  const { data: advRole } = await sb.from('advisory_roles').select('role').eq('user_id', user.id).single();
  if (advRole?.role === 'manager') {
    if (!(await checkAdminMfa(req, sb))) return null;
    return user;
  }
  return null;
}

// ── Audit logging ───────────────────────────────────────────
async function getActorRole(sb, admin) {
  if (isOwner(admin.email)) return 'super_admin';
  try {
    const { data } = await sb.from('admin_roles').select('role').eq('user_id', admin.id).single();
    if (data?.role) return data.role;
  } catch (e) {}
  try {
    const { data } = await sb.from('advisory_roles').select('role').eq('user_id', admin.id).single();
    if (data?.role) return data.role;
  } catch (e) {}
  return 'unknown';
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

// ── Security Center ─────────────────────────────────────────
async function getSecurityStatus(sb) {
  const enforceMfa = await isAdminMfaEnforced(sb);
  const ownerEmail = OWNER_EMAILS.join(', ');

  const { data: roles, error: rolesError } = await sb.from('admin_roles').select('*').order('created_at', { ascending: false });
  if (rolesError) throw rolesError;

  const userIds = (roles || []).map(r => r.user_id).filter(Boolean);
  let profileMap = {};
  if (userIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, email, restaurant_name').in('id', userIds);
    (profiles || []).forEach(p => profileMap[p.id] = p);
  }

  // Resolve emails and MFA status in parallel to avoid N+1 sequential auth calls
  const adminUsers = await Promise.all((roles || []).map(async (r) => {
    let email = profileMap[r.user_id]?.email || '';
    if (!email) {
      try {
        const { data: authUser } = await sb.auth.admin.getUserById(r.user_id);
        email = authUser?.email || '';
      } catch (e) {}
    }
    let mfaEnabled = false;
    try {
      const { data: factorData } = await sb.auth.admin.mfa.listFactors({ userId: r.user_id });
      const factors = factorData?.factors || [];
      mfaEnabled = factors.some(f => f.status === 'verified');
    } catch (e) {
      mfaEnabled = false;
    }
    return {
      user_id: r.user_id,
      role: r.role,
      email,
      name: profileMap[r.user_id]?.restaurant_name || 'مستخدم',
      mfa_enabled: mfaEnabled,
      is_owner: isOwner(email),
      created_at: r.created_at
    };
  }));

  const warnings = [];
  if (!ownerEmail) warnings.push('ADMIN_EMAIL غير مُعرَّف في بيئة Vercel.');
  const nonOwnerSuper = adminUsers.filter(u => u.role === 'super_admin' && !u.is_owner);
  if (nonOwnerSuper.length) warnings.push(`يوجد ${nonOwnerSuper.length} حساب super_admin غير المالك.`);
  const adminsWithoutMfa = adminUsers.filter(u => !u.mfa_enabled && u.role !== 'viewer');
  if (adminsWithoutMfa.length) warnings.push(`${adminsWithoutMfa.length} إداري بدون MFA.`);

  const { data: recentLogs } = await sb
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  return { success: true, ownerEmail, enforceMfa, adminUsers, warnings, recentLogs: recentLogs || [] };
}

async function updateSecuritySettings(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  if (!isOwner(admin.email)) throw new Error('Only owner can change security settings');
  const { enforce_mfa } = body;
  const value = enforce_mfa === true || enforce_mfa === 'true' ? 'true' : 'false';
  const { error } = await sb.from('site_settings').upsert({ key: 'admin_enforce_mfa', value, updated_at: new Date().toISOString() });
  if (error) throw error;
  await logAdminAction(sb, admin, 'security_settings_update', 'settings', null, null, { admin_enforce_mfa: value }, req);
  return { success: true, enforceMfa: value === 'true' };
}

// ── Bank Transfers ──────────────────────────────────────────
async function getBankTransfers(sb) {
  const { data, error } = await sb.from('bank_transfer_requests').select('*').order('created_at', { ascending: false }).limit(500);
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

async function getTierPrices(sb) {
  try {
    const settings = await getSettings(sb);
    const pro = parseFloat(settings.price_pro_sar);
    const ent = parseFloat(settings.price_enterprise_sar);
    return {
      pro: !isNaN(pro) && pro > 0 ? pro : 82,
      enterprise: !isNaN(ent) && ent > 0 ? ent : 212
    };
  } catch (e) {
    console.warn('[admin] failed to load tier prices, using defaults:', e);
    return { pro: 82, enterprise: 212 };
  }
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
  const { data, error } = await sb.from('usage_exceptions').select('*, profiles:user_id(email, restaurant_name)').order('created_at', { ascending: false }).limit(500);
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

  const { data: usageData } = await sb.from('usage_logs').select('calculator, user_id, created_at').gte('created_at', thirtyDaysAgo).limit(1000);
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
  const prices = await getTierPrices(sb);
  const stripeRevenue = (activeSubs || []).reduce((sum, s) => sum + (s.tier === 'enterprise' ? prices.enterprise : s.tier === 'pro' ? prices.pro : 0), 0);

  return {
    users: { total: totalUsers, pro: proUsers || 0, enterprise: entUsers || 0, free: Math.max(0, totalUsers - (proUsers || 0) - (entUsers || 0)) },
    usage: { total: usageData?.length || 0, byCalculator: calcStats, byDay: dayStats, topUsers },
    revenue: { stripe: stripeRevenue, bank: bankRevenue, total: stripeRevenue + bankRevenue },
    pendingTransfers: pendingTransfers?.length || 0,
  };
}


// ── Online Users & Journey ──────────────────────────────────
async function getOnlineUsers(sb) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('user_presence')
    .select('session_id, user_id, country, country_code, city, region, page, section, url, user_agent, screen, lang, started_at, last_seen_at, is_online')
    .gte('last_seen_at', fiveMinutesAgo)
    .order('last_seen_at', { ascending: false });
  if (error) throw error;

  const userIds = (data || []).map(p => p.user_id).filter(Boolean);
  let profileMap = {};
  if (userIds.length > 0) {
    try {
      const { data: profiles } = await sb.from('profiles').select('id, email, restaurant_name').in('id', userIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    } catch (e) {}
  }

  const online = (data || []).map(p => ({
    sessionId: p.session_id,
    userId: p.user_id,
    name: profileMap[p.user_id]?.restaurant_name || profileMap[p.user_id]?.email || null,
    email: profileMap[p.user_id]?.email || null,
    country: p.country,
    countryCode: p.country_code,
    city: p.city,
    region: p.region,
    page: p.page,
    section: p.section,
    url: p.url,
    userAgent: p.user_agent,
    screen: p.screen,
    lang: p.lang,
    startedAt: p.started_at,
    lastSeenAt: p.last_seen_at,
    isOnline: p.is_online
  }));

  return { success: true, count: online.length, online };
}

async function getUserActivity(sb, userId) {
  if (!userId) throw new Error('user_id required');

  // Get user profile
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id, email, restaurant_name, phone, country, city, created_at')
    .eq('id', userId)
    .single();
  if (profileError) throw profileError;

  // Get all sessions for this user
  const { data: sessions, error: sessionsError } = await sb
    .from('user_presence')
    .select('session_id, country, country_code, city, page, section, url, user_agent, screen, lang, started_at, last_seen_at, is_online')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(100);
  if (sessionsError) throw sessionsError;

  // Get all page views for this user
  const { data: views, error: viewsError } = await sb
    .from('page_views')
    .select('session_id, page, section, url, country, city, duration_seconds, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (viewsError) throw viewsError;

  // Group views by session
  const viewsBySession = {};
  (views || []).forEach(v => {
    if (!viewsBySession[v.session_id]) viewsBySession[v.session_id] = [];
    viewsBySession[v.session_id].push(v);
  });

  const sessionList = (sessions || []).map(s => {
    const sessionViews = viewsBySession[s.session_id] || [];
    const journey = sessionViews.map((v, i, arr) => {
      const next = arr[i + 1];
      const leftAt = next ? next.created_at : s.last_seen_at;
      const duration = v.duration_seconds || (leftAt ? Math.round((new Date(leftAt).getTime() - new Date(v.created_at).getTime()) / 1000) : null);
      return {
        page: v.page,
        section: v.section,
        url: v.url,
        country: v.country,
        city: v.city,
        enteredAt: v.created_at,
        leftAt,
        durationSeconds: duration
      };
    });
    const totalSeconds = journey.reduce((sum, j) => sum + (j.durationSeconds || 0), 0);
    return {
      sessionId: s.session_id,
      startedAt: s.started_at,
      lastSeenAt: s.last_seen_at,
      isOnline: s.is_online && new Date(s.last_seen_at).getTime() > Date.now() - 5 * 60 * 1000,
      country: s.country,
      countryCode: s.country_code,
      city: s.city,
      device: s.user_agent,
      screen: s.screen,
      lang: s.lang,
      currentPage: s.page,
      journey,
      totalPages: journey.length,
      totalSeconds
    };
  });

  return {
    success: true,
    profile: profile || null,
    sessions: sessionList,
    totalSessions: sessionList.length
  };
}

async function getUserJourney(sb, sessionId) {
  if (!sessionId) throw new Error('session_id required');

  const [{ data: presence }, { data: views }] = await Promise.all([
    sb.from('user_presence').select('*').eq('session_id', sessionId).single(),
    sb.from('page_views')
      .select('page, section, url, referrer, country, city, duration_seconds, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(1000)
  ]);

  const journey = (views || []).map((v, i, arr) => {
    const next = arr[i + 1];
    const leftAt = next ? next.created_at : presence?.last_seen_at;
    const duration = v.duration_seconds || (leftAt ? Math.round((new Date(leftAt).getTime() - new Date(v.created_at).getTime()) / 1000) : null);
    return {
      page: v.page,
      section: v.section,
      url: v.url,
      referrer: v.referrer,
      country: v.country,
      city: v.city,
      enteredAt: v.created_at,
      leftAt,
      durationSeconds: duration
    };
  });

  return {
    success: true,
    presence: presence || null,
    journey,
    totalPages: journey.length,
    totalSeconds: journey.reduce((sum, j) => sum + (j.durationSeconds || 0), 0)
  };
}

// ── Page Views & Sessions ───────────────────────────────────
async function getPageViews(sb) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Views by section/page/day (last 7 days)
  const { data: views7 } = await sb.from('page_views').select('page, section, created_at').gte('created_at', sevenDaysAgo).limit(1000);
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
  const { data: sessions } = await sb.from('page_sessions').select('page, duration_seconds, started_at').gte('started_at', thirtyDaysAgo).limit(1000);
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
async function getAiReviews(sb, admin, params = {}) {
  if (!admin) throw new Error('Admin required');
  const limit = Math.min(parseInt(params.limit) || 50, 200);
  const offset = Math.max(parseInt(params.offset) || 0, 0);
  const status = params.status;

  let query = sb
    .from('ai_review_requests')
    .select(`
      *,
      ai_requests!inner(
        id, type, payload, model, tokens_input, tokens_output, cost_usd, created_at,
        ai_results(result, risk_score)
      ),
      profiles:user_id(email, full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return { data: data || [], total: count || 0 };
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
  if (isOwner(user.email)) {
    if (!(await checkAdminMfa(req, sb))) return null;
    return { user, role: 'super_admin' };
  }
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role) return null;
  if (!(await checkAdminMfa(req, sb))) return null;
  return { user, role: role.role };
}

// ── Messages ────────────────────────────────────────────────
async function getAdminUsers(sb) {
  const { data: roles, error } = await sb.from('admin_roles')
    .select('user_id, role, profiles(id, email, full_name)')
    .in('role', ['super_admin', 'admin'])
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const seen = new Set();
  return (roles || []).map(r => {
    const p = r.profiles || {};
    return {
      id: r.user_id,
      email: p.email || '',
      full_name: p.full_name || '',
      role: r.role
    };
  }).filter(u => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });
}

async function getMessages(sb, params = {}) {
  const limit = Math.min(parseInt(params.limit) || 50, 500);
  const offset = Math.max(parseInt(params.offset) || 0, 0);
  const search = (params.search || '').trim();
  const assignedFilter = (params.assigned || '').trim();
  const currentUserId = params.currentUserId || '';

  let query = sb.from('contact_messages').select('*', { count: 'exact' });
  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,message.ilike.%${search}%`);
  }
  if (assignedFilter === 'me') {
    if (currentUserId) query = query.eq('assigned_to', currentUserId);
  } else if (assignedFilter === 'unassigned') {
    query = query.is('assigned_to', null);
  } else if (assignedFilter && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedFilter)) {
    query = query.eq('assigned_to', assignedFilter);
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  // Enrich messages with assignee profile info in a separate query to avoid FK alias ambiguity.
  let messages = data || [];
  const assigneeIds = [...new Set(messages.map(m => m.assigned_to).filter(Boolean))];
  if (assigneeIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, email, full_name').in('id', assigneeIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    messages = messages.map(m => ({
      ...m,
      assigned_to_profile: m.assigned_to ? profileMap.get(m.assigned_to) || null : null
    }));
  }

  return { success: true, messages, total: count || 0 };
}

async function resolveAssignee(sb, identifier) {
  if (!identifier) return null;
  const value = String(identifier).trim();
  if (!value) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if (isUuid) return value;
  const { data: profiles } = await sb.from('profiles').select('id').eq('email', value).limit(1);
  if (profiles?.length) return profiles[0].id;
  return null;
}

async function updateMessage(sb, body, admin, req) {
  const { action: subAction, id, read, assigned_to } = body;
  if (!id) throw new Error('id required');
  if (subAction === 'mark_read' || read === true) {
    const { error } = await sb.from('contact_messages').update({ read: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    if (admin) await logAdminAction(sb, admin, 'message_mark_read', 'contact_message', id, null, {}, req);
    return { success: true };
  }
  if (subAction === 'mark_unread' || read === false) {
    const { error } = await sb.from('contact_messages').update({ read: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    if (admin) await logAdminAction(sb, admin, 'message_mark_unread', 'contact_message', id, null, {}, req);
    return { success: true };
  }
  if (subAction === 'assign') {
    const assigneeId = await resolveAssignee(sb, assigned_to);
    if (assigned_to && !assigneeId) throw new Error('Assignee not found');
    const update = {
      assigned_to: assigneeId,
      assigned_by: admin?.id || null,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from('contact_messages').update(update).eq('id', id);
    if (error) throw error;
    if (admin) await logAdminAction(sb, admin, 'message_assign', 'contact_message', id, null, { assigned_to: assigneeId }, req);
    return { success: true };
  }
  if (subAction === 'unassign') {
    const { error } = await sb.from('contact_messages').update({
      assigned_to: null,
      assigned_by: null,
      assigned_at: null,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
    if (admin) await logAdminAction(sb, admin, 'message_unassign', 'contact_message', id, null, {}, req);
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

async function sendUserMessage(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { recipient, subject, body: messageBody, send_email } = body;
  if (!recipient || !subject || !messageBody) throw new Error('recipient, subject and body required');

  // Resolve recipient
  let userId = null;
  let userEmail = '';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipient.trim());

  if (isUuid) {
    const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(recipient.trim());
    if (authErr || !authUser) throw new Error('User not found');
    userId = authUser.id;
    userEmail = authUser.email || '';
  } else {
    const email = recipient.trim().toLowerCase();
    const { data: profile } = await sb.from('profiles').select('id, email').eq('email', email).single();
    if (profile) {
      userId = profile.id;
      userEmail = profile.email;
    } else {
      const { data: listData, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) throw listErr;
      const authUser = (listData?.users || []).find(u => u.email?.toLowerCase() === email);
      if (!authUser) throw new Error('User not found');
      userId = authUser.id;
      userEmail = authUser.email;
    }
  }

  if (!userId) throw new Error('User not found');

  // Insert notification
  const { data: notification, error: insertErr } = await sb.from('user_notifications').insert({
    user_id: userId,
    admin_id: admin.id,
    subject,
    body: messageBody,
    read: false,
    email_sent: false
  }).select().single();
  if (insertErr) throw insertErr;

  let emailSent = false;
  let emailDemo = false;
  if (send_email && userEmail) {
    const result = await sendEmail({
      to: userEmail,
      subject,
      text: messageBody,
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;direction:rtl;text-align:right;"><h2>${subject}</h2><p>${messageBody.replace(/\n/g, '<br>')}</p><hr><p style="color:#888;font-size:0.85rem;">تم الإرسال من لوحة تحكم بوندز</p></div>`
    });
    emailSent = result.success;
    emailDemo = result.demo;
    if (emailSent && !emailDemo) {
      await sb.from('user_notifications').update({ email_sent: true }).eq('id', notification.id);
    }
  }

  await logAdminAction(sb, admin, 'send_user_message', 'user_notification', notification.id, userEmail, { user_id: userId, send_email, email_sent: emailSent }, req);
  return { success: true, notification_id: notification.id, email_sent: emailSent, email_demo: emailDemo };
}

async function getSentMessages(sb) {
  const { data, error } = await sb
    .from('user_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const messages = data || [];
  const userIds = messages.map(m => m.user_id).filter(Boolean);
  let profileMap = {};
  if (userIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, email, restaurant_name').in('id', userIds);
    (profiles || []).forEach(p => profileMap[p.id] = p);
  }
  const enriched = messages.map(m => ({
    ...m,
    recipient_email: profileMap[m.user_id]?.email || '',
    recipient_name: profileMap[m.user_id]?.restaurant_name || ''
  }));
  return { success: true, messages: enriched };
}

// ── Roles ───────────────────────────────────────────────────
async function getRoles(sb) {
  const { data: roles, error } = await sb.from('admin_roles').select('*').order('created_at', { ascending: false }).limit(500);
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

  // Security: super_admin is reserved for the owner
  if (role === 'super_admin') {
    if (!isOwner(admin.email)) throw new Error('Only owner can assign super_admin');
    if (!isOwner(email)) throw new Error('super_admin role is reserved for owner');
  }
  if (isOwner(email) && role !== 'super_admin') throw new Error('Owner must be super_admin');

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
  if (roleRow?.role === 'super_admin') throw new Error('Cannot remove super_admin role');
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

async function getProfileCompletenessStats(sb) {
  const [{ count: total }, { count: complete }, { count: partial }, { count: incomplete }] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('profile_completeness', 100),
    sb.from('profiles').select('*', { count: 'exact', head: true }).lt('profile_completeness', 100).gt('profile_completeness', 0),
    sb.from('profiles').select('*', { count: 'exact', head: true }).or('profile_completeness.eq.0,profile_completeness.is.null')
  ]);
  return {
    success: true,
    total: total || 0,
    complete: complete || 0,
    partial: partial || 0,
    incomplete: incomplete || 0
  };
}

async function sendProfileReminder(sb, body, admin, req) {
  const { id } = body || {};
  if (!id) throw new Error('id required');

  const { data: profile, error } = await sb.from('profiles')
    .select('id, email, restaurant_name, profile_completeness, language')
    .eq('id', id)
    .single();
  if (error) throw error;
  if (!profile) throw new Error('User not found');
  if (profile.profile_completeness >= 100) {
    return { success: true, sent: false, message: 'Profile already complete' };
  }

  const lang = profile.language || 'ar';
  const name = profile.restaurant_name || 'مستخدم بوندز';
  const link = lang === 'en'
    ? 'https://bonds-global.com/en/calculators/auth/profile.html'
    : 'https://bonds-global.com/calculators/auth/profile.html';

  const subject = lang === 'en'
    ? 'Complete your Bonds profile'
    : 'أكمل ملفك الشخصي في بوندز';
  const whatsappLink = 'https://wa.me/966567566616?text=' + encodeURIComponent(
    lang === 'en'
      ? 'Hello ' + name + ', please complete your Bonds profile so we can provide better advice: ' + link
      : 'مرحباً ' + name + '، نود تذكيرك بإكمال ملفك الشخصي في بوندز لنقدم لك استشارة أفضل: ' + link
  );
  const html = lang === 'en'
    ? `<div dir="ltr" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;background:#f8f9fa;border-radius:12px;">
        <h2 style="color:#b8954e;">Hello ${name}</h2>
        <p>Your profile is still missing some information. Completing it helps us provide tailored financial advice.</p>
        <p><a href="${link}" style="display:inline-block;padding:0.75rem 1.5rem;background:#b8954e;color:#fff;border-radius:8px;text-decoration:none;">Complete profile</a></p>
        <p>Or <a href="${whatsappLink}" style="color:#16a34a;">contact us on WhatsApp</a>.</p>
        <p style="font-size:0.85rem;color:#555;">Bonds Global</p>
      </div>`
    : `<div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;background:#f8f9fa;border-radius:12px;">
        <h2 style="color:#b8954e;">مرحباً ${name}</h2>
        <p>ملفك الشخصي لا يزال ناقصًا بعض المعلومات. إكماله يساعدنا في تقديم استشارة مالية مخصصة لك.</p>
        <p><a href="${link}" style="display:inline-block;padding:0.75rem 1.5rem;background:#b8954e;color:#fff;border-radius:8px;text-decoration:none;">إكمال الملف الشخصي</a></p>
        <p>أو <a href="${whatsappLink}" style="color:#16a34a;">تواصل معنا عبر واتساب</a>.</p>
        <p style="font-size:0.85rem;color:#555;">بوندز العالمية</p>
      </div>`;

  const result = await sendEmail({
    to: profile.email,
    subject,
    text: subject,
    html
  });
  if (!result.success) throw new Error(result.error || 'Failed to send email');

  await logAdminAction(sb, admin, 'send_profile_reminder', 'user', id, profile.email, { completeness: profile.profile_completeness }, req);
  return { success: true, sent: true, message: 'Reminder sent' };
}

async function getDataQualityReport(sb) {
  const [
    { count: leadsTotal },
    { count: leadsValid },
    { count: leadsInvalid },
    { count: contactsTotal },
    { count: contactsValid },
    { count: contactsInvalid },
    { count: profilesTotal },
    { count: profilesComplete },
    { count: profilesPartial },
    { count: profilesIncomplete }
  ] = await Promise.all([
    sb.from('calculator_leads').select('*', { count: 'exact', head: true }),
    sb.from('calculator_leads').select('*', { count: 'exact', head: true }).eq('validation_status', 'valid'),
    sb.from('calculator_leads').select('*', { count: 'exact', head: true }).neq('validation_status', 'valid'),
    sb.from('contact_messages').select('*', { count: 'exact', head: true }),
    sb.from('contact_messages').select('*', { count: 'exact', head: true }).eq('validation_status', 'valid'),
    sb.from('contact_messages').select('*', { count: 'exact', head: true }).neq('validation_status', 'valid'),
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('profile_completeness', 100),
    sb.from('profiles').select('*', { count: 'exact', head: true }).lt('profile_completeness', 100).gt('profile_completeness', 0),
    sb.from('profiles').select('*', { count: 'exact', head: true }).or('profile_completeness.eq.0,profile_completeness.is.null')
  ]);
  return {
    success: true,
    calculator_leads: { total: leadsTotal || 0, valid: leadsValid || 0, invalid: leadsInvalid || 0 },
    contact_messages: { total: contactsTotal || 0, valid: contactsValid || 0, invalid: contactsInvalid || 0 },
    profiles: { total: profilesTotal || 0, complete: profilesComplete || 0, partial: profilesPartial || 0, incomplete: profilesIncomplete || 0 }
  };
}

async function sendBulkProfileReminders(sb, admin, req) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: profiles, error } = await sb.from('profiles')
    .select('id, email, restaurant_name, profile_completeness, language, profile_reminder_sent_at')
    .lt('profile_completeness', 100)
    .or(`profile_reminder_sent_at.is.null,profile_reminder_sent_at.lt.${sevenDaysAgo}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  const concurrency = 5;
  const queue = (profiles || []).slice();

  async function processOne(profile) {
    if (!profile.email) { failed++; return; }
    try {
      await sendProfileReminder(sb, { id: profile.id }, admin || { id: 'cron', email: 'cron@bonds-global.com' }, req);
      await sb.from('profiles').update({ profile_reminder_sent_at: new Date().toISOString() }).eq('id', profile.id);
      sent++;
    } catch (e) {
      console.error('[bulk-reminder] failed for', profile.email, e.message);
      failed++;
    }
  }

  async function worker() {
    while (queue.length) {
      const profile = queue.shift();
      await processOne(profile);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { success: true, sent, failed, total: (profiles || []).length };
}

async function getUsers(sb, params = {}) {
  const limit = Math.min(parseInt(params.limit) || 50, 500);
  const offset = Math.max(parseInt(params.offset) || 0, 0);
  const search = (params.search || '').trim();
  const tier = params.tier;
  const status = params.status;

  const completeness = params.completeness;

  let query = sb.from('profiles')
    .select('id, restaurant_name, email, phone, country, city, business_type, bio, needs, employee_count, branch_count, tier, tier_expires_at, status, created_at, profile_completeness', { count: 'exact' });

  if (completeness === 'incomplete') query = query.lt('profile_completeness', 100);
  else if (completeness === 'complete') query = query.eq('profile_completeness', 100);
  else if (completeness === 'partial') query = query.lt('profile_completeness', 100).gt('profile_completeness', 0);
  if (search) {
    query = query.or(`email.ilike.%${search}%,restaurant_name.ilike.%${search}%,business_type.ilike.%${search}%`);
  }
  if (tier) query = query.eq('tier', tier);
  if (status) query = query.eq('status', status);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: profileList, error: profileErr, count } = await query;
  if (profileErr) throw profileErr;

  // Map admin roles by user_id for UI guards
  const { data: roleList } = await sb.from('admin_roles').select('user_id, role');
  const roleMap = {};
  (roleList || []).forEach(r => roleMap[r.user_id] = r.role);

  // Fetch auth metadata for the current page in parallel (small N per page)
  const authMap = {};
  await Promise.all((profileList || []).map(async (p) => {
    try {
      const { data } = await sb.auth.admin.getUserById(p.id);
      if (data?.user) authMap[p.id] = data.user;
    } catch (e) {}
  }));

  // Fallback last activity from user_presence when auth last_sign_in_at is null
  const presenceMap = {};
  try {
    const userIds = (profileList || []).map(p => p.id).filter(Boolean);
    if (userIds.length) {
      const { data: presenceRows } = await sb.from('user_presence')
        .select('user_id, last_seen_at')
        .in('user_id', userIds)
        .order('last_seen_at', { ascending: false });
      (presenceRows || []).forEach(r => {
        if (r.user_id && (!presenceMap[r.user_id] || new Date(r.last_seen_at) > new Date(presenceMap[r.user_id]))) {
          presenceMap[r.user_id] = r.last_seen_at;
        }
      });
    }
  } catch (e) {}

  const merged = (profileList || []).map(p => {
    const u = authMap[p.id];
    return {
      id: p.id,
      restaurant_name: p.restaurant_name || u?.user_metadata?.restaurant_name || 'مستخدم جديد',
      email: p.email || u?.email || '',
      phone: p.phone || u?.user_metadata?.phone || u?.phone || '',
      country: p.country || u?.user_metadata?.country || '',
      city: p.city || u?.user_metadata?.city || '',
      business_type: p.business_type || u?.user_metadata?.business_type || '',
      bio: p.bio || u?.user_metadata?.bio || '',
      needs: p.needs || u?.user_metadata?.needs || '',
      employee_count: p.employee_count || parseInt(u?.user_metadata?.employee_count) || 0,
      branch_count: p.branch_count || parseInt(u?.user_metadata?.branch_count) || 1,
      tier: p.tier || 'free',
      tier_expires_at: p.tier_expires_at || null,
      status: p.status || 'active',
      created_at: u?.created_at || p.created_at,
      last_sign_in_at: u?.last_sign_in_at || presenceMap[p.id] || null,
      profile_completeness: p.profile_completeness ?? 0,
      admin_role: roleMap[p.id] || null
    };
  });

  return { success: true, recentUsers: merged, total: count || 0 };
}

async function updateUser(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id, tier, status, city, business_type, bio, needs, employee_count } = body;
  if (!id) throw new Error('id required');

  const { email: targetEmail, role: targetRole } = await getTargetEmailAndRole(sb, id);
  assertNotOwner(targetEmail, 'update');
  if (targetRole && !isOwner(admin.email)) throw new Error('Only owner can modify admin accounts');

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
  await logAdminAction(sb, admin, 'user_update', 'user', id, body.email || targetEmail || null, updates, req);
  return { success: true };
}

async function grantAccess(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id, tier, expires_at, reason } = body;
  if (!id) throw new Error('id required');
  if (!tier || !['free', 'pro', 'enterprise'].includes(tier)) throw new Error('valid tier required');

  const { email: targetEmail, role: targetRole } = await getTargetEmailAndRole(sb, id);
  assertNotOwner(targetEmail, 'grant access to');
  assertNotAdmin(targetRole, 'grant access to');

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

  await logAdminAction(sb, admin, 'grant_access', 'user', id, targetEmail || null, { tier, expires_at, reason }, req);
  return { success: true };
}

async function deleteUser(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id } = body;
  if (!id) throw new Error('id required');
  const { email: targetEmail, role: targetRole } = await getTargetEmailAndRole(sb, id);
  assertNotOwner(targetEmail, 'delete');
  assertNotAdmin(targetRole, 'delete');
  const { error } = await sb.from('profiles').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction(sb, admin, 'user_delete', 'user', id, targetEmail || body.email || null, {}, req);
  return { success: true };
}

async function resetPassword(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id, password } = body;
  if (!id || !password || password.length < 6) throw new Error('id and password (min 6 chars) required');
  const { email: targetEmail, role: targetRole } = await getTargetEmailAndRole(sb, id);
  assertNotOwner(targetEmail, 'reset password for');
  assertNotAdmin(targetRole, 'reset password for');
  const { error } = await sb.auth.admin.updateUserById(id, { password });
  if (error) throw error;
  await logAdminAction(sb, admin, 'user_reset_password', 'user', id, targetEmail || body.email || null, {}, req);
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
const FORCE_RESET_SECRET = (process.env.FORCE_RESET_SECRET || '').trim();

function isAdminEmail(email) {
  if (!email || !ADMIN_EMAIL_PASSWORD) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL_PASSWORD;
}

function verifyForceResetSecret(body) {
  if (!FORCE_RESET_SECRET) throw new Error('Force reset is not configured');
  const secret = String(body?.secret || '').trim();
  if (secret !== FORCE_RESET_SECRET) throw new Error('Unauthorized');
}

async function handleForceReset(sb, body) {
  const { email, password } = body || {};
  verifyForceResetSecret(body);
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

  return {
    success: true,
    message: 'تم تغيير كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.'
  };
}

async function handleResetLink(sb, body) {
  const { email } = body || {};
  verifyForceResetSecret(body);
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
async function getSubscriptions(sb, params = {}) {
  const limit = Math.min(parseInt(params.limit) || 50, 500);
  const offset = Math.max(parseInt(params.offset) || 0, 0);
  const tier = params.tier;
  const status = params.status;

  let query = sb.from('subscriptions').select('user_id, tier, status, current_period_end, created_at', { count: 'exact' });
  if (tier) query = query.eq('tier', tier);
  if (status) query = query.eq('status', status);
  const { data: subs, error: subsError, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (subsError) throw subsError;

  const { count: proCount } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro');
  const { count: entCount } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise');
  const prices = await getTierPrices(sb);
  const monthlyRevenue = (proCount || 0) * prices.pro + (entCount || 0) * prices.enterprise;
  return {
    success: true,
    stats: { proUsers: proCount || 0, enterpriseUsers: entCount || 0, monthlyRevenue },
    recentSubscriptions: subs || [],
    total: count || 0
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
  const prices = await getTierPrices(sb);
  const monthlyRevenue = proUsers * prices.pro + enterpriseUsers * prices.enterprise;
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

// ── Executive Dashboard Stats ───────────────────────────────
async function getExecutiveStats(sb) {
  const [
    { data: subscriptions, error: subscriptionsError },
    { data: profiles, error: profilesError },
    { data: advisoryClients, error: advisoryClientsError },
    { data: advisoryProjects, error: advisoryProjectsError },
    { data: recoveryAssets, error: recoveryAssetsError }
  ] = await Promise.all([
    sb.from('subscriptions').select('status, tier, created_at').order('created_at', { ascending: true }).limit(2000),
    sb.from('profiles').select('created_at').order('created_at', { ascending: true }).limit(2000),
    sb.from('advisory_clients').select('status, created_at').order('created_at', { ascending: true }).limit(2000),
    sb.from('advisory_projects').select('status, budget, start_date, created_at, client_id, advisory_clients(name)').order('created_at', { ascending: false }).limit(1000),
    sb.from('recovery_assets').select('status, original_value, distressed_value, name, category, created_at').order('created_at', { ascending: false }).limit(1000)
  ]);

  const errors = [];
  if (subscriptionsError) errors.push({ key: 'subscriptions', message: subscriptionsError.message });
  if (profilesError) errors.push({ key: 'profiles', message: profilesError.message });
  if (advisoryClientsError) errors.push({ key: 'advisoryClients', message: advisoryClientsError.message });
  if (advisoryProjectsError) errors.push({ key: 'advisoryProjects', message: advisoryProjectsError.message });
  if (recoveryAssetsError) errors.push({ key: 'recoveryAssets', message: recoveryAssetsError.message });

  return {
    success: true,
    subscriptions: subscriptions || [],
    profiles: profiles || [],
    advisoryClients: advisoryClients || [],
    advisoryProjects: advisoryProjects || [],
    recoveryAssets: recoveryAssets || [],
    errors
  };
}

// ── Main Handler ────────────────────────────────────────────
async function handler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  const action = req.query?.action || req.body?.action;

  try {
    // Telemetry/read-heavy actions get a higher rate limit so dashboards can auto-refresh.
    const LIVE_ACTIONS = new Set(['online-users', 'page-views', 'user-journey', 'user-activity']);
    const rateCategory = LIVE_ACTIONS.has(action) ? 'live' : 'strict';
    if (await checkRateLimit(rateCategory, req, res)) return;

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
      if (action === 'executive-stats') {
        const admin = await verifyExecutiveAccess(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getExecutiveStats(sb));
      }
      if (action === 'messages') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const params = {
          limit: req.query?.limit,
          offset: req.query?.offset,
          search: req.query?.search,
          assigned: req.query?.assigned,
          currentUserId: admin?.id || ''
        };
        return res.status(200).json(await getMessages(sb, params));
      }
      if (action === 'admin-users') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json({ success: true, users: await getAdminUsers(sb) });
      }
      if (action === 'sent-messages') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getSentMessages(sb));
      }
      if (action === 'roles') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getRoles(sb));
      }
      if (action === 'me') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const role = await getActorRole(sb, admin);
        return res.status(200).json({ success: true, id: admin.id, email: admin.email, role });
      }
      if (action === 'users') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const params = {
          limit: req.query?.limit,
          offset: req.query?.offset,
          search: req.query?.search,
          tier: req.query?.tier,
          status: req.query?.status,
          completeness: req.query?.completeness
        };
        return res.status(200).json(await getUsers(sb, params));
      }
      if (action === 'profile-completeness-stats') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getProfileCompletenessStats(sb));
      }
      if (action === 'data-quality-report') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getDataQualityReport(sb));
      }
      if (action === 'subscriptions') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const params = {
          limit: req.query?.limit,
          offset: req.query?.offset,
          tier: req.query?.tier,
          status: req.query?.status
        };
        return res.status(200).json(await getSubscriptions(sb, params));
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
      if (action === 'online-users') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getOnlineUsers(sb));
      }
      if (action === 'user-journey') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getUserJourney(sb, req.query?.session_id));
      }
      if (action === 'user-activity') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getUserActivity(sb, req.query?.user_id));
      }
      if (action === 'ai-reviews') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const params = {
          limit: req.query?.limit,
          offset: req.query?.offset,
          status: req.query?.status
        };
        return res.status(200).json(await getAiReviews(sb, admin, params));
      }
      if (action === 'audit-log') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const limit = Math.min(parseInt(req.query?.limit) || 100, 500);
        const offset = parseInt(req.query?.offset) || 0;
        return res.status(200).json(await getAuditLog(sb, { limit, offset }));
      }
      if (action === 'security-status') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getSecurityStatus(sb));
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'POST') {
      if (action === 'force-reset') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
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
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
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
        const subAction = req.body?.action;
        if (subAction === 'send') {
          const admin = await verifyAdminStrict(req, sb);
          if (!admin) return res.status(403).json({ error: 'Admin required' });
          return res.status(200).json(await sendUserMessage(sb, req.body, admin, req));
        }
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
      if (action === 'security-settings') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await updateSecuritySettings(sb, req.body, admin, req));
      }
      if (action === 'send-profile-reminder') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await sendProfileReminder(sb, req.body, admin, req));
      }
      if (action === 'send-profile-reminders-bulk') {
        const cronSecret = req.headers['x-cron-secret'];
        const expectedCronSecret = process.env.CRON_SECRET;
        let admin = null;
        if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
          admin = { id: null, email: 'cron@bonds-global.com' };
        } else {
          admin = await verifyAdmin(req, sb);
          if (!admin) return res.status(403).json({ error: 'Admin or cron required' });
        }
        return res.status(200).json(await sendBulkProfileReminders(sb, admin, req));
      }
      if (action === 'makeOwnerAdmin') {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(403).json({ error: 'Token required' });
        const token = authHeader.slice(7);
        const { data: { user }, error } = await sb.auth.getUser(token);
        if (error || !user) return res.status(403).json({ error: 'Invalid token' });
        if (!isOwner(user.email)) return res.status(403).json({ error: 'Not authorized' });
        // Upsert super_admin (insert or update)
        const { error: upsertErr } = await sb.from('admin_roles')
          .upsert({ user_id: user.id, role: 'super_admin', granted_by: user.id }, { onConflict: 'user_id' });
        if (upsertErr) return res.status(500).json({ error: upsertErr.message });
        await logAdminAction(sb, user, 'owner_claim_super_admin', 'admin_role', user.id, user.email, {}, req);
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

module.exports = handler;
