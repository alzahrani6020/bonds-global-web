/**
 * Unified Admin API
 * Routes: /api/admin?action=bank-transfers|settings|exceptions|analytics
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const getSupabase = require('../lib/api/supabase');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { sendEmail } = require('../lib/api/email');
const { setAllowedOrigin } = require('../lib/api/cors');
const FundingCases = require('../lib/api/funding-cases-admin');
const { logCommercialEvent } = require('../lib/analytics/commercial-events');
const { FinanceWorkspaceService } = require('../lib/finance/accounting/finance-workspace-service');

const CONFIGURED_OWNER_EMAIL = process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAILS || '').split(',')[0].trim() || '';
const OWNER_EMAILS = ['iiffund.dev@gmail.com'].map(e => e.toLowerCase());
if (CONFIGURED_OWNER_EMAIL) OWNER_EMAILS.push(CONFIGURED_OWNER_EMAIL.toLowerCase());
const OWNER_EMAIL = CONFIGURED_OWNER_EMAIL || OWNER_EMAILS[0];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function badRequest(message) { return new HttpError(400, message); }
function unauthorized(message = 'Unauthorized') { return new HttpError(401, message); }
function forbidden(message = 'Forbidden') { return new HttpError(403, message); }
function notFound(message = 'Not found') { return new HttpError(404, message); }

function isOwner(email) {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase());
}

/**
 * Apply the social-media Supabase migrations directly over the Postgres
 * connection (SUPABASE_DB_URL). This avoids needing a Supabase Management API
 * access token and lets the project apply migrations from a secure Vercel
 * endpoint using the CRON_SECRET.
 *
 * Supabase's direct DB host (db.<ref>.supabase.co) is IPv6-only and Vercel
 * serverless functions cannot resolve it, so we rewrite it to the IPv4-enabled
 * session pooler host when needed.
 */
function resolveMigrationDbUrl() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL is not configured in environment variables');
  }

  try {
    const url = new URL(dbUrl);
    const directMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!directMatch) {
      // Already a pooler/custom URL.
      return dbUrl;
    }
    const ref = directMatch[1];
    const poolerHost = process.env.SUPABASE_POOLER_HOST || 'aws-1-eu-central-1.pooler.supabase.com';
    url.hostname = poolerHost;
    url.port = '5432';
    url.username = `postgres.${ref}`;
    return url.toString();
  } catch (err) {
    throw new Error(`Failed to parse SUPABASE_DB_URL: ${err.message}`);
  }
}

function validateMigrationPath(inputPath) {
  if (!inputPath) {
    throw new Error('migration_file is required');
  }

  const normalized = path.posix.normalize(String(inputPath).replace(/\\/g, '/'));

  if (
    normalized.includes('..') ||
    !/^supabase\/migrations\/\d{14}_[A-Za-z0-9._-]+\.sql$/.test(normalized)
  ) {
    throw new Error('Invalid migration file path');
  }

  if (normalized.endsWith('_rollback.sql')) {
    throw new Error('Rollback migrations cannot be applied through this endpoint');
  }

  return normalized;
}

async function fetchMigrationSql(targetFile, commitSha) {
  const sha = String(commitSha || '').trim();

  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error('A valid 40-character commit_sha is required');
  }

  const encodedPath = targetFile
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const url =
    `https://raw.githubusercontent.com/alzahrani6020/bonds-global-web/${sha}/${encodedPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'bonds-global-migration-runner',
      'Accept': 'text/plain'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Migration source fetch failed: HTTP ${response.status}`);
  }

  const sql = await response.text();

  if (!sql.trim()) {
    throw new Error('Migration source is empty');
  }

  if (Buffer.byteLength(sql, 'utf8') > 1024 * 1024) {
    throw new Error('Migration source exceeds 1 MiB limit');
  }

  return sql;
}

async function applyMigration(targetFile, commitSha) {
  const { Client } = require('pg');
  const connectionString = resolveMigrationDbUrl();
  const sql = await fetchMigrationSql(targetFile, commitSha);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw err;
  } finally {
    await client.end();
  }

  return {
    applied: [targetFile],
    count: 1,
    commit: commitSha
  };
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

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (e) {
    return {};
  }
}

async function enforceAdminAccessPolicies(req, sb, user, token, role) {
  const now = new Date().toISOString();
  const payload = decodeJwtPayload(token);
  const sessionId = payload.session_id || payload.sessionId || payload.jti || null;

  let revoked = false;
  if (sessionId) {
    const { data } = await sb.from('admin_revoked_sessions')
      .select('id,expires_at').eq('session_id', sessionId)
      .order('revoked_at', { ascending: false }).limit(10);
    revoked = (data || []).some(r => !r.expires_at || r.expires_at > now);
  }
  if (!revoked) {
    const { data } = await sb.from('admin_revoked_sessions')
      .select('id,session_id,expires_at').eq('user_id', user.id)
      .order('revoked_at', { ascending: false }).limit(50);
    revoked = (data || []).some(r => !r.session_id && (!r.expires_at || r.expires_at > now));
  }
  if (revoked) throw forbidden('Admin session revoked');

  const { data: policies } = await sb.from('admin_access_policies')
    .select('*').eq('enabled', true).order('priority', { ascending: true }).limit(100);
  if (!(policies || []).length) return { sessionId, policy: null };

  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '';
  const country = String(req?.headers?.['x-vercel-ip-country'] || req?.headers?.['cf-ipcountry'] || '').toUpperCase();
  const deviceId = String(req?.headers?.['x-admin-device-id'] || '').trim();

  for (const policy of policies || []) {
    const applies = Array.isArray(policy.applies_to_roles) ? policy.applies_to_roles : [];
    if (applies.length && !applies.includes(role)) continue;
    const deniedCountries = (policy.denied_countries || []).map(x => String(x).toUpperCase());
    const allowedCountries = (policy.allowed_countries || []).map(x => String(x).toUpperCase());
    if (country && deniedCountries.includes(country)) throw forbidden('Access denied by country policy');
    if (allowedCountries.length && (!country || !allowedCountries.includes(country))) throw forbidden('Country not allowed by admin policy');
    if ((policy.denied_ips || []).includes(ip)) throw forbidden('Access denied by IP policy');
    if ((policy.allowed_ips || []).length && !(policy.allowed_ips || []).includes(ip)) throw forbidden('IP not allowed by admin policy');

    if (policy.max_session_minutes && payload.iat) {
      const ageMinutes = (Date.now() / 1000 - Number(payload.iat)) / 60;
      if (ageMinutes > Number(policy.max_session_minutes)) throw forbidden('Admin session expired by policy');
    }

    if (policy.require_trusted_device) {
      if (!deviceId) throw forbidden('Trusted admin device required');
      const { data: device } = await sb.from('admin_trusted_devices')
        .select('id,trusted_until,revoked_at')
        .eq('user_id', user.id).eq('device_fingerprint', deviceId)
        .maybeSingle();
      if (!device || device.revoked_at || (device.trusted_until && device.trusted_until <= now)) {
        throw forbidden('Untrusted admin device');
      }
    }
  }
  return { sessionId, policy: 'enforced' };
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

function generateRequestId() {
  return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function hashUserId(userId) {
  if (!userId) return null;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

function safeAdminLog({ requestId, endpoint, status, authenticated, userId, role, errorCode, duration }) {
  console.log(JSON.stringify({
    requestId: requestId || null,
    endpoint,
    status,
    authenticated: !!authenticated,
    userId: hashUserId(userId),
    role: role || null,
    errorCode: errorCode || null,
    durationMs: duration
  }));
}

function assertNotOwner(email, action) {
  if (isOwner(email)) throw new Error(`Cannot ${action} owner account`);
}

function assertNotAdmin(role, action) {
  if (role) throw new Error(`Cannot ${action} admin account`);
}

async function verifyAdmin(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw unauthorized('Authorization header required');
  const token = authHeader.slice(7);
  let user = null;
  let error = null;
  try {
    const result = await sb.auth.getUser(token);
    user = result.data?.user;
    error = result.error;
  } catch (e) {
    error = e;
  }
  if (error || !user) throw unauthorized('Invalid or expired token');
  // Owner fallback
  if (isOwner(user.email)) {
    if (!(await checkAdminMfa(req, sb))) throw forbidden('MFA required');
    await enforceAdminAccessPolicies(req, sb, user, token, 'super_admin');
    return user;
  }
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin', 'support'].includes(role.role)) throw forbidden('Admin required');
  if (!(await checkAdminMfa(req, sb))) throw forbidden('MFA required');
  await enforceAdminAccessPolicies(req, sb, user, token, role.role);
  return user;
}

async function verifyAdminStrict(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw unauthorized('Authorization header required');
  const token = authHeader.slice(7);
  let user = null;
  let error = null;
  try {
    const result = await sb.auth.getUser(token);
    user = result.data?.user;
    error = result.error;
  } catch (e) {
    error = e;
  }
  if (error || !user) throw unauthorized('Invalid or expired token');
  // Owner fallback — always super_admin
  if (isOwner(user.email)) {
    if (!(await checkAdminMfa(req, sb))) throw forbidden('MFA required');
    await enforceAdminAccessPolicies(req, sb, user, token, 'super_admin');
    return user;
  }
  const { data: role } = await sb.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!role || !['super_admin', 'admin'].includes(role.role)) throw forbidden('Admin required');
  if (!(await checkAdminMfa(req, sb))) throw forbidden('MFA required');
  await enforceAdminAccessPolicies(req, sb, user, token, role.role);
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

async function verifyFundingCaseAccess(req, sb, minAdvisoryRole = null) {
  const admin = await verifyAdmin(req, sb);
  if (admin) return admin;

  if (!minAdvisoryRole) return null;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;

  const { data: advRole } = await sb.from('advisory_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const levels = { viewer: 1, advisor: 2, manager: 3 };
  if (advRole?.role && levels[advRole.role] >= levels[minAdvisoryRole]) {
    if (!(await checkAdminMfa(req, sb))) return null;
    return user;
  }
  return null;
}

// ── Granular RBAC ───────────────────────────────────────────
async function resolveAdminPermissions(sb, user) {
  if (!user) return { role: 'unknown', permissions: [], sources: {} };
  const role = isOwner(user.email) ? 'super_admin' : await getActorRole(sb, user);
  const now = new Date().toISOString();

  const [
    rolePermsRes,
    overridesRes,
    tempRes,
    delegationsRes,
    breakGlassRes
  ] = await Promise.all([
    sb.from('admin_role_permissions').select('permission').eq('role', role),
    sb.from('admin_user_permission_overrides').select('permission, effect, expires_at').eq('user_id', user.id),
    sb.from('admin_temporary_access').select('permission, starts_at, expires_at, revoked_at').eq('user_id', user.id).lte('starts_at', now).gt('expires_at', now).is('revoked_at', null),
    sb.from('admin_delegations').select('permission, starts_at, expires_at, revoked_at').eq('to_user_id', user.id).lte('starts_at', now).gt('expires_at', now).is('revoked_at', null),
    sb.from('admin_break_glass_access').select('id, starts_at, expires_at, revoked_at').eq('user_id', user.id).lte('starts_at', now).gt('expires_at', now).is('revoked_at', null).limit(1)
  ]);

  for (const result of [rolePermsRes, overridesRes, tempRes, delegationsRes, breakGlassRes]) {
    if (result.error) throw result.error;
  }

  const permissionSet = new Set((rolePermsRes.data || []).map(r => r.permission));
  const deniedPermissions = new Set();
  const sources = {};
  for (const p of permissionSet) sources[p] = ['role:' + role];

  for (const row of overridesRes.data || []) {
    if (row.expires_at && row.expires_at <= now) continue;
    if (row.effect === 'deny') {
      deniedPermissions.add(row.permission);
      permissionSet.delete(row.permission);
      sources[row.permission] = ['override:deny'];
    } else {
      permissionSet.add(row.permission);
      sources[row.permission] = [...(sources[row.permission] || []), 'override:allow'];
    }
  }
  for (const row of tempRes.data || []) {
    if (!deniedPermissions.has(row.permission)) {
      permissionSet.add(row.permission);
      sources[row.permission] = [...(sources[row.permission] || []), 'temporary'];
    }
  }
  for (const row of delegationsRes.data || []) {
    if (!deniedPermissions.has(row.permission)) {
      permissionSet.add(row.permission);
      sources[row.permission] = [...(sources[row.permission] || []), 'delegation'];
    }
  }

  const breakGlass = (breakGlassRes.data || []).length > 0;
  if (breakGlass && isOwner(user.email)) {
    const { data: allPerms, error: allPermsError } = await sb.from('admin_permissions').select('permission');
    if (allPermsError) throw allPermsError;
    for (const row of allPerms || []) {
      permissionSet.add(row.permission);
      sources[row.permission] = [...(sources[row.permission] || []), 'break-glass'];
    }
  }

  return { role, permissions: [...permissionSet].sort(), sources, breakGlass };
}

async function requireAdminPermission(req, sb, permission) {
  const user = await verifyAdmin(req, sb);
  const resolved = await resolveAdminPermissions(sb, user);
  if (!resolved.permissions.includes(permission)) {
    throw forbidden('Missing permission: ' + permission);
  }
  return { user, ...resolved };
}

const SECURITY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function simulateAdminPermissions(sb, userId) {
  if (!userId || !SECURITY_UUID_RE.test(String(userId))) throw badRequest('valid user_id required');
  const { data: authUser, error } = await sb.auth.admin.getUserById(userId);
  if (error || !authUser?.user) throw notFound('User not found');
  const user = authUser.user;
  const resolved = await resolveAdminPermissions(sb, user);
  return {
    success: true,
    user: { id: user.id, email: user.email || '' },
    ...resolved
  };
}

async function getSecurityOperationsOverview(sb) {
  const now = Date.now();
  const since24h = new Date(now - 24 * 3600000).toISOString();
  const [
    eventsRes,
    devicesRes,
    tempRes,
    delegationsRes,
    approvalsRes,
    breakGlassRes
  ] = await Promise.all([
    sb.from('admin_security_events').select('*').gte('created_at', since24h).order('created_at', { ascending: false }).limit(1000),
    sb.from('admin_trusted_devices').select('*').is('revoked_at', null).order('last_seen_at', { ascending: false }).limit(1000),
    sb.from('admin_temporary_access').select('*').is('revoked_at', null).order('expires_at', { ascending: true }).limit(1000),
    sb.from('admin_delegations').select('*').is('revoked_at', null).order('expires_at', { ascending: true }).limit(1000),
    sb.from('admin_approval_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(1000),
    sb.from('admin_break_glass_access').select('*').is('revoked_at', null).order('expires_at', { ascending: true }).limit(100)
  ]);
  for (const result of [eventsRes, devicesRes, tempRes, delegationsRes, approvalsRes, breakGlassRes]) {
    if (result.error) throw result.error;
  }
  const events = eventsRes.data || [];
  return {
    success: true,
    summary: {
      events24h: events.length,
      highRiskEvents: events.filter(e => ['high','critical'].includes(e.severity) || Number(e.risk_score || 0) >= 70).length,
      activeTrustedDevices: (devicesRes.data || []).length,
      temporaryGrants: (tempRes.data || []).filter(x => new Date(x.expires_at).getTime() > now).length,
      activeDelegations: (delegationsRes.data || []).filter(x => new Date(x.expires_at).getTime() > now).length,
      pendingApprovals: (approvalsRes.data || []).length,
      breakGlassActive: (breakGlassRes.data || []).filter(x => new Date(x.expires_at).getTime() > now).length
    },
    events,
    trustedDevices: devicesRes.data || [],
    temporaryAccess: tempRes.data || [],
    delegations: delegationsRes.data || [],
    approvals: approvalsRes.data || [],
    breakGlass: breakGlassRes.data || []
  };
}

async function grantTemporaryPermission(sb, body, admin, req) {
  if (!isOwner(admin.email)) throw forbidden('Only owner can grant temporary permissions');
  const userId = body?.user_id;
  const permission = body?.permission;
  const reason = String(body?.reason || '').trim();
  const expiresAt = body?.expires_at;
  if (!userId || !permission || !reason || !expiresAt) throw badRequest('user_id, permission, reason and expires_at required');
  if (!SECURITY_UUID_RE.test(String(userId))) throw badRequest('valid user_id required');
  const expiryMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) throw badRequest('expires_at must be in the future');
  const { data: permissionRow, error: permissionError } = await sb.from('admin_permissions').select('permission').eq('permission', permission).maybeSingle();
  if (permissionError) throw permissionError;
  if (!permissionRow) throw badRequest('unknown permission');

  const { data, error } = await sb.from('admin_temporary_access').insert([{
    user_id: userId,
    permission,
    reason,
    expires_at: expiresAt,
    granted_by: admin.id
  }]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'temporary_permission_grant', 'admin_temporary_access', data.id, null, { user_id: userId, permission, expires_at: expiresAt }, req);
  return { success: true, grant: data };
}

async function createApprovalRequest(sb, body, admin, req) {
  const permission = body?.permission;
  const actionType = String(body?.action_type || '').trim();
  if (!permission || !actionType) throw badRequest('permission and action_type required');
  const row = {
    requested_by: admin.id,
    permission,
    action_type: actionType,
    target_type: body?.target_type || null,
    target_id: body?.target_id || null,
    payload: body?.payload && typeof body.payload === 'object' ? body.payload : {},
    required_approvals: Math.max(1, Math.min(5, Number(body?.required_approvals || 1))),
    expires_at: body?.expires_at || null
  };
  const { data, error } = await sb.from('admin_approval_requests').insert([row]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'approval_request_create', 'admin_approval_request', data.id, null, { permission, action_type: actionType }, req);
  return { success: true, approval: data };
}

async function recordSecurityEvent(sb, admin, req, eventType, severity = 'info', riskScore = 0, details = {}) {
  try {
    const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '';
    const userAgent = req?.headers?.['user-agent'] || '';
    const requestId = req?.headers?.['x-request-id'] || null;
    await sb.from('admin_security_events').insert([{
      user_id: admin?.id || null,
      event_type: eventType,
      severity,
      risk_score: Math.max(0, Math.min(100, Number(riskScore || 0))),
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId,
      details: details && typeof details === 'object' ? details : {}
    }]);
  } catch (e) {
    console.warn('[SecurityEvent] failed:', e.message || e);
  }
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

// ── Admin Operations Inbox ─────────────────────────────────
async function getOperationsOverview(sb) {
  const now = new Date().toISOString();

  const checks = [
    {
      key: 'incompleteProfiles',
      run: () => sb.from('profiles').select('id', { count: 'exact', head: true }).lt('profile_completeness', 100)
    },
    {
      key: 'unreadMessages',
      run: () => sb.from('contact_messages').select('id', { count: 'exact', head: true }).eq('read', false)
    },
    {
      key: 'pendingTransfers',
      run: () => sb.from('bank_transfer_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    },
    {
      key: 'openFundingCases',
      run: () => sb.from('funding_cases').select('id', { count: 'exact', head: true }).is('closed_at', null)
    },
    {
      key: 'overdueFundingCases',
      run: () => sb.from('funding_cases').select('id', { count: 'exact', head: true })
        .is('closed_at', null)
        .lt('sla_deadline_at', now)
    }
  ];

  const results = await Promise.allSettled(checks.map(async ({ key, run }) => {
    const result = await run();
    if (result.error) throw result.error;
    return { key, count: result.count || 0 };
  }));

  const queues = {
    incompleteProfiles: null,
    unreadMessages: null,
    pendingTransfers: null,
    openFundingCases: null,
    overdueFundingCases: null
  };
  const errors = [];

  results.forEach((result, index) => {
    const key = checks[index].key;
    if (result.status === 'fulfilled') {
      queues[key] = result.value.count;
    } else {
      errors.push({
        key,
        message: String(result.reason?.message || result.reason || 'Unavailable').slice(0, 200)
      });
    }
  });

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    status: errors.length ? 'degraded' : 'healthy',
    queues,
    errors
  };
}

// ── Admin Operations Health ─────────────────────────────────
async function getSystemHealth(sb) {
  const startedAt = Date.now();
  const memory = process.memoryUsage();
  const heapStats = require('v8').getHeapStatistics();
  const heapLimit = Number(heapStats.heap_size_limit || 0);
  const mb = value => Math.round((Number(value || 0) / 1024 / 1024) * 10) / 10;

  const envChecks = {
    adminEmail: !!process.env.ADMIN_EMAIL,
    supabaseUrl: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: !!process.env.CRON_SECRET
  };

  const dbStarted = Date.now();
  let database = { status: 'unknown', latencyMs: null, error: null };
  try {
    const { error } = await sb.from('profiles').select('id', { count: 'exact', head: true });
    if (error) throw error;
    database = { status: 'healthy', latencyMs: Date.now() - dbStarted, error: null };
  } catch (error) {
    database = {
      status: 'degraded',
      latencyMs: Date.now() - dbStarted,
      error: String(error?.message || 'Database health check failed').slice(0, 240)
    };
  }

  const heapLimitWarning = heapLimit > 0 && memory.heapUsed / heapLimit >= 0.85;
  const runtime = {
    status: heapLimitWarning ? 'degraded' : 'healthy',
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: mb(memory.rss),
      heapTotalMb: mb(memory.heapTotal),
      heapLimitMb: mb(heapLimit),
      heapUsedMb: mb(memory.heapUsed),
      externalMb: mb(memory.external),
      arrayBuffersMb: mb(memory.arrayBuffers),
      heapUtilizationPct: heapLimit
        ? Math.round((memory.heapUsed / heapLimit) * 1000) / 10
        : null
    }
  };

  const configMissing = Object.entries(envChecks)
    .filter(([, present]) => !present)
    .map(([key]) => key);

  return {
    success: true,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    overall: database.status === 'healthy' && !heapLimitWarning && configMissing.length === 0
      ? 'healthy'
      : 'degraded',
    services: {
      api: { status: 'healthy' },
      database,
      runtime,
      configuration: {
        status: configMissing.length ? 'degraded' : 'healthy',
        checks: envChecks,
        missing: configMissing
      }
    }
  };
}

// ── Security Center ─────────────────────────────────────────
async function getSecurityStatus(sb, admin) {
  const enforceMfa = await isAdminMfaEnforced(sb);
  const ownerEmail = OWNER_EMAILS.join(', ');
  const currentAdmin = admin ? {
    userId: admin.id,
    email: admin.email || '',
    role: await getActorRole(sb, admin),
    isOwner: isOwner(admin.email)
  } : null;

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

  return { success: true, ownerEmail, enforceMfa, currentAdmin, adminUsers, warnings, recentLogs: recentLogs || [] };
}

async function updateSecuritySettings(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  if (!isOwner(admin.email)) throw new Error('Only owner can change security settings');
  const { enforce_mfa } = body;
  const value = enforce_mfa === true || enforce_mfa === 'true' ? 'true' : 'false';

  // Fail closed: never enable the global AAL2 gate unless the owner already has
  // at least one verified MFA factor. This prevents an accidental admin lockout.
  if (value === 'true') {
    const { data: factorData, error: factorError } = await sb.auth.admin.mfa.listFactors({ userId: admin.id });
    if (factorError) throw factorError;
    const factors = factorData?.factors || [];
    if (!factors.some(f => f.status === 'verified')) {
      throw badRequest('Owner MFA must be verified before enforcement can be enabled');
    }
  }
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
  if (request.status !== 'pending') throw new Error('Bank transfer request is already resolved');

  let affectedUserId = null;
  if (action === 'verified') {
    let userId = null;
    const { data: profileUsers } = await sb.from('profiles').select('id').eq('email', request.email).limit(1);
    if (profileUsers?.length) {
      userId = profileUsers[0].id;
    } else {
      const { data: authList } = await sb.auth.admin.listUsers();
      const authUser = (authList?.users || []).find(u => u.email === request.email);
      if (authUser) userId = authUser.id;
    }
    if (!userId) throw new Error('No matching user exists for this bank transfer');

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: subscriptionError } = await sb.from('subscriptions').upsert({
      user_id: userId,
      tier: request.tier,
      status: 'active',
      payment_method: 'bank_transfer',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });
    if (subscriptionError) throw subscriptionError;

    const { error: profileError } = await sb.from('profiles').update({
      tier: request.tier,
      status: 'active',
      updated_at: now.toISOString(),
    }).eq('id', userId);
    if (profileError) throw profileError;

    affectedUserId = userId;
  }

  const { error: requestUpdateError } = await sb.from('bank_transfer_requests')
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (requestUpdateError) throw requestUpdateError;

  await logAdminAction(sb, admin, 'bank_transfer_' + action, 'bank_transfer', id, request.email, { amount_sar: request.amount_sar, tier: request.tier, affected_user_id: affectedUserId }, req);
  if (action === 'verified' && affectedUserId) {
    await logCommercialEvent(sb, 'bank_transfer_activated', {
      userId: affectedUserId,
      properties: { tier: request.tier, amount_sar: request.amount_sar, payment_method: 'bank_transfer' }
    });
  }
  return { success: true, affectedUserId };
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
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

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

  const topUserIds = Object.entries(userStats).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  let topUsers = [];
  if (topUserIds.length) {
    const { data: topProfiles } = await sb.from('profiles').select('id, restaurant_name, email').in('id', topUserIds);
    topUsers = (topProfiles || []).map(p => ({ name: p.restaurant_name || p.email || '—', count: userStats[p.id] || 0 }));
  }

  const { data: pendingTransfers } = await sb.from('bank_transfer_requests').select('*').eq('status', 'pending');

  const { data: verifiedTransfers, error: transferError } = await sb
    .from('bank_transfer_requests')
    .select('amount_sar, updated_at, created_at')
    .eq('status', 'verified')
    .gte('updated_at', monthStartIso);
  if (transferError) throw transferError;
  const bankRevenue = (verifiedTransfers || []).reduce((sum, t) => sum + Number(t.amount_sar || 0), 0);

  const { data: paidInvoices, error: invoiceError } = await sb
    .from('moyasar_invoices')
    .select('amount, paid_at')
    .eq('status', 'paid')
    .gte('paid_at', monthStartIso);
  if (invoiceError) throw invoiceError;
  // Moyasar amounts are persisted in halalas (SAR * 100).
  const electronicRevenue = (paidInvoices || []).reduce((sum, i) => sum + Number(i.amount || 0) / 100, 0);

  const prices = await getTierPrices(sb);
  const recurringRunRate = (proUsers || 0) * prices.pro + (entUsers || 0) * prices.enterprise;
  const actualRevenue = electronicRevenue + bankRevenue;

  return {
    users: { total: totalUsers, pro: proUsers || 0, enterprise: entUsers || 0, free: Math.max(0, totalUsers - (proUsers || 0) - (entUsers || 0)) },
    usage: { total: usageData?.length || 0, byCalculator: calcStats, byDay: dayStats, topUsers },
    revenue: {
      electronic: electronicRevenue,
      bank: bankRevenue,
      total: actualRevenue,
      recurringRunRate,
      basis: 'actual_paid_current_month'
    },
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
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  // ai_review_requests.user_id references auth.users, not profiles directly.
  // Fetch profiles separately instead of relying on a non-existent PostgREST FK.
  const rows = data || [];
  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  let profilesById = new Map();
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await sb
      .from('profiles')
      .select('id,email,full_name')
      .in('id', userIds);
    if (profilesError) {
      console.warn('[admin.ai-reviews] profiles lookup failed:', profilesError.message);
    } else {
      profilesById = new Map((profiles || []).map(p => [p.id, p]));
    }
  }

  return {
    data: rows.map(row => ({ ...row, profiles: profilesById.get(row.user_id) || null })),
    total: count || 0
  };
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

  async function runQuery(useAssignedFilters = true) {
    let q = sb.from('contact_messages').select('*', { count: 'exact' });
    if (search) {
      q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%,message.ilike.%${search}%`);
    }
    if (useAssignedFilters && assignedFilter === 'me') {
      if (currentUserId) q = q.eq('assigned_to', currentUserId);
    } else if (useAssignedFilters && assignedFilter === 'unassigned') {
      q = q.is('assigned_to', null);
    } else if (useAssignedFilters && assignedFilter && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedFilter)) {
      q = q.eq('assigned_to', assignedFilter);
    }
    return q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  }

  let result = await runQuery(true);
  // If assigned_to filtering fails (e.g. migration not applied), fall back to unfiltered query
  // so the messages list keeps working even when the schema is not fully updated.
  if (result.error) {
    result = await runQuery(false);
  }
  if (result.error) throw result.error;

  const { data, count } = result;

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

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayIso = startOfToday.toISOString();

  async function countMessages(applyExtraFilter) {
    let q = sb.from('contact_messages').select('*', { count: 'exact', head: true });
    if (search) q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%,message.ilike.%${search}%`);
    if (assignedFilter === 'me' && currentUserId) q = q.eq('assigned_to', currentUserId);
    else if (assignedFilter === 'unassigned') q = q.is('assigned_to', null);
    else if (assignedFilter && assignedFilter !== 'all' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedFilter)) q = q.eq('assigned_to', assignedFilter);
    if (applyExtraFilter === 'unread') q = q.eq('read', false);
    if (applyExtraFilter === 'today') q = q.gte('created_at', startOfTodayIso);
    const result = await q;
    if (result.error) throw result.error;
    return result.count || 0;
  }

  let unreadTotal = 0;
  let todayTotal = 0;
  try {
    [unreadTotal, todayTotal] = await Promise.all([
      countMessages('unread'),
      countMessages('today')
    ]);
  } catch (countError) {
    // Do not turn a counter failure into a false zero for the whole inbox.
    unreadTotal = null;
    todayTotal = null;
  }

  return {
    success: true,
    messages,
    total: count || 0,
    unread_total: unreadTotal,
    today_total: todayTotal
  };
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
  async function countProfiles() {
    const { count: total, error: totalErr } = await sb.from('profiles').select('*', { count: 'exact', head: true });
    if (totalErr && /column.*profile_completeness|profile_completeness.*column|schema cache/i.test(totalErr.message || '')) {
      return { total: total || 0, complete: 0, partial: 0, incomplete: 0 };
    }
    const [{ count: complete }, { count: partial }, { count: incomplete }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }).eq('profile_completeness', 100),
      sb.from('profiles').select('*', { count: 'exact', head: true }).lt('profile_completeness', 100).gt('profile_completeness', 0),
      sb.from('profiles').select('*', { count: 'exact', head: true }).or('profile_completeness.eq.0,profile_completeness.is.null')
    ]);
    return { total: total || 0, complete: complete || 0, partial: partial || 0, incomplete: incomplete || 0 };
  }

  async function countLeads() {
    const { count: total, error: totalErr } = await sb.from('calculator_leads').select('*', { count: 'exact', head: true });
    if (totalErr && /column.*validation_status|validation_status.*column|schema cache/i.test(totalErr.message || '')) {
      return { total: total || 0, valid: 0, invalid: 0 };
    }
    const [{ count: valid }, { count: invalid }] = await Promise.all([
      sb.from('calculator_leads').select('*', { count: 'exact', head: true }).eq('validation_status', 'valid'),
      sb.from('calculator_leads').select('*', { count: 'exact', head: true }).neq('validation_status', 'valid')
    ]);
    return { total: total || 0, valid: valid || 0, invalid: invalid || 0 };
  }

  async function countContacts() {
    const { count: total, error: totalErr } = await sb.from('contact_messages').select('*', { count: 'exact', head: true });
    if (totalErr && /column.*validation_status|validation_status.*column|schema cache/i.test(totalErr.message || '')) {
      return { total: total || 0, valid: 0, invalid: 0 };
    }
    const [{ count: valid }, { count: invalid }] = await Promise.all([
      sb.from('contact_messages').select('*', { count: 'exact', head: true }).eq('validation_status', 'valid'),
      sb.from('contact_messages').select('*', { count: 'exact', head: true }).neq('validation_status', 'valid')
    ]);
    return { total: total || 0, valid: valid || 0, invalid: invalid || 0 };
  }

  const [profiles, calculator_leads, contact_messages] = await Promise.all([
    countProfiles(),
    countLeads(),
    countContacts()
  ]);

  return { success: true, calculator_leads, contact_messages, profiles };
}

function isReservedTestEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 0) return false;
  const domain = normalized.slice(at + 1);
  return domain === 'example.com'
    || domain === 'example.net'
    || domain === 'example.org'
    || domain === 'localhost'
    || domain.endsWith('.example')
    || domain.endsWith('.invalid')
    || domain.endsWith('.localhost')
    || domain.endsWith('.local');
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
  let skipped = 0;
  const concurrency = 5;
  const queue = (profiles || []).slice();

  async function processOne(profile) {
    if (!profile.email || isReservedTestEmail(profile.email)) {
      skipped++;
      return;
    }
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
  return { success: true, sent, failed, skipped, total: (profiles || []).length };
}

async function getUsers(sb, params = {}) {
  const limit = Math.min(parseInt(params.limit) || 50, 500);
  const offset = Math.max(parseInt(params.offset) || 0, 0);
  const search = (params.search || '').trim();
  const tier = params.tier;
  const status = params.status;
  const completeness = params.completeness;

  function applyFilters(q, includeCompleteness = true) {
    let q2 = q;
    if (includeCompleteness && completeness === 'incomplete') q2 = q2.lt('profile_completeness', 100);
    else if (includeCompleteness && completeness === 'complete') q2 = q2.eq('profile_completeness', 100);
    else if (includeCompleteness && completeness === 'partial') q2 = q2.lt('profile_completeness', 100).gt('profile_completeness', 0);
    if (search) {
      q2 = q2.or(`email.ilike.%${search}%,restaurant_name.ilike.%${search}%,business_type.ilike.%${search}%`);
    }
    if (tier) q2 = q2.eq('tier', tier);
    if (status) q2 = q2.eq('status', status);
    return q2;
  }

  async function runQuery(includeCompleteness = true) {
    const selectCols = includeCompleteness
      ? 'id, restaurant_name, email, phone, country, city, business_type, bio, needs, employee_count, branch_count, tier, tier_expires_at, status, created_at, profile_completeness'
      : 'id, restaurant_name, email, phone, country, city, business_type, bio, needs, employee_count, branch_count, tier, tier_expires_at, status, created_at';
    let q = sb.from('profiles').select(selectCols, { count: 'exact' });
    q = applyFilters(q, includeCompleteness);
    return q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  }

  async function runCount(includeCompleteness = true) {
    let q = sb.from('profiles').select('id', { count: 'exact', head: true });
    q = applyFilters(q, includeCompleteness);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }

  let includeCompleteness = true;
  let result = await runQuery(true);
  // Fallback if profile_completeness column is missing (migration not applied)
  if (result.error && /column.*profile_completeness|profile_completeness.*column|schema cache/i.test(result.error.message || '')) {
    includeCompleteness = false;
    result = await runQuery(false);
  }
  // If requested page offset is beyond total rows, return an empty list with the correct total and pagination metadata.
  const isRangeError = result.error && (
    result.error.code === 'PGRST103' ||
    /PGRST103|range not satisfiable|offset.*requested/i.test(result.error.message || '')
  );
  if (isRangeError) {
    const total = await runCount(includeCompleteness);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const lastPage = Math.max(0, totalPages - 1);
    const page = Math.floor(offset / limit) + 1;
    return {
      success: true,
      recentUsers: [],
      total,
      page,
      pageSize: limit,
      totalPages,
      pageOutOfRange: offset > 0 && offset >= total,
      lastValidOffset: lastPage * limit
    };
  }
  if (result.error) throw result.error;

  const { data: profileList, count } = result;

  // Map admin roles by user_id for UI guards
  const { data: roleList } = await sb.from('admin_roles').select('user_id, role');
  const roleMap = {};
  (roleList || []).forEach(r => roleMap[r.user_id] = r.role);

  // Avoid an auth-admin N+1 fan-out for every row. Profiles are the canonical
  // source for list rendering; auth is consulted only when identity fields are missing.
  // The bounded worker pool protects serverless memory, provider rate limits, and latency.
  const authMap = {};
  const authFallbackQueue = (profileList || []).filter((p) => (
    !p.email ||
    !p.restaurant_name ||
    !p.phone ||
    !p.country ||
    !p.city ||
    !p.business_type
  ));
  const AUTH_LOOKUP_CONCURRENCY = 5;

  async function authFallbackWorker() {
    while (authFallbackQueue.length) {
      const p = authFallbackQueue.shift();
      if (!p) continue;
      try {
        const { data } = await sb.auth.admin.getUserById(p.id);
        if (data?.user) authMap[p.id] = data.user;
      } catch (e) {
        // Degrade gracefully: profile/presence data still produces a usable row.
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(AUTH_LOOKUP_CONCURRENCY, authFallbackQueue.length) },
      () => authFallbackWorker()
    )
  );

  // Last activity comes from presence first; auth metadata is only a fallback.
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
      last_sign_in_at: presenceMap[p.id] || u?.last_sign_in_at || null,
      profile_completeness: p.profile_completeness ?? 0,
      admin_role: roleMap[p.id] || null
    };
  });

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    success: true,
    recentUsers: merged,
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages,
    pageOutOfRange: false,
    lastValidOffset: offset
  };
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
  if (!id) throw badRequest('id required');
  if (!tier || !['free', 'pro', 'enterprise'].includes(tier)) throw badRequest('valid tier required');

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
    created_at: now,
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

async function cancelAccess(sb, body, admin, req) {
  if (!admin) throw new Error('Admin required');
  const { id } = body;
  if (!id) throw new Error('id required');

  const { email: targetEmail, role: targetRole } = await getTargetEmailAndRole(sb, id);
  assertNotOwner(targetEmail, 'cancel access for');
  assertNotAdmin(targetRole, 'cancel access for');

  const now = new Date().toISOString();
  const { error: profileErr } = await sb.from('profiles')
    .update({ tier: 'free', tier_expires_at: null, updated_at: now })
    .eq('id', id);
  if (profileErr) throw profileErr;

  const { error: subErr } = await sb.from('subscriptions')
    .update({ status: 'cancelled', current_period_end: now, updated_at: now })
    .eq('user_id', id);
  if (subErr) throw subErr;

  await logAdminAction(sb, admin, 'cancel_access', 'user', id, targetEmail || null, {}, req);
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
  if (!id) throw badRequest('id required');
  if (!password || password.length < 6) throw badRequest('id and password (min 6 chars) required');
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
  if (!email || !password) throw badRequest('email and password required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('valid email required');
  if (password.length < 6) throw badRequest('Password must be at least 6 characters');

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

  const rawResetLink =
    data.properties?.action_link ||
    data.properties?.recovery_url ||
    null;

  let resetLink = null;

  if (rawResetLink) {
    try {
      const actionUrl = new URL(rawResetLink);
      const configuredSupabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        '';

      const supabaseUrl = new URL(configuredSupabaseUrl);

      if (
        actionUrl.protocol === 'https:' &&
        actionUrl.origin === supabaseUrl.origin
      ) {
        resetLink = actionUrl.toString();
      }
    } catch {
      resetLink = null;
    }
  }

  if (!resetLink) {
    throw new Error('Invalid recovery link generated');
  }

  return {
    success: true,
    resetLink
  };
}

// ── Users 360 / CRM ────────────────────────────────────────
async function getUser360(sb, userId) {
  if (!userId) throw badRequest('user_id required');

  const [
    profileRes,
    subscriptionRes,
    invoicesRes,
    presenceRes,
    messagesRes,
    fundingRes,
    notesRes,
    tagsRes,
    auditRes,
    advisoryClientRes
  ] = await Promise.allSettled([
    sb.from('profiles').select('*').eq('id', userId).single(),
    sb.from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    sb.from('moyasar_invoices').select('id, invoice_id, tier, amount, currency, status, paid_at, created_at, updated_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    sb.from('user_presence').select('session_id, country, country_code, city, page, section, url, user_agent, screen, lang, started_at, last_seen_at, is_online').eq('user_id', userId).order('last_seen_at', { ascending: false }).limit(100),
    sb.from('contact_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    sb.from('funding_cases').select('*').eq('client_user_id', userId).order('created_at', { ascending: false }).limit(100),
    sb.from('admin_customer_notes').select('id, content, created_by, created_at, updated_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    sb.from('admin_customer_tags').select('tag, created_by, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    sb.from('admin_audit_log').select('id, created_at, actor_email, actor_role, action, target_type, target_id, details').eq('target_id', userId).order('created_at', { ascending: false }).limit(100),
    sb.from('advisory_clients').select('*').eq('auth_user_id', userId).limit(1)
  ]);

  const settledData = (result, fallback) => (
    result.status === 'fulfilled' && !result.value?.error ? (result.value?.data ?? fallback) : fallback
  );

  const profile = settledData(profileRes, null);
  if (!profile) throw notFound('User not found');

  const advisoryClientRows = settledData(advisoryClientRes, []);
  const advisoryClient = Array.isArray(advisoryClientRows) ? advisoryClientRows[0] || null : advisoryClientRows;
  let advisoryProjects = [];
  let advisoryNotes = [];
  let advisoryActivity = [];
  let clientDocuments = [];

  if (advisoryClient?.id) {
    const extra = await Promise.allSettled([
      sb.from('advisory_projects').select('*').eq('client_id', advisoryClient.id).order('created_at', { ascending: false }).limit(100),
      sb.from('advisory_notes').select('*').eq('entity_type', 'client').eq('entity_id', advisoryClient.id).order('created_at', { ascending: false }).limit(100),
      sb.from('advisory_activity_logs').select('*').eq('entity_type', 'client').eq('entity_id', advisoryClient.id).order('created_at', { ascending: false }).limit(100),
      sb.from('client_documents').select('id, filename, mime_type, size_bytes, status, created_at, updated_at').eq('client_id', advisoryClient.id).order('created_at', { ascending: false }).limit(100)
    ]);
    advisoryProjects = settledData(extra[0], []);
    advisoryNotes = settledData(extra[1], []);
    advisoryActivity = settledData(extra[2], []);
    clientDocuments = settledData(extra[3], []);
  }

  const subscriptions = settledData(subscriptionRes, []);
  const invoices = settledData(invoicesRes, []);
  const sessions = settledData(presenceRes, []);
  const messages = settledData(messagesRes, []);
  const fundingCases = settledData(fundingRes, []);
  const notes = settledData(notesRes, []);
  const tags = settledData(tagsRes, []);
  const audit = settledData(auditRes, []);

  const lastSeenAt = sessions[0]?.last_seen_at || null;
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const paidAmount = paidInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const openFunding = fundingCases.filter(c => !c.closed_at).length;
  const unreadMessages = messages.filter(m => m.read === false).length;
  const completeness = Number(profile.profile_completeness || 0);
  const activityScore = lastSeenAt
    ? Math.max(0, 100 - Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 86400000) * 3)
    : 0;
  const paymentScore = paidInvoices.length ? 100 : (profile.tier && profile.tier !== 'free' ? 60 : 20);
  const completenessScore = Math.max(0, Math.min(100, completeness));
  const supportPenalty = Math.min(30, unreadMessages * 5);
  const fundingBonus = Math.min(10, openFunding * 2);
  const healthScore = Math.max(0, Math.min(100, Math.round(
    activityScore * 0.35 +
    paymentScore * 0.30 +
    completenessScore * 0.35 -
    supportPenalty +
    fundingBonus
  )));

  const timeline = [];
  const pushTimeline = (type, at, data = {}) => {
    if (at) timeline.push({ type, at, data });
  };
  pushTimeline('user_created', profile.created_at, { email: profile.email || null });
  sessions.forEach(s => pushTimeline('session', s.last_seen_at || s.started_at, { page: s.page, city: s.city, online: s.is_online }));
  subscriptions.forEach(s => pushTimeline('subscription', s.created_at, { tier: s.tier, status: s.status }));
  invoices.forEach(i => pushTimeline('invoice', i.created_at, { invoiceId: i.invoice_id, status: i.status, amount: i.amount, currency: i.currency }));
  messages.forEach(m => pushTimeline('message', m.created_at, { subject: m.subject || null, read: m.read }));
  fundingCases.forEach(c => pushTimeline('funding_case', c.created_at, { id: c.id, status: c.status || null }));
  notes.forEach(n => pushTimeline('internal_note', n.created_at, { id: n.id }));
  audit.forEach(a => pushTimeline('admin_action', a.created_at, { action: a.action, actor: a.actor_email }));
  advisoryActivity.forEach(a => pushTimeline('advisory_activity', a.created_at, { action: a.action }));
  timeline.sort((a, b) => new Date(b.at) - new Date(a.at));

  return {
    success: true,
    profile,
    health: {
      score: healthScore,
      lastSeenAt,
      completeness: completenessScore,
      paidInvoices: paidInvoices.length,
      paidAmount,
      unreadMessages,
      openFundingCases: openFunding
    },
    subscriptions,
    invoices,
    sessions,
    messages,
    fundingCases,
    notes,
    tags,
    audit,
    advisory: {
      client: advisoryClient,
      projects: advisoryProjects,
      notes: advisoryNotes,
      activity: advisoryActivity,
      documents: clientDocuments
    },
    timeline: timeline.slice(0, 250)
  };
}

async function addUser360Note(sb, body, admin, req) {
  const userId = body?.user_id;
  const content = String(body?.content || '').trim();
  if (!userId || !content) throw badRequest('user_id and content required');
  const { data, error } = await sb.from('admin_customer_notes').insert([{
    user_id: userId,
    content: content.slice(0, 5000),
    created_by: admin.id
  }]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'customer_note_add', 'user', userId, null, { note_id: data?.id }, req);
  return { success: true, note: data };
}

async function setUser360Tags(sb, body, admin, req) {
  const userId = body?.user_id;
  if (!userId) throw badRequest('user_id required');
  const tags = [...new Set((Array.isArray(body?.tags) ? body.tags : [])
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean)
    .map(v => v.slice(0, 64)))].slice(0, 50);

  const { error: deleteError } = await sb.from('admin_customer_tags').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (tags.length) {
    const { error: insertError } = await sb.from('admin_customer_tags').insert(
      tags.map(tag => ({ user_id: userId, tag, created_by: admin.id }))
    );
    if (insertError) throw insertError;
  }
  await logAdminAction(sb, admin, 'customer_tags_update', 'user', userId, null, { tags }, req);
  return { success: true, tags };
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

// ── CRM Operations ──────────────────────────────────────────
async function getCrmOverview(sb) {
  const [
    orgsRes,
    clientsRes,
    oppsRes,
    renewalsRes,
    successRes,
    serviceRequestsRes
  ] = await Promise.all([
    sb.from('crm_organizations').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('advisory_clients').select('id, name, email, phone, company_name, status, source, organization_id, is_decision_maker, relationship_role, account_owner, created_at, updated_at').order('created_at', { ascending: false }).limit(1000),
    sb.from('crm_opportunities').select('*').order('updated_at', { ascending: false }).limit(1000),
    sb.from('crm_renewals').select('*').order('renewal_date', { ascending: true }).limit(1000),
    sb.from('crm_customer_success').select('*').order('updated_at', { ascending: false }).limit(1000),
    sb.from('service_requests')
      .select('id,request_reference,user_id,client_id,service_id,status,country_code,region_name,locality_name,crm_opportunity_id,submitted_at,completed_at,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(1000)
  ]);
  for (const result of [orgsRes, clientsRes, oppsRes, renewalsRes, successRes, serviceRequestsRes]) {
    if (result.error) throw result.error;
  }

  const opportunities = oppsRes.data || [];
  const pipeline = {};
  for (const stage of ['lead','qualified','proposal','negotiation','won','lost']) {
    const rows = opportunities.filter(o => o.stage === stage);
    pipeline[stage] = {
      count: rows.length,
      value: rows.reduce((sum, o) => sum + Number(o.value_amount || 0), 0),
      weightedValue: rows.reduce((sum, o) => sum + Number(o.value_amount || 0) * Number(o.probability || 0) / 100, 0)
    };
  }

  const now = Date.now();
  const next90 = now + 90 * 86400000;
  const renewals = renewalsRes.data || [];
  const renewalSummary = {
    due30: renewals.filter(r => {
      const t = new Date(r.renewal_date).getTime();
      return t >= now && t <= now + 30 * 86400000;
    }).length,
    due90: renewals.filter(r => {
      const t = new Date(r.renewal_date).getTime();
      return t >= now && t <= next90;
    }).length,
    atRisk: renewals.filter(r => ['high','critical'].includes(r.risk_level)).length
  };

  const success = successRes.data || [];
  const customerSuccess = {
    accounts: success.length,
    averageHealth: success.length
      ? Math.round(success.reduce((sum, row) => sum + Number(row.health_score || 0), 0) / success.length)
      : 0,
    atRisk: success.filter(row => ['high','critical'].includes(row.risk_level) || row.lifecycle_stage === 'at_risk').length
  };

  const serviceRequests = serviceRequestsRes.data || [];
  const serviceIds = [...new Set(serviceRequests.map(row => row.service_id).filter(Boolean))];
  let serviceCatalog = [];
  if (serviceIds.length) {
    const { data, error } = await sb.from('service_catalog')
      .select('id,code,name_ar,name_en,category_code,group_code')
      .in('id', serviceIds);
    if (error) throw error;
    serviceCatalog = data || [];
  }
  const serviceMap = new Map(serviceCatalog.map(row => [row.id, row]));
  const clientMap = new Map((clientsRes.data || []).map(row => [row.id, row]));
  const opportunityMap = new Map(opportunities.map(row => [row.id, row]));
  const serviceRequestQueue = serviceRequests.map(row => ({
    ...row,
    service: serviceMap.get(row.service_id) || null,
    client: clientMap.get(row.client_id) || null,
    opportunity: opportunityMap.get(row.crm_opportunity_id) || null
  }));

  return {
    success: true,
    organizations: orgsRes.data || [],
    clients: clientsRes.data || [],
    opportunities,
    renewals,
    customerSuccessRecords: success,
    serviceRequests: serviceRequestQueue,
    pipeline,
    renewalSummary,
    customerSuccess
  };
}

async function createCrmOrganization(sb, body, admin, req) {
  const name = String(body?.name || '').trim();
  if (!name) throw badRequest('name required');
  const row = {
    name: name.slice(0, 240),
    legal_name: body?.legal_name || null,
    domain: body?.domain || null,
    country: body?.country || null,
    city: body?.city || null,
    sector: body?.sector || null,
    tax_number: body?.tax_number || null,
    owner_user_id: body?.owner_user_id || admin.id,
    status: body?.status || 'prospect',
    metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    created_by: admin.id
  };
  const { data, error } = await sb.from('crm_organizations').insert([row]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'crm_organization_create', 'crm_organization', data.id, null, { name: data.name }, req);
  return { success: true, organization: data };
}

async function createCrmOpportunity(sb, body, admin, req) {
  const title = String(body?.title || '').trim();
  if (!title) throw badRequest('title required');
  const row = {
    organization_id: body?.organization_id || null,
    client_id: body?.client_id || null,
    title: title.slice(0, 240),
    stage: body?.stage || 'lead',
    value_amount: Number(body?.value_amount || 0),
    currency: String(body?.currency || 'SAR').slice(0, 8),
    probability: Math.max(0, Math.min(100, Number(body?.probability ?? 10))),
    expected_close_date: body?.expected_close_date || null,
    source: body?.source || null,
    owner_user_id: body?.owner_user_id || admin.id,
    next_action: body?.next_action || null,
    next_action_at: body?.next_action_at || null,
    created_by: admin.id
  };
  const { data, error } = await sb.from('crm_opportunities').insert([row]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'crm_opportunity_create', 'crm_opportunity', data.id, null, { stage: data.stage, value_amount: data.value_amount }, req);
  return { success: true, opportunity: data };
}

async function updateCrmOpportunity(sb, body, admin, req) {
  const id = body?.id;
  if (!id) throw badRequest('id required');
  const allowed = ['stage','value_amount','currency','probability','expected_close_date','owner_user_id','next_action','next_action_at','lost_reason'];
  const updates = { updated_at: new Date().toISOString() };
  for (const key of allowed) if (body[key] !== undefined) updates[key] = body[key];
  if (updates.probability !== undefined) updates.probability = Math.max(0, Math.min(100, Number(updates.probability)));
  const { data, error } = await sb.from('crm_opportunities').update(updates).eq('id', id).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'crm_opportunity_update', 'crm_opportunity', id, null, updates, req);
  return { success: true, opportunity: data };
}

const SERVICE_REQUEST_STATUSES = new Set([
  'draft',
  'submitted',
  'triage',
  'in_progress',
  'awaiting_client',
  'awaiting_approval',
  'completed',
  'cancelled'
]);

async function updateServiceRequestStatus(sb, body, admin, req) {
  const id = body?.id;
  const status = String(body?.status || '').trim();
  if (!id) throw badRequest('id required');
  if (!SERVICE_REQUEST_STATUSES.has(status)) throw badRequest('invalid service request status');

  const { data: before, error: beforeError } = await sb.from('service_requests')
    .select('id,user_id,status,request_reference,crm_opportunity_id,completed_at')
    .eq('id', id)
    .maybeSingle();
  if (beforeError) throw beforeError;
  if (!before) throw new HttpError(404, 'Service request not found');

  const updates = { status, updated_at: new Date().toISOString() };
  if (status === 'completed' && !before.completed_at) updates.completed_at = new Date().toISOString();
  if (status !== 'completed' && before.completed_at) updates.completed_at = null;

  const { data, error } = await sb.from('service_requests')
    .update(updates)
    .eq('id', id)
    .select('id,request_reference,status,crm_opportunity_id,submitted_at,completed_at,updated_at')
    .single();
  if (error) throw error;

  await logAdminAction(
    sb,
    admin,
    'service_request_status_update',
    'service_request',
    id,
    { status: before.status },
    { status: data.status, request_reference: data.request_reference },
    req
  );

  let notification = null;
  if (before.status !== data.status && before.user_id) {
    const statusMessages = {
      submitted: {
        subject: 'تم استلام طلب الخدمة',
        body: 'تم استلام طلب الخدمة رقم ' + data.request_reference + ' وسيتم مراجعته من فريق بوندز.'
      },
      triage: {
        subject: 'طلب الخدمة قيد الفرز',
        body: 'طلب الخدمة رقم ' + data.request_reference + ' قيد الفرز وتحديد مسار التنفيذ المناسب.'
      },
      in_progress: {
        subject: 'بدأ تنفيذ طلب الخدمة',
        body: 'بدأ العمل على طلب الخدمة رقم ' + data.request_reference + '.'
      },
      awaiting_client: {
        subject: 'مطلوب إجراء منك على طلب الخدمة',
        body: 'طلب الخدمة رقم ' + data.request_reference + ' بانتظار معلومات أو مستندات منك. راجع حالة الطلب في مساحتي وتواصل مع فريق بوندز لاستكمال المطلوب.'
      },
      awaiting_approval: {
        subject: 'طلب الخدمة بانتظار الاعتماد',
        body: 'طلب الخدمة رقم ' + data.request_reference + ' وصل إلى مرحلة الاعتماد النهائي.'
      },
      completed: {
        subject: 'اكتمل طلب الخدمة',
        body: 'تم إكمال طلب الخدمة رقم ' + data.request_reference + '.'
      },
      cancelled: {
        subject: 'تم إلغاء طلب الخدمة',
        body: 'تم تحديث طلب الخدمة رقم ' + data.request_reference + ' إلى ملغي.'
      }
    };
    const message = statusMessages[data.status];
    if (message) {
      const { data: insertedNotification, error: notificationError } = await sb.from('user_notifications')
        .insert({
          user_id: before.user_id,
          admin_id: admin.id,
          subject: message.subject,
          body: message.body,
          read: false,
          email_sent: false
        })
        .select('id,user_id,subject,read,created_at')
        .single();
      if (notificationError) throw notificationError;
      notification = insertedNotification;
    }
  }

  return { success: true, serviceRequest: data, notification };
}

async function upsertCrmCustomerSuccess(sb, body, admin, req) {
  const organizationId = body?.organization_id || null;
  const clientId = body?.client_id || null;
  if (!organizationId && !clientId) throw badRequest('organization_id or client_id required');
  const row = {
    organization_id: organizationId,
    client_id: clientId,
    owner_user_id: body?.owner_user_id || admin.id,
    health_score: Math.max(0, Math.min(100, Number(body?.health_score ?? 50))),
    risk_level: body?.risk_level || 'low',
    lifecycle_stage: body?.lifecycle_stage || 'onboarding',
    next_review_at: body?.next_review_at || null,
    success_plan: body?.success_plan && typeof body.success_plan === 'object' ? body.success_plan : {},
    updated_at: new Date().toISOString()
  };
  const { data, error } = await sb.from('crm_customer_success')
    .upsert(row, { onConflict: 'organization_id,client_id' })
    .select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'crm_customer_success_update', 'crm_customer_success', data.id, null, { health_score: data.health_score, risk_level: data.risk_level }, req);
  return { success: true, customerSuccess: data };
}

// ── Support Center ──────────────────────────────────────────
const SUPPORT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORT_PRIORITIES = new Set(['low','normal','high','urgent','critical']);
const SUPPORT_STATUSES = new Set(['open','in_progress','waiting_customer','resolved','closed']);

function supportOptionalUuid(value, field) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  if (!SUPPORT_UUID_RE.test(normalized)) throw badRequest(field + ' must be a valid UUID');
  return normalized;
}

function supportSlaHours(priority) {
  return ({ low: 72, normal: 24, high: 8, urgent: 4, critical: 1 })[priority] || 24;
}

async function getSupportOverview(sb) {
  const { data: tickets, error } = await sb.from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;

  const rows = tickets || [];
  const now = Date.now();
  const open = rows.filter(t => !['resolved','closed'].includes(t.status));
  const summary = {
    open: open.length,
    unassigned: open.filter(t => !t.assigned_to).length,
    breached: open.filter(t => t.sla_due_at && new Date(t.sla_due_at).getTime() < now).length,
    critical: open.filter(t => ['urgent','critical'].includes(t.priority)).length,
    escalated: open.filter(t => Number(t.escalation_level || 0) > 0).length
  };

  return { success: true, tickets: rows, summary };
}

async function createSupportTicket(sb, body, admin, req) {
  const subject = String(body?.subject || '').trim();
  if (!subject) throw badRequest('subject required');
  const priority = body?.priority || 'normal';
  if (!SUPPORT_PRIORITIES.has(priority)) throw badRequest('invalid priority');
  const status = body?.status || 'open';
  if (!SUPPORT_STATUSES.has(status)) throw badRequest('invalid status');
  const hours = supportSlaHours(priority);
  const slaDueAt = body?.sla_due_at || new Date(Date.now() + hours * 3600000).toISOString();
  const row = {
    user_id: supportOptionalUuid(body?.user_id, 'user_id'),
    advisory_client_id: supportOptionalUuid(body?.advisory_client_id, 'advisory_client_id'),
    subject: subject.slice(0, 300),
    description: String(body?.description || '').slice(0, 10000) || null,
    status,
    priority,
    assigned_to: supportOptionalUuid(body?.assigned_to, 'assigned_to'),
    created_by: admin.id,
    source: body?.source || 'admin',
    request_id: body?.request_id || null,
    error_code: body?.error_code || null,
    related_url: body?.related_url || null,
    sla_due_at: slaDueAt
  };
  const { data, error } = await sb.from('support_tickets').insert([row]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'support_ticket_create', 'support_ticket', data.id, null, { priority, user_id: row.user_id, request_id: row.request_id }, req);
  return { success: true, ticket: data };
}

async function updateSupportTicket(sb, body, admin, req) {
  const id = body?.id;
  if (!id) throw badRequest('id required');
  const allowed = ['sla_due_at','request_id','error_code','related_url'];
  const updates = { updated_at: new Date().toISOString() };
  for (const key of allowed) if (body[key] !== undefined) updates[key] = body[key];

  if (body?.status !== undefined) {
    if (!SUPPORT_STATUSES.has(body.status)) throw badRequest('invalid status');
    updates.status = body.status;
  }
  if (body?.priority !== undefined) {
    if (!SUPPORT_PRIORITIES.has(body.priority)) throw badRequest('invalid priority');
    updates.priority = body.priority;
  }
  if (body?.assigned_to !== undefined) updates.assigned_to = supportOptionalUuid(body.assigned_to, 'assigned_to');
  if (body?.escalation_level !== undefined) {
    const level = Number(body.escalation_level);
    if (!Number.isInteger(level) || level < 0 || level > 5) throw badRequest('invalid escalation_level');
    updates.escalation_level = level;
    if (level > 0) updates.escalated_at = new Date().toISOString();
    if (level === 0) updates.escalated_at = null;
  }

  if (body?.status === 'resolved' && !body?.resolved_at) updates.resolved_at = new Date().toISOString();
  if (body?.escalate === true) {
    updates.escalation_level = Math.min(5, Math.max(1, Number(body?.escalation_level || 1)));
    updates.escalated_at = new Date().toISOString();
  }
  if (body?.priority && body?.recalculate_sla === true) {
    updates.sla_due_at = new Date(Date.now() + supportSlaHours(body.priority) * 3600000).toISOString();
  }

  const { data, error } = await sb.from('support_tickets').update(updates).eq('id', id).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'support_ticket_update', 'support_ticket', id, null, updates, req);
  return { success: true, ticket: data };
}

async function getSupportTicketDetail(sb, ticketId) {
  if (!ticketId) throw badRequest('ticket_id required');
  const [{ data: ticket, error }, { data: notes, error: notesError }] = await Promise.all([
    sb.from('support_tickets').select('*').eq('id', ticketId).single(),
    sb.from('support_ticket_notes').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }).limit(500)
  ]);
  if (error) throw error;
  if (notesError) throw notesError;
  return { success: true, ticket, notes: notes || [] };
}

async function addSupportNote(sb, body, admin, req) {
  const ticketId = body?.ticket_id;
  const content = String(body?.content || '').trim();
  if (!ticketId || !content) throw badRequest('ticket_id and content required');

  const { data: note, error } = await sb.from('support_ticket_notes').insert([{
    ticket_id: ticketId,
    content: content.slice(0, 10000),
    is_internal: body?.is_internal !== false,
    created_by: admin.id
  }]).select().single();
  if (error) throw error;

  const rawMentionIds = [...new Set((Array.isArray(body?.mention_user_ids) ? body.mention_user_ids : []).filter(Boolean))].slice(0, 25);
  const mentionIds = rawMentionIds.map(value => supportOptionalUuid(value, 'mention_user_ids'));
  if (mentionIds.length) {
    const { error: mentionError } = await sb.from('support_ticket_mentions').insert(
      mentionIds.map(userId => ({
        ticket_id: ticketId,
        note_id: note.id,
        mentioned_user_id: userId
      }))
    );
    if (mentionError) throw mentionError;
  }

  await logAdminAction(sb, admin, 'support_note_add', 'support_ticket', ticketId, null, { note_id: note.id, mentions: mentionIds }, req);
  return { success: true, note };
}

// ── Finance Operations ─────────────────────────────────────
const FINANCE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINANCE_REFUND_STATUSES = new Set(['requested','approved','processing','completed','rejected','failed']);
const FINANCE_RECON_SOURCE_TYPES = new Set(['invoice','bank_transfer','subscription','manual']);
const FINANCE_RECON_STATUSES = new Set(['unmatched','matched','variance','ignored','resolved']);
const FINANCE_EXCEPTION_SEVERITIES = new Set(['low','medium','high','critical']);

function financeOptionalUuid(value, field) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  if (!FINANCE_UUID_RE.test(normalized)) throw badRequest(field + ' must be a valid UUID');
  return normalized;
}

function financeCurrency(value) {
  const currency = String(value || 'SAR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw badRequest('currency must be a 3-letter ISO code');
  return currency;
}

async function requireFinanceApprover(sb, admin) {
  const role = await getActorRole(sb, admin);
  if (role !== 'super_admin') throw forbidden('Super admin required for refund approval');
}

async function getFinanceOverview(sb, userId, query = {}) {
  const service = new FinanceWorkspaceService(sb);
  return service.overview({
    userId,
    accountingEntityId: query.accounting_entity_id,
    from: query.from,
    to: query.to
  });
}

async function createFinanceRefund(sb, body, admin, req) {
  const service = new FinanceWorkspaceService(sb);
  const result = await service.createRefundRequest({
    userId: admin.id,
    accountingEntityId: body?.accounting_entity_id,
    sourceFinancialEventId: body?.source_financial_event_id,
    amount: body?.amount,
    reason: body?.reason,
    requestKey: body?.request_key
  });
  const refund = result.refund;
  await logAdminAction(sb, admin, 'finance_refund_request', 'finance_refund', refund.id, null, {
    accounting_entity_id: refund.accounting_entity_id,
    source_financial_event_id: refund.source_financial_event_id,
    amount: refund.amount,
    replayed: result.replayed === true
  }, req);
  return { success: true, refund, replayed: result.replayed === true };
}

async function updateFinanceRefund(sb, body, admin, req) {
  const id = financeOptionalUuid(body?.id, 'id');
  const status = body?.status;
  if (!id || !status) throw badRequest('id and status required');
  if (!FINANCE_REFUND_STATUSES.has(status)) throw badRequest('invalid refund status');

  const { data: current, error: currentError } = await sb.from('finance_refunds')
    .select('*').eq('id', id).single();
  if (currentError) throw currentError;

  const service = new FinanceWorkspaceService(sb);
  await service.assertEntityAccess(admin.id, current.accounting_entity_id);

  const transitions = {
    requested: new Set(['approved','rejected']),
    approved: new Set(['processing']),
    processing: new Set(['completed','failed']),
    completed: new Set(),
    rejected: new Set(),
    failed: new Set()
  };
  if (!transitions[current.status]?.has(status)) {
    throw badRequest('invalid refund status transition');
  }

  if (status === 'completed') {
    if (!current.approved_by) throw badRequest('refund must be approved before completion');
    const completed = await service.completeRefund({ userId: admin.id, refund: current, actorId: admin.id });
    await logAdminAction(sb, admin, 'finance_refund_update', 'finance_refund', id, null, {
      from_status: current.status,
      to_status: status,
      financial_event_id: completed.refund.financial_event_id
    }, req);
    return { success: true, refund: completed.refund, replayed: completed.replayed === true };
  }

  const updates = { status, updated_at: new Date().toISOString() };
  if (status === 'approved') {
    await requireFinanceApprover(sb, admin);
    if (current.requested_by && current.requested_by === admin.id) {
      throw forbidden('Refund requester cannot approve the same refund');
    }
    updates.approved_by = admin.id;
  }
  if (status === 'processing' && !current.approved_by) {
    throw badRequest('refund must be approved before processing');
  }

  const { data, error } = await sb.from('finance_refunds').update(updates)
    .eq('id', id)
    .eq('accounting_entity_id', current.accounting_entity_id)
    .select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'finance_refund_update', 'finance_refund', id, null, {
    from_status: current.status,
    to_status: status,
    approved_by: updates.approved_by || current.approved_by || null
  }, req);
  return { success: true, refund: data };
}

async function upsertReconciliationItem(sb, body, admin, req) {
  const accountingEntityId = financeOptionalUuid(body?.accounting_entity_id, 'accounting_entity_id');
  if (!accountingEntityId) throw badRequest('accounting_entity_id required');
  const service = new FinanceWorkspaceService(sb);
  await service.assertEntityAccess(admin.id, accountingEntityId);
  const sourceType = body?.source_type;
  const sourceId = String(body?.source_id || '').trim();
  if (!sourceType || !sourceId) throw badRequest('source_type and source_id required');
  if (!FINANCE_RECON_SOURCE_TYPES.has(sourceType)) throw badRequest('invalid reconciliation source_type');
  const reconStatus = body?.status || 'unmatched';
  if (!FINANCE_RECON_STATUSES.has(reconStatus)) throw badRequest('invalid reconciliation status');
  const expectedAmount = body?.expected_amount == null ? null : Number(body.expected_amount);
  const actualAmount = body?.actual_amount == null ? null : Number(body.actual_amount);
  if (expectedAmount != null && !Number.isFinite(expectedAmount)) throw badRequest('invalid expected_amount');
  if (actualAmount != null && !Number.isFinite(actualAmount)) throw badRequest('invalid actual_amount');
  const row = {
    accounting_entity_id: accountingEntityId,
    source_type: sourceType,
    source_id: sourceId.slice(0, 250),
    expected_amount: expectedAmount,
    actual_amount: actualAmount,
    currency: financeCurrency(body?.currency),
    status: reconStatus,
    notes: body?.notes || null,
    resolved_by: ['resolved','matched','ignored'].includes(reconStatus) ? admin.id : null,
    resolved_at: ['resolved','matched','ignored'].includes(reconStatus) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await sb.from('finance_reconciliation_items')
    .upsert(row, { onConflict: 'accounting_entity_id,source_type,source_id' }).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'finance_reconciliation_upsert', 'finance_reconciliation', data.id, null, { source_type: sourceType, source_id: sourceId, status: data.status }, req);
  return { success: true, reconciliation: data };
}

async function createRevenueException(sb, body, admin, req) {
  const accountingEntityId = financeOptionalUuid(body?.accounting_entity_id, 'accounting_entity_id');
  if (!accountingEntityId) throw badRequest('accounting_entity_id required');
  const service = new FinanceWorkspaceService(sb);
  const entityAccess = await service.assertEntityAccess(admin.id, accountingEntityId);
  const category = String(body?.category || '').trim();
  const description = String(body?.description || '').trim();
  if (!category || !description) throw badRequest('category and description required');
  const severity = body?.severity || 'medium';
  if (!FINANCE_EXCEPTION_SEVERITIES.has(severity)) throw badRequest('invalid severity');
  const amountImpact = Number(body?.amount_impact || 0);
  if (!Number.isFinite(amountImpact)) throw badRequest('invalid amount_impact');
  const row = {
    accounting_entity_id: accountingEntityId,
    user_id: financeOptionalUuid(body?.user_id, 'user_id'),
    organization_id: financeOptionalUuid(body?.organization_id, 'organization_id'),
    category: category.slice(0, 120),
    description: description.slice(0, 5000),
    amount_impact: amountImpact,
    currency: financeCurrency(body?.currency || entityAccess.entity.base_currency),
    severity,
    status: 'open',
    owner_user_id: financeOptionalUuid(body?.owner_user_id, 'owner_user_id') || admin.id,
    request_id: body?.request_id || null
  };
  const { data, error } = await sb.from('finance_revenue_exceptions').insert([row]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'finance_revenue_exception_create', 'finance_revenue_exception', data.id, null, { severity: data.severity, amount_impact: data.amount_impact }, req);
  return { success: true, exception: data };
}

// ── Feature Flags / Entitlements / Automation ───────────────
const AUTOMATION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FEATURE_FLAG_KEY_RE = /^[a-z0-9][a-z0-9._-]{1,119}$/i;
const WORKFLOW_TRIGGER_TYPES = new Set(['event','schedule','condition','manual']);
const TASK_PRIORITIES = new Set(['low','normal','high','urgent','critical']);
const TASK_STATUSES = new Set(['open','in_progress','blocked','done','cancelled']);
const ALERT_STATUSES = new Set(['open','acknowledged','resolved','ignored']);

function automationOptionalUuid(value, field) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  if (!AUTOMATION_UUID_RE.test(normalized)) throw badRequest(field + ' must be a valid UUID');
  return normalized;
}
function automationOptionalDate(value, field) {
  if (value == null || value === '') return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) throw badRequest(field + ' must be a valid date');
  return new Date(ms).toISOString();
}

async function getAutomationOverview(sb, permissions = []) {
  const now = Date.now();
  const permissionSet = new Set(permissions);
  const canFlags = permissionSet.has('product.flags');
  const canEntitlements = permissionSet.has('entitlements.manage');
  const canWorkflows = permissionSet.has('workflow.manage');
  const canOperations = permissionSet.has('operations.manage');
  const empty = () => Promise.resolve({ data: [], error: null });
  const [flagsRes, rulesRes, entitlementsRes, planEntitlementsRes, workflowsRes, runsRes, tasksRes, alertsRes, overridesRes] = await Promise.all([
    canFlags ? sb.from('admin_feature_flags').select('*').order('updated_at', { ascending: false }).limit(500) : empty(),
    canFlags ? sb.from('admin_feature_flag_rules').select('*').order('priority', { ascending: true }).limit(1000) : empty(),
    canEntitlements ? sb.from('admin_entitlements').select('*').order('key', { ascending: true }).limit(1000) : empty(),
    canEntitlements ? sb.from('admin_plan_entitlements').select('*').order('tier', { ascending: true }).limit(1000) : empty(),
    canWorkflows ? sb.from('admin_workflows').select('*').order('updated_at', { ascending: false }).limit(500) : empty(),
    canWorkflows ? sb.from('admin_workflow_runs').select('*').order('created_at', { ascending: false }).limit(500) : empty(),
    canOperations ? sb.from('admin_tasks').select('*').order('created_at', { ascending: false }).limit(1000) : empty(),
    canOperations ? sb.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(1000) : empty(),
    canEntitlements ? sb.from('admin_entitlement_overrides').select('*').is('revoked_at', null).order('created_at', { ascending: false }).limit(1000) : empty()
  ]);
  for (const result of [flagsRes, rulesRes, entitlementsRes, planEntitlementsRes, workflowsRes, runsRes, tasksRes, alertsRes, overridesRes]) {
    if (result.error) throw result.error;
  }
  const tasks = tasksRes.data || [];
  const alerts = alertsRes.data || [];
  const runs = runsRes.data || [];
  return {
    success: true,
    flags: flagsRes.data || [],
    flagRules: rulesRes.data || [],
    entitlements: entitlementsRes.data || [],
    planEntitlements: planEntitlementsRes.data || [],
    workflows: workflowsRes.data || [],
    workflowRuns: runs,
    tasks,
    alerts,
    entitlementOverrides: overridesRes.data || [],
    summary: {
      enabledFlags: (flagsRes.data || []).filter(f => f.enabled && (!f.expires_at || new Date(f.expires_at).getTime() > now)).length,
      enabledWorkflows: (workflowsRes.data || []).filter(w => w.enabled).length,
      failedWorkflowRuns: runs.filter(r => r.status === 'failed').length,
      openTasks: tasks.filter(t => !['done','cancelled'].includes(t.status)).length,
      overdueTasks: tasks.filter(t => !['done','cancelled'].includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now).length,
      criticalAlerts: alerts.filter(a => a.status === 'open' && a.severity === 'critical').length,
      openAlerts: alerts.filter(a => a.status === 'open').length
    }
  };
}

async function upsertFeatureFlag(sb, body, admin, req) {
  const key = String(body?.key || '').trim();
  if (!key || !FEATURE_FLAG_KEY_RE.test(key)) throw badRequest('valid key required');
  const { data: current, error: currentError } = await sb.from('admin_feature_flags').select('*').eq('key', key).maybeSingle();
  if (currentError) throw currentError;
  const previousState = current ? {
    enabled: current.enabled,
    default_variant: current.default_variant,
    rollout_percentage: current.rollout_percentage,
    starts_at: current.starts_at,
    expires_at: current.expires_at
  } : null;
  const rollout = Number(body?.rollout_percentage ?? current?.rollout_percentage ?? 0);
  if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) throw badRequest('rollout_percentage must be between 0 and 100');
  const startsAt = automationOptionalDate(body?.starts_at ?? current?.starts_at ?? null, 'starts_at');
  const expiresAt = automationOptionalDate(body?.expires_at ?? current?.expires_at ?? null, 'expires_at');
  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) throw badRequest('expires_at must be after starts_at');
  const row = {
    key,
    description: body?.description ?? current?.description ?? null,
    enabled: body?.enabled === true,
    default_variant: body?.default_variant || current?.default_variant || 'off',
    rollout_percentage: rollout,
    starts_at: startsAt,
    expires_at: expiresAt,
    previous_state: previousState,
    updated_by: admin.id,
    created_by: current?.created_by || admin.id,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await sb.from('admin_feature_flags').upsert(row, { onConflict: 'key' }).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'feature_flag_upsert', 'feature_flag', data.id, null, { key, enabled: data.enabled, rollout_percentage: data.rollout_percentage }, req);
  return { success: true, flag: data };
}

async function rollbackFeatureFlag(sb, body, admin, req) {
  const key = String(body?.key || '').trim();
  if (!key) throw badRequest('key required');
  const { data: current, error } = await sb.from('admin_feature_flags').select('*').eq('key', key).single();
  if (error) throw error;
  if (!current?.previous_state) throw badRequest('No previous state available');
  const previous = current.previous_state;
  const snapshot = {
    enabled: current.enabled,
    default_variant: current.default_variant,
    rollout_percentage: current.rollout_percentage,
    starts_at: current.starts_at,
    expires_at: current.expires_at
  };
  const { data, error: updateError } = await sb.from('admin_feature_flags').update({
    ...previous,
    previous_state: snapshot,
    updated_by: admin.id,
    updated_at: new Date().toISOString()
  }).eq('id', current.id).select().single();
  if (updateError) throw updateError;
  await logAdminAction(sb, admin, 'feature_flag_rollback', 'feature_flag', current.id, null, { key }, req);
  return { success: true, flag: data };
}

async function createEntitlementOverride(sb, body, admin, req) {
  if (!body?.entitlement_key || (!body?.user_id && !body?.organization_id) || !body?.reason) {
    throw badRequest('entitlement_key, target and reason required');
  }
  const userId = automationOptionalUuid(body?.user_id, 'user_id');
  const organizationId = automationOptionalUuid(body?.organization_id, 'organization_id');
  const startsAt = automationOptionalDate(body?.starts_at || new Date().toISOString(), 'starts_at');
  const expiresAt = automationOptionalDate(body?.expires_at, 'expires_at');
  if (expiresAt && new Date(expiresAt) <= new Date(startsAt)) throw badRequest('expires_at must be after starts_at');
  const { data: entitlement, error: entitlementError } = await sb.from('admin_entitlements').select('key').eq('key', body.entitlement_key).maybeSingle();
  if (entitlementError) throw entitlementError;
  if (!entitlement) throw badRequest('unknown entitlement_key');
  const row = {
    user_id: userId,
    organization_id: organizationId,
    entitlement_key: body.entitlement_key,
    value: body?.value ?? true,
    reason: String(body.reason).slice(0, 1000),
    starts_at: startsAt,
    expires_at: expiresAt,
    created_by: admin.id
  };
  const { data, error } = await sb.from('admin_entitlement_overrides').insert([row]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'entitlement_override_create', 'entitlement_override', data.id, null, { entitlement_key: data.entitlement_key, user_id: data.user_id, organization_id: data.organization_id, expires_at: data.expires_at }, req);
  return { success: true, override: data };
}

async function upsertWorkflow(sb, body, admin, req) {
  const name = String(body?.name || '').trim();
  if (!name) throw badRequest('name required');
  const triggerType = body?.trigger_type || 'manual';
  if (!WORKFLOW_TRIGGER_TYPES.has(triggerType)) throw badRequest('invalid trigger_type');
  const workflowId = automationOptionalUuid(body?.id, 'id');
  const version = Number(body?.version || 1);
  if (!Number.isInteger(version) || version < 1) throw badRequest('version must be a positive integer');
  const row = {
    id: workflowId || undefined,
    name: name.slice(0, 240),
    description: body?.description || null,
    enabled: body?.enabled === true,
    trigger_type: triggerType,
    trigger_config: body?.trigger_config && typeof body.trigger_config === 'object' ? body.trigger_config : {},
    conditions: Array.isArray(body?.conditions) ? body.conditions : [],
    actions: Array.isArray(body?.actions) ? body.actions : [],
    version,
    updated_by: admin.id,
    created_by: admin.id,
    updated_at: new Date().toISOString()
  };
  if (!row.id) delete row.id;
  const query = row.id
    ? sb.from('admin_workflows').update(row).eq('id', row.id)
    : sb.from('admin_workflows').insert([row]);
  const { data, error } = await query.select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'workflow_upsert', 'admin_workflow', data.id, null, { name: data.name, enabled: data.enabled, trigger_type: data.trigger_type }, req);
  return { success: true, workflow: data };
}

async function createAdminTask(sb, body, admin, req) {
  const title = String(body?.title || '').trim();
  if (!title) throw badRequest('title required');
  const priority = body?.priority || 'normal';
  const status = body?.status || 'open';
  if (!TASK_PRIORITIES.has(priority)) throw badRequest('invalid task priority');
  if (!TASK_STATUSES.has(status)) throw badRequest('invalid task status');
  const row = {
    title: title.slice(0, 300),
    description: body?.description || null,
    entity_type: body?.entity_type || null,
    entity_id: body?.entity_id || null,
    assigned_to: automationOptionalUuid(body?.assigned_to, 'assigned_to'),
    priority,
    status,
    due_at: automationOptionalDate(body?.due_at, 'due_at'),
    sla_due_at: automationOptionalDate(body?.sla_due_at, 'sla_due_at'),
    source: body?.source || 'manual',
    request_id: body?.request_id || null,
    created_by: admin.id
  };
  const { data, error } = await sb.from('admin_tasks').insert([row]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'admin_task_create', 'admin_task', data.id, null, { priority: data.priority, assigned_to: data.assigned_to }, req);
  return { success: true, task: data };
}

async function updateAdminQueueItem(sb, body, admin, req) {
  const kind = body?.kind;
  const id = automationOptionalUuid(body?.id, 'id');
  if (!id || !['task','alert'].includes(kind)) throw badRequest('kind and id required');
  const now = new Date().toISOString();
  if (kind === 'task') {
    const updates = { updated_at: now };
    if (body.status !== undefined) {
      if (!TASK_STATUSES.has(body.status)) throw badRequest('invalid task status');
      updates.status = body.status;
    }
    if (body.priority !== undefined) {
      if (!TASK_PRIORITIES.has(body.priority)) throw badRequest('invalid task priority');
      updates.priority = body.priority;
    }
    if (body.assigned_to !== undefined) updates.assigned_to = automationOptionalUuid(body.assigned_to, 'assigned_to');
    if (body.due_at !== undefined) updates.due_at = automationOptionalDate(body.due_at, 'due_at');
    if (body.status === 'done') updates.completed_at = now;
    const { data, error } = await sb.from('admin_tasks').update(updates).eq('id', id).select().single();
    if (error) throw error;
    await logAdminAction(sb, admin, 'admin_task_update', 'admin_task', id, null, updates, req);
    return { success: true, task: data };
  }
  const updates = { updated_at: now };
  if (body.status !== undefined) {
    if (!ALERT_STATUSES.has(body.status)) throw badRequest('invalid alert status');
    updates.status = body.status;
  }
  if (body.owner_user_id !== undefined) updates.owner_user_id = automationOptionalUuid(body.owner_user_id, 'owner_user_id');
  if (body.status === 'acknowledged') updates.acknowledged_at = now;
  if (body.status === 'resolved') updates.resolved_at = now;
  const { data, error } = await sb.from('admin_alerts').update(updates).eq('id', id).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'admin_alert_update', 'admin_alert', id, null, updates, req);
  return { success: true, alert: data };
}


async function upsertFeatureFlagRule(sb, body, admin, req) {
  const flagKey = String(body?.flag_key || '').trim();
  const targetType = body?.target_type;
  const targetValue = String(body?.target_value || '').trim();
  if (!FEATURE_FLAG_KEY_RE.test(flagKey) || !['user','tier','organization','country','percentage'].includes(targetType) || !targetValue) {
    throw badRequest('valid flag_key, target_type and target_value required');
  }
  const { data: flag, error: flagError } = await sb.from('admin_feature_flags').select('id,key').eq('key', flagKey).maybeSingle();
  if (flagError) throw flagError;
  if (!flag) throw badRequest('unknown flag_key');
  const priority = Number(body?.priority ?? 100);
  if (!Number.isInteger(priority) || priority < 0 || priority > 100000) throw badRequest('invalid priority');
  const id = automationOptionalUuid(body?.id, 'id');
  const row = {
    flag_id: flag.id,
    target_type: targetType,
    target_value: targetValue.slice(0, 500),
    variant: String(body?.variant || 'on').slice(0, 120),
    enabled: body?.enabled !== false,
    priority,
    starts_at: automationOptionalDate(body?.starts_at, 'starts_at'),
    expires_at: automationOptionalDate(body?.expires_at, 'expires_at')
  };
  const query = id
    ? sb.from('admin_feature_flag_rules').update(row).eq('id', id)
    : sb.from('admin_feature_flag_rules').insert([row]);
  const { data, error } = await query.select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'feature_flag_rule_upsert', 'feature_flag_rule', data.id, null, { flag_key: flagKey, target_type: targetType, priority }, req);
  return { success: true, rule: data };
}

async function upsertPlanEntitlement(sb, body, admin, req) {
  const tier = String(body?.tier || '').trim();
  const key = String(body?.entitlement_key || '').trim();
  if (!tier || !key) throw badRequest('tier and entitlement_key required');
  const { data: entitlement, error: entitlementError } = await sb.from('admin_entitlements').select('key').eq('key', key).maybeSingle();
  if (entitlementError) throw entitlementError;
  if (!entitlement) throw badRequest('unknown entitlement_key');
  const row = { tier: tier.slice(0, 120), entitlement_key: key, value: body?.value ?? true, updated_at: new Date().toISOString() };
  const { data, error } = await sb.from('admin_plan_entitlements').upsert(row, { onConflict: 'tier,entitlement_key' }).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'plan_entitlement_upsert', 'plan_entitlement', tier + ':' + key, null, { tier, entitlement_key: key }, req);
  return { success: true, planEntitlement: data };
}

async function queueWorkflowRun(sb, body, admin, req) {
  const workflowId = automationOptionalUuid(body?.workflow_id, 'workflow_id');
  if (!workflowId) throw badRequest('workflow_id required');
  const { data: workflow, error: workflowError } = await sb.from('admin_workflows').select('id,name,enabled,trigger_type').eq('id', workflowId).single();
  if (workflowError) throw workflowError;
  if (!workflow.enabled) throw badRequest('workflow is disabled');
  const payload = body?.trigger_payload && typeof body.trigger_payload === 'object' && !Array.isArray(body.trigger_payload)
    ? body.trigger_payload : {};
  const { data, error } = await sb.from('admin_workflow_runs').insert([{
    workflow_id: workflowId,
    trigger_payload: payload,
    status: 'queued'
  }]).select().single();
  if (error) throw error;
  await logAdminAction(sb, admin, 'workflow_run_queue', 'admin_workflow_run', data.id, null, { workflow_id: workflowId, trigger_type: workflow.trigger_type }, req);
  return { success: true, run: data };
}

// ── Platform Observability / Incidents / Recovery ──────────
async function getPlatformOverview(sb) {
  const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
  const [
    errorsRes, metricsRes, jobsRes, incidentsRes, backupsRes, drillsRes,
    integrationsRes, webhooksRes, migrationsRes, releasesRes
  ] = await Promise.all([
    sb.from('admin_error_events').select('*').gte('last_seen_at', since24h).order('last_seen_at', { ascending: false }).limit(500),
    sb.from('admin_request_metrics').select('*').gte('created_at', since24h).order('created_at', { ascending: false }).limit(2000),
    sb.from('admin_job_runs').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('admin_incidents').select('*').order('started_at', { ascending: false }).limit(500),
    sb.from('admin_backup_checks').select('*').order('verified_at', { ascending: false }).limit(500),
    sb.from('admin_recovery_drills').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('admin_integration_health').select('*').order('checked_at', { ascending: false }).limit(500),
    sb.from('admin_webhook_deliveries').select('*').order('last_attempt_at', { ascending: false }).limit(500),
    sb.from('admin_migration_status').select('*').order('migration_name', { ascending: false }).limit(1000),
    sb.from('admin_release_history').select('*').order('created_at', { ascending: false }).limit(200)
  ]);
  for (const r of [errorsRes,metricsRes,jobsRes,incidentsRes,backupsRes,drillsRes,integrationsRes,webhooksRes,migrationsRes,releasesRes]) {
    if (r.error) throw r.error;
  }
  const errors=errorsRes.data||[], metrics=metricsRes.data||[], jobs=jobsRes.data||[], incidents=incidentsRes.data||[];
  const durations=metrics.map(x=>Number(x.duration_ms||0)).filter(x=>x>=0).sort((a,b)=>a-b);
  const percentile=(p)=>durations.length?durations[Math.min(durations.length-1,Math.floor(durations.length*p))]:null;
  const routeAgg={};
  for(const m of metrics){
    const key=m.route||'unknown'; const x=routeAgg[key]||(routeAgg[key]={count:0,total:0,max:0,errors:0});
    x.count++; x.total+=Number(m.duration_ms||0); x.max=Math.max(x.max,Number(m.duration_ms||0)); if(Number(m.status||0)>=500)x.errors++;
  }
  const slowRoutes=Object.entries(routeAgg).map(([route,x])=>({route,count:x.count,avgMs:Math.round(x.total/Math.max(1,x.count)),maxMs:x.max,errors:x.errors})).sort((a,b)=>b.avgMs-a.avgMs).slice(0,20);
  const memory=process.memoryUsage(); const mb=v=>Math.round(Number(v||0)/1024/1024*10)/10;
  const currentDeployment={
    provider:'vercel',
    environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'unknown',
    commitSha:process.env.VERCEL_GIT_COMMIT_SHA||null,
    branch:process.env.VERCEL_GIT_COMMIT_REF||null,
    url:process.env.VERCEL_URL?('https://'+process.env.VERCEL_URL):null,
    deploymentId:process.env.VERCEL_DEPLOYMENT_ID||null
  };
  const configPresence={
    ADMIN_EMAIL:!!process.env.ADMIN_EMAIL,
    SUPABASE_URL:!!(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY:!!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_URL:!!process.env.SUPABASE_DB_URL
  };
  return {
    success:true,
    generatedAt:new Date().toISOString(),
    currentDeployment,
    summary:{
      errors24h:errors.reduce((s,e)=>s+Number(e.occurrence_count||1),0),
      openIncidents:incidents.filter(i=>i.status!=='resolved').length,
      failedJobs:jobs.filter(j=>j.status==='failed'||j.status==='stalled').length,
      p50Ms:percentile(.50),p95Ms:percentile(.95),
      heapUsedMb:mb(memory.heapUsed),rssMb:mb(memory.rss),
      backupUnknown:(backupsRes.data||[]).filter(b=>b.status!=='verified').length,
      failedRecoveryDrills:(drillsRes.data||[]).filter(d=>d.status==='failed').length,
      degradedIntegrations:(integrationsRes.data||[]).filter(i=>i.status!=='healthy').length,
      failedWebhooks:(webhooksRes.data||[]).filter(w=>w.status==='failed').length,
      migrationsNotApplied:(migrationsRes.data||[]).filter(m=>m.status!=='applied').length
    },
    errors,slowRoutes,jobs,incidents,
    backups:backupsRes.data||[],recoveryDrills:drillsRes.data||[],
    integrations:integrationsRes.data||[],webhooks:webhooksRes.data||[],
    migrations:migrationsRes.data||[],releases:releasesRes.data||[],
    configuration:{presence:configPresence}
  };
}

async function recordRequestMetric(sb, req, status, startedAt, userId=null) {
  try {
    const mem=process.memoryUsage();
    await sb.from('admin_request_metrics').insert([{
      request_id:req.adminRequestId||generateRequestId(),
      route:'admin:'+String(req.query?.action||req.body?.action||'unknown'),
      method:req.method||'UNKNOWN',
      status:Number(status||0),
      duration_ms:Math.max(0,Date.now()-startedAt),
      memory_heap_used_mb:Math.round(mem.heapUsed/1024/1024*100)/100,
      memory_rss_mb:Math.round(mem.rss/1024/1024*100)/100,
      deployment_sha:process.env.VERCEL_GIT_COMMIT_SHA||null,
      user_id_hash:hashUserId(userId)
    }]);
  } catch(e) { console.warn('[RequestMetric] failed:',e.message||e); }
}

async function recordErrorEvent(sb, req, err, status=500) {
  try {
    const crypto=require('crypto');
    const message=String(err?.message||'Unknown error').slice(0,1000);
    const stackHash=crypto.createHash('sha256').update(String(err?.stack||message)).digest('hex').slice(0,24);
    const route='admin:'+String(req.query?.action||req.body?.action||'unknown');
    const { data:existing }=await sb.from('admin_error_events').select('id,occurrence_count').eq('stack_hash',stackHash).eq('status','open').limit(1).maybeSingle();
    if(existing?.id){
      await sb.from('admin_error_events').update({last_seen_at:new Date().toISOString(),occurrence_count:Number(existing.occurrence_count||1)+1,request_id:req.adminRequestId||null}).eq('id',existing.id);
    }else{
      await sb.from('admin_error_events').insert([{
        request_id:req.adminRequestId||null,source:'api',route,
        error_code:err?.code||String(status),message,stack_hash:stackHash,
        severity:status>=500?'error':'warning',
        deployment_sha:process.env.VERCEL_GIT_COMMIT_SHA||null
      }]);
    }
  }catch(e){console.warn('[ErrorEvent] failed:',e.message||e);}
}

async function createIncident(sb, body, admin, req) {
  const title=String(body?.title||'').trim(); if(!title)throw badRequest('title required');
  const row={title:title.slice(0,300),severity:body?.severity||'medium',status:'open',impact:body?.impact||null,owner_user_id:body?.owner_user_id||admin.id,request_id:body?.request_id||req.adminRequestId||null,deployment_sha:body?.deployment_sha||process.env.VERCEL_GIT_COMMIT_SHA||null,timeline:[{at:new Date().toISOString(),event:'created',actor:admin.email||admin.id}]};
  const {data,error}=await sb.from('admin_incidents').insert([row]).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'incident_create','incident',data.id,null,{severity:data.severity},req);return{success:true,incident:data};
}

async function updateIncident(sb, body, admin, req) {
  const id=body?.id;if(!id)throw badRequest('id required');
  const {data:current,error:readErr}=await sb.from('admin_incidents').select('*').eq('id',id).single();if(readErr)throw readErr;
  const timeline=Array.isArray(current.timeline)?current.timeline:[];
  timeline.push({at:new Date().toISOString(),event:body?.event||body?.status||'updated',actor:admin.email||admin.id});
  const updates={timeline,updated_at:new Date().toISOString()};
  for(const k of ['status','severity','impact','root_cause','owner_user_id'])if(body[k]!==undefined)updates[k]=body[k];
  if(body?.status==='resolved')updates.resolved_at=new Date().toISOString();
  const {data,error}=await sb.from('admin_incidents').update(updates).eq('id',id).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'incident_update','incident',id,null,updates,req);return{success:true,incident:data};
}

async function recordBackupCheck(sb, body, admin, req) {
  if(!body?.provider||!body?.resource||!body?.status)throw badRequest('provider, resource and status required');
  const row={provider:body.provider,resource:body.resource,backup_reference:body?.backup_reference||null,status:body.status,backup_created_at:body?.backup_created_at||null,verified_by:admin.id,restore_tested:body?.restore_tested===true,restore_tested_at:body?.restore_tested_at||null,rpo_minutes:body?.rpo_minutes??null,evidence:body?.evidence&&typeof body.evidence==='object'?body.evidence:{}};
  const {data,error}=await sb.from('admin_backup_checks').insert([row]).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'backup_check_record','backup_check',data.id,null,{provider:row.provider,resource:row.resource,status:row.status},req);return{success:true,backup:data};
}

async function recordConfigSnapshot(sb, body, admin, req) {
  const environment=body?.environment||'production';
  const keys=Array.isArray(body?.keys)?body.keys:[];
  if(!keys.length)throw badRequest('keys required');
  const crypto=require('crypto'); const rows=[];
  for(const key of keys.slice(0,200)){
    const name=String(key||'').trim();if(!name)continue;
    const value=process.env[name];
    rows.push({environment,config_key:name,present:value!==undefined&&value!=='',value_hash:value?crypto.createHash('sha256').update(value).digest('hex').slice(0,16):null,source:'runtime'});
  }
  const {data,error}=await sb.from('admin_config_snapshots').insert(rows).select();if(error)throw error;
  await logAdminAction(sb,admin,'config_snapshot_record','configuration',environment,null,{keys:rows.map(r=>r.config_key)},req);
  return{success:true,snapshots:data||[]};
}

// ── Executive Analytics / AI Operations ────────────────────
async function getExecutiveAnalyticsV2(sb) {
  const since90=new Date(Date.now()-90*86400000).toISOString();
  const sourceQueries=[
    ['profiles',sb.from('profiles').select('id,tier,status,created_at,profile_completeness').order('created_at',{ascending:false}).limit(5000)],
    ['subscriptions',sb.from('subscriptions').select('*').order('created_at',{ascending:false}).limit(5000)],
    ['invoices',sb.from('moyasar_invoices').select('user_id,amount,currency,status,paid_at,created_at').order('created_at',{ascending:false}).limit(5000)],
    ['presence',sb.from('user_presence').select('user_id,last_seen_at').gte('last_seen_at',since90).order('last_seen_at',{ascending:false}).limit(10000)],
    ['opportunities',sb.from('crm_opportunities').select('stage,value_amount,probability,expected_close_date,created_at').limit(5000)],
    ['renewals',sb.from('crm_renewals').select('renewal_date,value_amount,status,risk_level').limit(5000)],
    ['customerSuccess',sb.from('crm_customer_success').select('health_score,risk_level,lifecycle_stage').limit(5000)],
    ['aiTelemetry',sb.from('admin_ai_operation_events').select('*').gte('created_at',since90).order('created_at',{ascending:false}).limit(10000)]
  ];
  const settled=await Promise.allSettled(sourceQueries.map(([,query])=>query));
  const sourceStatus={};
  const sourceData={};
  settled.forEach((result,index)=>{
    const name=sourceQueries[index][0];
    if(result.status==='rejected'){
      sourceStatus[name]={status:'unavailable',error:String(result.reason?.message||result.reason||'Query failed').slice(0,180)};
      sourceData[name]=[];
      return;
    }
    const payload=result.value||{};
    if(payload.error){
      sourceStatus[name]={status:'unavailable',error:String(payload.error.message||payload.error).slice(0,180)};
      sourceData[name]=[];
      return;
    }
    sourceStatus[name]={status:'ok',rows:Array.isArray(payload.data)?payload.data.length:0};
    sourceData[name]=payload.data||[];
  });
  const profiles=sourceData.profiles,subs=sourceData.subscriptions,invoices=sourceData.invoices,presence=sourceData.presence,opps=sourceData.opportunities,renewals=sourceData.renewals,success=sourceData.customerSuccess,ai=sourceData.aiTelemetry;
  const prices=await getTierPrices(sb);
  const paidInvoices=invoices.filter(i=>i.status==='paid');
  const paidUsers=new Set(paidInvoices.map(i=>i.user_id).filter(Boolean));
  const activeSubs=subs.filter(s=>['active','trialing'].includes(s.status));
  const inactiveSubs=subs.filter(s=>['cancelled','canceled','inactive','expired'].includes(s.status));
  const pro=profiles.filter(p=>p.tier==='pro').length,ent=profiles.filter(p=>p.tier==='enterprise').length;
  const paidActiveSubs=activeSubs.filter(s=>paidUsers.has(s.user_id));
  const mrr=paidActiveSubs.reduce((sum,s)=>sum+(s.tier==='enterprise'?prices.enterprise:s.tier==='pro'?prices.pro:0),0),arr=mrr*12;
  const total=profiles.length;
  const activeUsers=new Set(presence.filter(p=>new Date(p.last_seen_at).getTime()>=Date.now()-30*86400000).map(p=>p.user_id)).size;
  const activated=profiles.filter(p=>Number(p.profile_completeness||0)>=80).length;
  const conversion=total?paidUsers.size/total*100:0;
  const churnDenom=activeSubs.length+inactiveSubs.length;
  const churn=churnDenom?inactiveSubs.length/churnDenom*100:0;
  const arpu=total?mrr/total:0;

  const cohortMap={};
  for(const p of profiles){
    const month=String(p.created_at||'').slice(0,7);if(!month)continue;
    const c=cohortMap[month]||(cohortMap[month]={registered:0,active30:0,paid:0});
    c.registered++;if(activeUsers&&presence.some(x=>x.user_id===p.id&&new Date(x.last_seen_at).getTime()>=Date.now()-30*86400000))c.active30++;if(paidUsers.has(p.id))c.paid++;
  }
  const cohorts=Object.entries(cohortMap).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,12).map(([month,c])=>({month,...c,retentionPct:c.registered?Math.round(c.active30/c.registered*1000)/10:0,conversionPct:c.registered?Math.round(c.paid/c.registered*1000)/10:0}));
  const pipelineValue=opps.filter(o=>!['won','lost'].includes(o.stage)).reduce((s,o)=>s+Number(o.value_amount||0),0);
  const weightedPipeline=opps.filter(o=>!['won','lost'].includes(o.stage)).reduce((s,o)=>s+Number(o.value_amount||0)*Number(o.probability||0)/100,0);
  const renewalRisk=renewals.filter(r=>['high','critical'].includes(r.risk_level)).reduce((s,r)=>s+Number(r.value_amount||0),0);
  const avgHealth=success.length?success.reduce((s,x)=>s+Number(x.health_score||0),0)/success.length:0;

  const aiCost=ai.reduce((s,x)=>s+Number(x.cost_usd||0),0);
  const aiLatency=ai.map(x=>Number(x.latency_ms||0)).filter(Boolean).sort((a,b)=>a-b);
  const aiFailures=ai.filter(x=>x.status!=='success').length;
  const byModel={},byFeature={},costByFeature={},costByModel={},costByUser={};
  for(const e of ai){
    const m=e.model||'unknown',f=e.feature||'unknown',cost=Number(e.cost_usd||0);
    byModel[m]=(byModel[m]||0)+1;byFeature[f]=(byFeature[f]||0)+1;
    costByFeature[f]=(costByFeature[f]||0)+cost;costByModel[m]=(costByModel[m]||0)+cost;
    if(e.user_id){const u=hashUserId(e.user_id);costByUser[u]=(costByUser[u]||0)+cost;}
  }

  const monthlyRevenue={};
  for(const inv of paidInvoices){
    const at=inv.paid_at||inv.created_at;const month=String(at||'').slice(0,7);if(!month)continue;
    monthlyRevenue[month]=(monthlyRevenue[month]||0)+Number(inv.amount||0)/100;
  }
  const revenueSeries=Object.entries(monthlyRevenue).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([month,value])=>({month,value}));
  let monthlyTrend=0;
  if(revenueSeries.length>=2) monthlyTrend=(revenueSeries[revenueSeries.length-1].value-revenueSeries[0].value)/(revenueSeries.length-1);
  const lastRevenue=revenueSeries.length?revenueSeries[revenueSeries.length-1].value:0;
  const forecast90d=Math.max(0,lastRevenue+monthlyTrend)+Math.max(0,lastRevenue+2*monthlyTrend)+Math.max(0,lastRevenue+3*monthlyTrend);

  return {success:true,
    executive:{users:total,activeUsers30d:activeUsers,activatedUsers:activated,mrr,arr,arpu:Math.round(arpu*100)/100,conversionPct:Math.round(conversion*10)/10,churnPct:Math.round(churn*10)/10,pipelineValue,weightedPipeline,renewalRisk,customerHealth:Math.round(avgHealth*10)/10,revenueForecast90d:Math.round(forecast90d*100)/100,forecastMethod:'linear_paid_invoice_trend',revenueSeries},
    funnel:{registered:total,activated,paid:paidUsers.size,active30d:activeUsers},
    cohorts,
    ai:{requests:ai.length,costUsd:Math.round(aiCost*1000000)/1000000,failureRatePct:ai.length?Math.round(aiFailures/ai.length*1000)/10:0,p50LatencyMs:aiLatency.length?aiLatency[Math.floor(aiLatency.length*.5)]:null,p95LatencyMs:aiLatency.length?aiLatency[Math.min(aiLatency.length-1,Math.floor(aiLatency.length*.95))]:null,inputTokens:ai.reduce((s,x)=>s+Number(x.input_tokens||0),0),outputTokens:ai.reduce((s,x)=>s+Number(x.output_tokens||0),0),byModel,byFeature,costByFeature,costByModel,costByUser},
    sources:sourceStatus,
    status:Object.values(sourceStatus).some(x=>x.status!=='ok')?'degraded':'healthy',
    generatedAt:new Date().toISOString()
  };
}

async function getAiOperations(sb) {
  const [eventsRes,promptsRes,switchesRes]=await Promise.all([
    sb.from('admin_ai_operation_events').select('*').order('created_at',{ascending:false}).limit(1000),
    sb.from('admin_ai_prompt_versions').select('*').order('created_at',{ascending:false}).limit(500),
    sb.from('admin_ai_kill_switches').select('*').order('updated_at',{ascending:false}).limit(500)
  ]);for(const r of [eventsRes,promptsRes,switchesRes])if(r.error)throw r.error;
  return{success:true,events:eventsRes.data||[],promptVersions:promptsRes.data||[],killSwitches:switchesRes.data||[]};
}


function cleanAssistantAuditFilter(value,max=160){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  if(!text)return null;
  return text.slice(0,max);
}

function assistantAuditSubjectRef(userId){
  const value=String(userId||'').trim();
  if(!value)return null;
  const crypto=require('crypto');
  return 'usr_'+crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
}

async function searchAssistantAudit(sb,params={}){
  const limit=Math.max(1,Math.min(Number(params.limit)||50,100));
  const offset=Math.max(0,Math.min(Number(params.offset)||0,10000));
  const actionType=cleanAssistantAuditFilter(params.action_type,100);
  const eventType=cleanAssistantAuditFilter(params.event_type,100);
  const outcome=cleanAssistantAuditFilter(params.outcome,100);
  const risk=cleanAssistantAuditFilter(params.risk,50);
  const actionId=cleanAssistantAuditFilter(params.action_id,200);
  const resourceId=cleanAssistantAuditFilter(params.resource_id,200);
  const from=cleanAssistantAuditFilter(params.from,64);
  const to=cleanAssistantAuditFilter(params.to,64);
  const requiresConfirmation=params.requires_confirmation;

  let query=sb.from('assistant_action_audit')
    .select('id,created_at,user_id,boundary,action_id,action_type,target,event_type,outcome,risk,requires_confirmation,resource_id',{count:'exact'})
    .order('created_at',{ascending:false});

  if(actionType)query=query.ilike('action_type',`%${actionType}%`);
  if(eventType)query=query.eq('event_type',eventType);
  if(outcome)query=query.ilike('outcome',`%${outcome}%`);
  if(risk)query=query.eq('risk',risk);
  if(actionId)query=query.eq('action_id',actionId);
  if(resourceId)query=query.eq('resource_id',resourceId);
  if(from){
    const d=new Date(from);
    if(Number.isNaN(d.getTime()))throw badRequest('invalid from');
    query=query.gte('created_at',d.toISOString());
  }
  if(to){
    const d=new Date(to);
    if(Number.isNaN(d.getTime()))throw badRequest('invalid to');
    query=query.lte('created_at',d.toISOString());
  }
  if(requiresConfirmation==='true'||requiresConfirmation===true)query=query.eq('requires_confirmation',true);
  if(requiresConfirmation==='false'||requiresConfirmation===false)query=query.eq('requires_confirmation',false);

  const {data,error,count}=await query.range(offset,offset+limit-1);
  if(error)throw error;

  const events=(data||[]).map(row=>({
    id:row.id,
    created_at:row.created_at,
    subject_ref:assistantAuditSubjectRef(row.user_id),
    boundary:row.boundary,
    action_id:row.action_id,
    action_type:row.action_type,
    target:row.target,
    event_type:row.event_type,
    outcome:row.outcome,
    risk:row.risk,
    requires_confirmation:Boolean(row.requires_confirmation),
    resource_id:row.resource_id
  }));

  return{
    success:true,
    events,
    count:count||0,
    pagination:{limit,offset,returned:events.length},
    privacy:{
      raw_user_id:false,
      session_id:false,
      metadata:false,
      idempotency_key_hash:false
    }
  };
}

async function setAiKillSwitch(sb, body, admin, req) {
  const feature=String(body?.feature||'').trim();if(!feature)throw badRequest('feature required');
  const disabled=body?.disabled===true;const row={feature,disabled,reason:body?.reason||null,disabled_by:disabled?admin.id:null,disabled_at:disabled?new Date().toISOString():null,expires_at:body?.expires_at||null,updated_at:new Date().toISOString()};
  const {data,error}=await sb.from('admin_ai_kill_switches').upsert(row,{onConflict:'feature'}).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'ai_kill_switch_update','ai_feature',feature,null,{disabled,reason:row.reason,expires_at:row.expires_at},req);return{success:true,killSwitch:data};
}

async function createAiPromptVersion(sb, body, admin, req) {
  const key=String(body?.prompt_key||'').trim(),content=String(body?.content||'');if(!key||!content)throw badRequest('prompt_key and content required');
  const crypto=require('crypto');const hash=crypto.createHash('sha256').update(content).digest('hex');
  const {data:versions}=await sb.from('admin_ai_prompt_versions').select('version').eq('prompt_key',key).order('version',{ascending:false}).limit(1);
  const version=Number(versions?.[0]?.version||0)+1;
  const {data,error}=await sb.from('admin_ai_prompt_versions').insert([{prompt_key:key,version,content_hash:hash,status:'draft',notes:body?.notes||null,created_by:admin.id}]).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'ai_prompt_version_create','ai_prompt',data.id,null,{prompt_key:key,version,content_hash:hash},req);
  return{success:true,promptVersion:data};
}



function replayOutcomeFromEvents(events=[]){
  const names=events.map(x=>x.event_type);
  if(names.includes('execution_succeeded')||names.includes('write_succeeded'))return 'succeeded';
  if(names.includes('execution_failed')||names.includes('failed'))return 'failed';
  if(names.includes('execution_denied')||names.includes('denied'))return 'denied';
  if(names.includes('write_uncertain'))return 'uncertain';
  if(names.includes('replayed')||names.includes('event_replayed'))return 'replayed';
  return events.length?'incomplete':'not_found';
}

async function getAssistantOperationalReplay(sb,params={}){
  const actionId=cleanAssistantAuditFilter(params.action_id,200);
  const resourceId=cleanAssistantAuditFilter(params.resource_id,200);
  if(!actionId&&!resourceId)throw badRequest('action_id or resource_id required');

  let query=sb.from('assistant_action_audit')
    .select('id,created_at,user_id,boundary,action_id,action_type,target,event_type,outcome,risk,requires_confirmation,resource_id')
    .order('created_at',{ascending:true})
    .limit(200);

  if(actionId)query=query.eq('action_id',actionId);
  if(resourceId)query=query.eq('resource_id',resourceId);

  const {data,error}=await query;
  if(error)throw error;
  const rows=data||[];
  if(!rows.length)return{success:true,replay:{status:'not_found',timeline:[],event_count:0,execution_performed:false}};

  const subjectRefs=[...new Set(rows.map(x=>assistantAuditSubjectRef(x.user_id)).filter(Boolean))];
  const boundaries=[...new Set(rows.map(x=>x.boundary).filter(Boolean))];
  const actionTypes=[...new Set(rows.map(x=>x.action_type).filter(Boolean))];
  const targets=[...new Set(rows.map(x=>x.target).filter(Boolean))];

  const timeline=rows.map((row,index)=>({
    sequence:index+1,
    id:row.id,
    created_at:row.created_at,
    event_type:row.event_type,
    outcome:row.outcome,
    risk:row.risk,
    requires_confirmation:Boolean(row.requires_confirmation),
    action_id:row.action_id,
    resource_id:row.resource_id
  }));

  const terminal=replayOutcomeFromEvents(rows);
  const anomalies=[];
  if(subjectRefs.length>1)anomalies.push('multiple_subjects');
  if(boundaries.length>1)anomalies.push('multiple_boundaries');
  if(actionTypes.length>1)anomalies.push('multiple_action_types');
  if(rows.length>=200)anomalies.push('timeline_truncated');

  return{
    success:true,
    replay:{
      status:terminal,
      event_count:timeline.length,
      started_at:rows[0]?.created_at||null,
      ended_at:rows[rows.length-1]?.created_at||null,
      subject_ref:subjectRefs[0]||null,
      boundary:boundaries[0]||null,
      action_type:actionTypes[0]||null,
      target:targets[0]||null,
      action_id:actionId||rows[0]?.action_id||null,
      resource_id:resourceId||rows[0]?.resource_id||null,
      timeline,
      anomalies,
      execution_performed:false,
      writes_performed:false,
      authorization_simulated:false,
      note:'Operational replay reconstructs immutable audit evidence only; it never re-executes capabilities.'
    }
  };
}



function roundCost(value){return Math.round(Number(value||0)*1000000)/1000000;}

async function getAssistantCostGovernance(sb,params={}){
  const windowDays=Math.max(1,Math.min(Number(params.window_days)||30,90));
  const since=new Date(Date.now()-windowDays*86400000).toISOString();
  const {data,error}=await sb.from('admin_ai_operation_events')
    .select('created_at,feature,model,status,input_tokens,output_tokens,cost_usd,latency_ms')
    .gte('created_at',since)
    .order('created_at',{ascending:false})
    .limit(10000);
  if(error)throw error;
  const events=data||[];
  const groups=(key)=>{
    const map={};
    for(const e of events){
      const name=String(e[key]||'unknown');
      const row=map[name]||(map[name]={name,requests:0,cost_usd:0,input_tokens:0,output_tokens:0,failures:0});
      row.requests++;
      row.cost_usd+=Number(e.cost_usd||0);
      row.input_tokens+=Number(e.input_tokens||0);
      row.output_tokens+=Number(e.output_tokens||0);
      if(e.status!=='success')row.failures++;
    }
    return Object.values(map).map(x=>({...x,cost_usd:roundCost(x.cost_usd)})).sort((a,b)=>b.cost_usd-a.cost_usd||b.requests-a.requests);
  };
  const priced=events.filter(e=>Number.isFinite(Number(e.cost_usd))&&e.cost_usd!==null);
  const latencies=events.map(e=>Number(e.latency_ms||0)).filter(v=>v>0).sort((a,b)=>a-b);
  const totalCost=events.reduce((s,e)=>s+Number(e.cost_usd||0),0);
  const inputTokens=events.reduce((s,e)=>s+Number(e.input_tokens||0),0);
  const outputTokens=events.reduce((s,e)=>s+Number(e.output_tokens||0),0);
  return{
    success:true,
    cost_governance:{
      window_days:windowDays,
      generated_at:new Date().toISOString(),
      summary:{
        requests:events.length,
        cost_usd:roundCost(totalCost),
        input_tokens:inputTokens,
        output_tokens:outputTokens,
        unpriced_events:Math.max(0,events.length-priced.length),
        cost_coverage_pct:events.length?Math.round(priced.length/events.length*1000)/10:100,
        p50_latency_ms:latencies.length?latencies[Math.floor(latencies.length*.5)]:null,
        p95_latency_ms:latencies.length?latencies[Math.min(latencies.length-1,Math.floor(latencies.length*.95))]:null
      },
      by_feature:groups('feature'),
      by_model:groups('model'),
      policy:{
        observability_only:true,
        authorization_effect:'none',
        execution_blocking:false,
        token_limiting:false,
        provider_routing_effect:'none',
        model_selection_effect:'none',
        compute_limit_effect:'none'
      }
    }
  };
}



async function getAssistantTaskBudget(sb,params={}){
  const requestId=String(params.request_id||'').trim().slice(0,200);
  if(!requestId)throw badRequest('request_id required');
  const budgetUsd=Number(params.budget_usd);
  if(!Number.isFinite(budgetUsd)||budgetUsd<0||budgetUsd>1000000)throw badRequest('valid budget_usd required');

  const {data,error}=await sb.from('admin_ai_operation_events')
    .select('created_at,feature,model,status,input_tokens,output_tokens,cost_usd,latency_ms,request_id')
    .eq('request_id',requestId)
    .order('created_at',{ascending:true})
    .limit(1000);
  if(error)throw error;
  const events=data||[];
  const priced=events.filter(e=>e.cost_usd!==null&&Number.isFinite(Number(e.cost_usd)));
  const actual=events.reduce((s,e)=>s+Number(e.cost_usd||0),0);
  const remaining=budgetUsd-actual;
  const utilization=budgetUsd>0?actual/budgetUsd*100:(actual>0?Infinity:0);

  return{
    success:true,
    task_budget:{
      request_id:requestId,
      budget_usd:roundCost(budgetUsd),
      actual_cost_usd:roundCost(actual),
      remaining_usd:roundCost(remaining),
      utilization_pct:Number.isFinite(utilization)?Math.round(utilization*10)/10:null,
      state:events.length===0?'not_found':priced.length<events.length?'unpriced':actual>budgetUsd?'over_budget':'within_budget',
      telemetry_found:events.length>0,
      event_count:events.length,
      input_tokens:events.reduce((s,e)=>s+Number(e.input_tokens||0),0),
      output_tokens:events.reduce((s,e)=>s+Number(e.output_tokens||0),0),
      first_event_at:events[0]?.created_at||null,
      last_event_at:events[events.length-1]?.created_at||null,
      advisory_only:true,
      enforcement:false,
      execution_blocking:false,
      token_limiting:false,
      model_selection_effect:'none',
      provider_routing_effect:'none',
      authorization_effect:'none'
    }
  };
}

// ── Data Governance / Document Center ──────────────────────
function maskEmail(value){const s=String(value||'');const [a,b]=s.split('@');if(!b)return s?'***':'';return (a?String(a[0]||'')+'***':'***')+'@'+b;}
function maskPhone(value){const s=String(value||'').replace(/\s+/g,'');if(s.length<=4)return s?'****':'';return '*'.repeat(Math.max(4,s.length-4))+s.slice(-4);}

async function getDataGovernanceOverview(sb, access) {
  const [profilesRes,privacyRes,exportsRes,mergesRes,lineageRes,retentionRes,piiRes,anchorsRes,docsRes]=await Promise.all([
    sb.from('profiles').select('id,email,phone,restaurant_name,created_at').limit(5000),
    sb.from('admin_privacy_requests').select('*').order('requested_at',{ascending:false}).limit(500),
    sb.from('admin_data_exports').select('*').order('created_at',{ascending:false}).limit(500),
    sb.from('admin_user_merge_requests').select('*').order('created_at',{ascending:false}).limit(500),
    sb.from('admin_data_lineage').select('*').order('metric_or_field').limit(1000),
    sb.from('admin_retention_policies').select('*').order('data_category').limit(500),
    sb.from('admin_pii_field_policies').select('*').order('field_key').limit(500),
    sb.from('admin_audit_integrity_anchors').select('*').order('generated_at',{ascending:false}).limit(100),
    sb.from('admin_documents').select('*').order('created_at',{ascending:false}).limit(1000)
  ]);
  for(const r of [profilesRes,privacyRes,exportsRes,mergesRes,lineageRes,retentionRes,piiRes,anchorsRes,docsRes])if(r.error)throw r.error;
  const profiles=profilesRes.data||[];
  const emailMap=new Map(),phoneMap=new Map();
  for(const p of profiles){
    const e=String(p.email||'').trim().toLowerCase();const ph=String(p.phone||'').replace(/\D/g,'');
    if(e){if(!emailMap.has(e))emailMap.set(e,[]);emailMap.get(e).push(p);}
    if(ph){if(!phoneMap.has(ph))phoneMap.set(ph,[]);phoneMap.get(ph).push(p);}
  }
  const canReadSensitive=access.permissions.includes('users.read_sensitive');
  const duplicates=[];
  for(const [value,rows] of emailMap)if(rows.length>1)duplicates.push({type:'email',value:canReadSensitive?value:maskEmail(value),count:rows.length,userIds:rows.map(x=>x.id)});
  for(const [value,rows] of phoneMap)if(rows.length>1)duplicates.push({type:'phone',value:canReadSensitive?value:maskPhone(value),count:rows.length,userIds:rows.map(x=>x.id)});
  const docs=docsRes.data||[],now=Date.now();
  return{success:true,
    summary:{
      duplicateGroups:duplicates.length,
      privacyOpen:(privacyRes.data||[]).filter(x=>!['completed','rejected','cancelled'].includes(x.status)).length,
      exportsPending:(exportsRes.data||[]).filter(x=>!['completed','failed','expired','rejected'].includes(x.status)).length,
      mergeRequestsPending:(mergesRes.data||[]).filter(x=>!['completed','failed','cancelled'].includes(x.status)).length,
      retentionPolicies:(retentionRes.data||[]).filter(x=>x.enabled).length,
      lineageEntries:(lineageRes.data||[]).length,
      auditAnchors:(anchorsRes.data||[]).length,
      documents:docs.length,
      documentsExpiring30d:docs.filter(d=>d.expires_at&&new Date(d.expires_at).getTime()>=now&&new Date(d.expires_at).getTime()<=now+30*86400000).length
    },
    duplicates,privacyRequests:privacyRes.data||[],exports:exportsRes.data||[],mergeRequests:mergesRes.data||[],
    lineage:lineageRes.data||[],retentionPolicies:retentionRes.data||[],piiPolicies:piiRes.data||[],auditAnchors:anchorsRes.data||[],documents:docs,
    piiMode:canReadSensitive?'unmasked':'masked'
  };
}

async function createPrivacyRequest(sb,body,admin,req){
  if(!body?.request_type)throw badRequest('request_type required');
  const row={user_id:body?.user_id||null,request_type:body.request_type,status:'received',identity_verified:body?.identity_verified===true,due_at:body?.due_at||null,handled_by:admin.id,notes:body?.notes||null,evidence:body?.evidence&&typeof body.evidence==='object'?body.evidence:{}};
  const {data,error}=await sb.from('admin_privacy_requests').insert([row]).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'privacy_request_create','privacy_request',data.id,null,{request_type:data.request_type,user_id:data.user_id},req);return{success:true,privacyRequest:data};
}

async function createDataExportRequest(sb,body,admin,req){
  const type=String(body?.export_type||'').trim();if(!type)throw badRequest('export_type required');
  const row={requested_by:admin.id,subject_user_id:body?.subject_user_id||null,export_type:type,fields:Array.isArray(body?.fields)?body.fields.slice(0,200):[],filters:body?.filters&&typeof body.filters==='object'?body.filters:{},status:'requested',expires_at:body?.expires_at||null,request_id:req.adminRequestId||null};
  const {data,error}=await sb.from('admin_data_exports').insert([row]).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'data_export_request','data_export',data.id,null,{export_type:type,subject_user_id:row.subject_user_id},req);return{success:true,exportRequest:data};
}

async function createUserMergeDryRun(sb,body,admin,req){
  const source=body?.source_user_id,target=body?.target_user_id;if(!source||!target||source===target)throw badRequest('distinct source_user_id and target_user_id required');
  const tables=[
    ['profiles','id'],['subscriptions','user_id'],['moyasar_invoices','user_id'],['user_presence','user_id'],
    ['admin_customer_notes','user_id'],['admin_customer_tags','user_id'],['support_tickets','user_id'],['finance_refunds','user_id']
  ];
  const impact={};
  for(const [table,column] of tables){
    try{const [{count:sourceCount},{count:targetCount}]=await Promise.all([sb.from(table).select('*',{count:'exact',head:true}).eq(column,source),sb.from(table).select('*',{count:'exact',head:true}).eq(column,target)]);impact[table]={source:sourceCount||0,target:targetCount||0};}
    catch(e){impact[table]={status:'unknown',error:String(e.message||e).slice(0,160)};}
  }
  const dryRun={impact,destructiveExecution:false,requiresApproval:true,generatedAt:new Date().toISOString()};
  const {data,error}=await sb.from('admin_user_merge_requests').insert([{source_user_id:source,target_user_id:target,status:'review',dry_run:dryRun,requested_by:admin.id}]).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'user_merge_dry_run','user_merge_request',data.id,null,{source_user_id:source,target_user_id:target},req);
  return{success:true,mergeRequest:data};
}

async function createAuditIntegrityAnchor(sb,admin,req){
  const crypto=require('crypto');const end=new Date(),start=new Date(end.getTime()-24*3600000);
  const {data,error}=await sb.from('admin_audit_log').select('id,created_at,actor_id,action,target_type,target_id').gte('created_at',start.toISOString()).lte('created_at',end.toISOString()).order('created_at',{ascending:true}).limit(5000);if(error)throw error;
  const rows=data||[];const digest=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const {data:anchor,error:aerr}=await sb.from('admin_audit_integrity_anchors').insert([{range_start:start.toISOString(),range_end:end.toISOString(),row_count:rows.length,digest_sha256:digest,generated_by:admin.id}]).select().single();if(aerr)throw aerr;
  return{success:true,anchor};
}

async function registerAdminDocument(sb,body,admin,req){
  if(!body?.entity_type||!body?.entity_id||!body?.document_type||!body?.title)throw badRequest('entity_type, entity_id, document_type and title required');
  const row={entity_type:body.entity_type,entity_id:String(body.entity_id),document_type:body.document_type,title:String(body.title).slice(0,300),status:body?.status||'active',classification:body?.classification||'confidential',storage_provider:body?.storage_provider||'supabase',storage_path:body?.storage_path||null,mime_type:body?.mime_type||null,size_bytes:body?.size_bytes??null,checksum_sha256:body?.checksum_sha256||null,expires_at:body?.expires_at||null,verification_status:body?.verification_status||'unverified',created_by:admin.id};
  const {data,error}=await sb.from('admin_documents').insert([row]).select().single();if(error)throw error;
  if(row.storage_path){const {error:verErr}=await sb.from('admin_document_versions').insert([{document_id:data.id,version:1,storage_path:row.storage_path,mime_type:row.mime_type,size_bytes:row.size_bytes,checksum_sha256:row.checksum_sha256,created_by:admin.id}]);if(verErr)throw verErr;}
  await logAdminAction(sb,admin,'document_register','admin_document',data.id,null,{entity_type:row.entity_type,entity_id:row.entity_id,document_type:row.document_type},req);return{success:true,document:data};
}

async function addAdminDocumentVersion(sb,body,admin,req){
  const id=body?.document_id;if(!id)throw badRequest('document_id required');
  const {data:versions,error:vErr}=await sb.from('admin_document_versions').select('version').eq('document_id',id).order('version',{ascending:false}).limit(1);if(vErr)throw vErr;
  const version=Number(versions?.[0]?.version||0)+1;
  const row={document_id:id,version,storage_path:body?.storage_path||null,mime_type:body?.mime_type||null,size_bytes:body?.size_bytes??null,checksum_sha256:body?.checksum_sha256||null,created_by:admin.id};
  const {data,error}=await sb.from('admin_document_versions').insert([row]).select().single();if(error)throw error;
  await sb.from('admin_documents').update({storage_path:row.storage_path,mime_type:row.mime_type,size_bytes:row.size_bytes,checksum_sha256:row.checksum_sha256,status:'active',updated_at:new Date().toISOString()}).eq('id',id);
  await logAdminAction(sb,admin,'document_version_add','admin_document',id,null,{version},req);return{success:true,version:data};
}

// ── Control Plane completion ────────────────────────────────
async function getSecuritySessionsOverview(sb) {
  const [presenceRes,devicesRes,policiesRes,revokedRes]=await Promise.all([
    sb.from('user_presence').select('user_id,session_id,country,country_code,city,user_agent,last_seen_at,is_online').order('last_seen_at',{ascending:false}).limit(1000),
    sb.from('admin_trusted_devices').select('*').order('last_seen_at',{ascending:false}).limit(1000),
    sb.from('admin_access_policies').select('*').order('priority',{ascending:true}).limit(100),
    sb.from('admin_revoked_sessions').select('*').order('revoked_at',{ascending:false}).limit(500)
  ]);
  for(const r of [presenceRes,devicesRes,policiesRes,revokedRes])if(r.error)throw r.error;
  return{success:true,sessions:presenceRes.data||[],trustedDevices:devicesRes.data||[],policies:policiesRes.data||[],revokedSessions:revokedRes.data||[]};
}

async function revokeAdminSession(sb, body, admin, req) {
  const userId=body?.user_id||null,sessionId=body?.session_id||null,reason=String(body?.reason||'').trim();
  if((!userId&&!sessionId)||!reason)throw badRequest('user_id or session_id, and reason required');
  const {data,error}=await sb.from('admin_revoked_sessions').insert([{user_id:userId,session_id:sessionId,reason,revoked_by:admin.id,expires_at:body?.expires_at||null}]).select().single();if(error)throw error;
  await recordSecurityEvent(sb,admin,req,'admin_session_revoked','high',80,{target_user_id:userId,session_id:sessionId});
  await logAdminAction(sb,admin,'admin_session_revoke','admin_session',data.id,null,{user_id:userId,session_id:sessionId,reason},req);
  return{success:true,revocation:data};
}

async function upsertAdminAccessPolicy(sb, body, admin, req) {
  const name=String(body?.name||'').trim();if(!name)throw badRequest('name required');
  const row={name,enabled:body?.enabled===true,priority:Number(body?.priority||100),allowed_countries:Array.isArray(body?.allowed_countries)?body.allowed_countries:[],denied_countries:Array.isArray(body?.denied_countries)?body.denied_countries:[],allowed_ips:Array.isArray(body?.allowed_ips)?body.allowed_ips:[],denied_ips:Array.isArray(body?.denied_ips)?body.denied_ips:[],require_trusted_device:body?.require_trusted_device===true,max_session_minutes:body?.max_session_minutes??null,applies_to_roles:Array.isArray(body?.applies_to_roles)?body.applies_to_roles:['super_admin','admin','support'],updated_by:admin.id,created_by:admin.id,updated_at:new Date().toISOString()};
  const {data,error}=await sb.from('admin_access_policies').upsert(row,{onConflict:'name'}).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'admin_access_policy_upsert','admin_access_policy',data.id,null,{name,enabled:data.enabled},req);return{success:true,policy:data};
}

async function trustAdminDevice(sb, body, admin, req) {
  const userId=body?.user_id,device=String(body?.device_fingerprint||'').trim();if(!userId||!device)throw badRequest('user_id and device_fingerprint required');
  const row={user_id:userId,device_fingerprint:device,label:body?.label||null,trusted_until:body?.trusted_until||null,last_seen_at:new Date().toISOString(),last_ip:req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()||null,revoked_at:null};
  const {data,error}=await sb.from('admin_trusted_devices').upsert(row,{onConflict:'user_id,device_fingerprint'}).select().single();if(error)throw error;
  await logAdminAction(sb,admin,'admin_device_trust','admin_device',data.id,null,{user_id:userId,label:row.label,trusted_until:row.trusted_until},req);return{success:true,device:data};
}

async function evaluateWorkflowConditions(sb, conditions) {
  const list=Array.isArray(conditions)?conditions:[];
  for(const c of list){
    if(!c||c.type==='always')continue;
    if(c.type==='support_sla_breached'){
      const {count,error}=await sb.from('support_tickets').select('*',{count:'exact',head:true}).not('status','in','(resolved,closed)').lt('sla_due_at',new Date().toISOString());if(error)throw error;
      if((count||0)<Number(c.min||1))return false;
    }else if(c.type==='funding_sla_breached'){
      const {count,error}=await sb.from('funding_cases').select('*',{count:'exact',head:true}).is('closed_at',null).lt('sla_deadline_at',new Date().toISOString());if(error)throw error;
      if((count||0)<Number(c.min||1))return false;
    }else if(c.type==='critical_alerts'){
      const {count,error}=await sb.from('admin_alerts').select('*',{count:'exact',head:true}).eq('status','open').eq('severity','critical');if(error)throw error;
      if((count||0)<Number(c.min||1))return false;
    }else{
      return false;
    }
  }
  return true;
}

async function executeWorkflowActions(sb, workflow, runId) {
  const outputs=[];
  for(const action of Array.isArray(workflow.actions)?workflow.actions:[]){
    if(action.type==='create_task'||action.type==='create_reminder'){
      const {data,error}=await sb.from('admin_tasks').insert([{title:String(action.title||workflow.name).slice(0,300),description:action.description||null,assigned_to:action.assigned_to||null,priority:action.priority||'normal',status:'open',due_at:action.due_at||null,source:'workflow:'+workflow.id,request_id:'workflow_run:'+runId}]).select().single();if(error)throw error;outputs.push({type:action.type,id:data.id});
    }else if(action.type==='create_alert'){
      const {data,error}=await sb.from('admin_alerts').insert([{category:action.category||'workflow',title:String(action.title||workflow.name).slice(0,300),message:action.message||null,severity:action.severity||'warning',status:'open',owner_user_id:action.owner_user_id||null,request_id:'workflow_run:'+runId}]).select().single();if(error)throw error;outputs.push({type:'create_alert',id:data.id});
    }else{
      outputs.push({type:action.type||'unknown',status:'skipped_unsupported'});
    }
  }
  return outputs;
}

async function runOperationalSweeps(sb) {
  const now=new Date().toISOString();let created=0;
  const {data:support}=await sb.from('support_tickets').select('id,subject,priority,sla_due_at').not('status','in','(resolved,closed)').lt('sla_due_at',now).limit(200);
  for(const t of support||[]){
    const entityId=String(t.id);const {data:existing}=await sb.from('admin_alerts').select('id').eq('entity_type','support_ticket').eq('entity_id',entityId).eq('status','open').limit(1);
    if(!(existing||[]).length){await sb.from('admin_alerts').insert([{category:'sla',title:'Support SLA breached: '+String(t.subject||entityId).slice(0,180),severity:['critical','urgent'].includes(t.priority)?'critical':'high',entity_type:'support_ticket',entity_id:entityId,status:'open'}]);created++;}
  }
  const {data:funding}=await sb.from('funding_cases').select('id,case_reference,sla_deadline_at').is('closed_at',null).lt('sla_deadline_at',now).limit(200);
  for(const c of funding||[]){
    const entityId=String(c.id);const {data:existing}=await sb.from('admin_alerts').select('id').eq('entity_type','funding_case').eq('entity_id',entityId).eq('status','open').limit(1);
    if(!(existing||[]).length){await sb.from('admin_alerts').insert([{category:'sla',title:'Funding SLA breached: '+String(c.case_reference||entityId),severity:'high',entity_type:'funding_case',entity_id:entityId,status:'open'}]);created++;}
  }
  return{created};
}

async function runScheduledWorkflows(sb) {
  const now=Date.now(),nowIso=new Date(now).toISOString();
  const {data:workflows,error}=await sb.from('admin_workflows').select('*').eq('enabled',true).eq('trigger_type','schedule').limit(200);if(error)throw error;
  let executed=0,failed=0,skipped=0;const details=[];
  for(const w of workflows||[]){
    const interval=Math.max(60,Number(w.trigger_config?.intervalMinutes||60));
    const {data:state}=await sb.from('admin_workflow_schedule_state').select('*').eq('workflow_id',w.id).maybeSingle();
    if(state?.next_run_at&&new Date(state.next_run_at).getTime()>now){skipped++;continue;}
    const {data:run,error:runErr}=await sb.from('admin_workflow_runs').insert([{workflow_id:w.id,status:'running',started_at:nowIso,trigger_payload:{source:'vercel_cron'}}]).select().single();
    if(runErr){failed++;continue;}
    try{
      const conditionsOk=await evaluateWorkflowConditions(sb,w.conditions);
      const output=conditionsOk?await executeWorkflowActions(sb,w,run.id):[];
      const status=conditionsOk?'succeeded':'skipped';
      await sb.from('admin_workflow_runs').update({status,completed_at:new Date().toISOString(),output:{actions:output}}).eq('id',run.id);
      await sb.from('admin_workflow_schedule_state').upsert({workflow_id:w.id,last_run_at:new Date().toISOString(),next_run_at:new Date(now+interval*60000).toISOString(),last_status:status,updated_at:new Date().toISOString()},{onConflict:'workflow_id'});
      if(conditionsOk)executed++;else skipped++;details.push({workflowId:w.id,status});
    }catch(e){
      failed++;await sb.from('admin_workflow_runs').update({status:'failed',completed_at:new Date().toISOString(),error_code:e.code||'WORKFLOW_FAILED',error_message:String(e.message||e).slice(0,1000)}).eq('id',run.id);
      await sb.from('admin_workflow_schedule_state').upsert({workflow_id:w.id,last_run_at:new Date().toISOString(),next_run_at:new Date(now+interval*60000).toISOString(),last_status:'failed',updated_at:new Date().toISOString()},{onConflict:'workflow_id'});
      details.push({workflowId:w.id,status:'failed'});
    }
  }
  const sweeps=await runOperationalSweeps(sb);
  return{success:true,executed,failed,skipped,sweeps,details};
}

async function getControlCenterOverview(sb) {
  const now=new Date().toISOString();
  const [tasksRes,approvalsRes,alertsRes,reconRes,secRes,fundingRes,supportRes,renewalsRes]=await Promise.all([
    sb.from('admin_tasks').select('*').not('status','in','(done,cancelled)').order('priority',{ascending:false}).limit(500),
    sb.from('admin_approval_requests').select('*').eq('status','pending').order('created_at',{ascending:false}).limit(500),
    sb.from('admin_alerts').select('*').eq('status','open').order('created_at',{ascending:false}).limit(500),
    sb.from('finance_reconciliation_items').select('*').in('status',['unmatched','variance']).limit(500),
    sb.from('admin_security_events').select('*').in('severity',['high','critical']).is('acknowledged_at',null).order('created_at',{ascending:false}).limit(500),
    sb.from('funding_cases').select('id,case_reference,status,sla_deadline_at,assigned_to').is('closed_at',null).order('created_at',{ascending:false}).limit(500),
    sb.from('support_tickets').select('*').not('status','in','(resolved,closed)').order('created_at',{ascending:false}).limit(500),
    sb.from('crm_renewals').select('*').in('risk_level',['high','critical']).order('renewal_date',{ascending:true}).limit(500)
  ]);for(const r of [tasksRes,approvalsRes,alertsRes,reconRes,secRes,fundingRes,supportRes,renewalsRes])if(r.error)throw r.error;
  const funding=fundingRes.data||[],support=supportRes.data||[];
  return{success:true,generatedAt:new Date().toISOString(),tasks:tasksRes.data||[],approvals:approvalsRes.data||[],alerts:alertsRes.data||[],paymentExceptions:reconRes.data||[],securityExceptions:secRes.data||[],fundingCases:funding,customerFollowUps:renewalsRes.data||[],slaBreaches:{funding:funding.filter(x=>x.sla_deadline_at&&x.sla_deadline_at<now),support:support.filter(x=>x.sla_due_at&&x.sla_due_at<now)},supportTickets:support};
}

async function getConfigDrift(sb) {
  const {data,error}=await sb.from('admin_config_snapshots').select('*').order('captured_at',{ascending:false}).limit(5000);if(error)throw error;
  const grouped={};
  for(const row of data||[]){const k=row.config_key;grouped[k]=grouped[k]||{};if(!grouped[k][row.environment])grouped[k][row.environment]=row;}
  const drift=[];for(const [key,envs] of Object.entries(grouped)){const vals=Object.entries(envs);if(vals.length<2)continue;const hashes=new Set(vals.map(([,r])=>String(r.present)+':'+String(r.value_hash||'')));if(hashes.size>1)drift.push({key,environments:Object.fromEntries(vals.map(([e,r])=>[e,{present:r.present,hash:r.value_hash,capturedAt:r.captured_at}]))});}
  return{success:true,drift,count:drift.length};
}

async function createFinanceCollection(sb,body,admin,req){
  if(!body?.due_date)throw badRequest('due_date required');const row={user_id:body?.user_id||null,organization_id:body?.organization_id||null,amount_due:Number(body?.amount_due||0),currency:body?.currency||'SAR',due_date:body.due_date,status:body?.status||'open',owner_user_id:body?.owner_user_id||admin.id,next_action:body?.next_action||null,next_action_at:body?.next_action_at||null,notes:body?.notes||null};
  const {data,error}=await sb.from('finance_collections').insert([row]).select().single();if(error)throw error;await logAdminAction(sb,admin,'finance_collection_create','finance_collection',data.id,null,{amount_due:data.amount_due,due_date:data.due_date},req);return{success:true,collection:data};
}
async function createFinanceContract(sb,body,admin,req){
  if(!body?.title)throw badRequest('title required');const row={organization_id:body?.organization_id||null,advisory_client_id:body?.advisory_client_id||null,title:String(body.title).slice(0,300),contract_number:body?.contract_number||null,value_amount:Number(body?.value_amount||0),currency:body?.currency||'SAR',status:body?.status||'draft',start_date:body?.start_date||null,end_date:body?.end_date||null,renewal_notice_days:Number(body?.renewal_notice_days??30),owner_user_id:body?.owner_user_id||admin.id,document_path:body?.document_path||null,metadata:body?.metadata&&typeof body.metadata==='object'?body.metadata:{}};
  const {data,error}=await sb.from('finance_contracts').insert([row]).select().single();if(error)throw error;await logAdminAction(sb,admin,'finance_contract_create','finance_contract',data.id,null,{title:data.title,value_amount:data.value_amount},req);return{success:true,contract:data};
}
async function createCrmRenewal(sb,body,admin,req){
  if(!body?.renewal_date)throw badRequest('renewal_date required');const row={organization_id:body?.organization_id||null,client_id:body?.client_id||null,subscription_user_id:body?.subscription_user_id||null,renewal_date:body.renewal_date,value_amount:Number(body?.value_amount||0),currency:body?.currency||'SAR',status:body?.status||'upcoming',owner_user_id:body?.owner_user_id||admin.id,risk_level:body?.risk_level||'low',notes:body?.notes||null};
  const {data,error}=await sb.from('crm_renewals').insert([row]).select().single();if(error)throw error;await logAdminAction(sb,admin,'crm_renewal_create','crm_renewal',data.id,null,{renewal_date:data.renewal_date,risk_level:data.risk_level},req);return{success:true,renewal:data};
}

// ── Stats ───────────────────────────────────────────────────
async function safeCount(sb, table) {
  try {
    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  } catch (e) {
    // Isolate missing or inaccessible tables (e.g. funding_cases not created yet) so
    // unrelated admin endpoints such as users/stats do not return 500.
    if (/relation.*does not exist|undefined table|invalid input syntax/i.test(e.message || '')) {
      return 0;
    }
    throw e;
  }
}

async function getStats(sb) {
  const totalUsers = await getTotalUsers(sb);

  const [
    { count: proCount },
    { count: enterpriseCount },
    { count: scenariosCount },
    fundingCasesCount,
    subscriptionsCount,
    messagesCount,
    advisoryClientsCount,
    advisoryProjectsCount,
    recoveryAssetsCount,
    citiesCount,
    aiReviewsCount,
    { data: recentSubs },
    { data: profileList }
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro'),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise'),
    sb.from('scenarios').select('*', { count: 'exact', head: true }),
    safeCount(sb, 'funding_cases'),
    safeCount(sb, 'subscriptions'),
    safeCount(sb, 'contact_messages'),
    safeCount(sb, 'advisory_clients'),
    safeCount(sb, 'advisory_projects'),
    safeCount(sb, 'recovery_assets'),
    safeCount(sb, 'cities'),
    safeCount(sb, 'ai_review_requests'),
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
      fundingCases: fundingCasesCount || 0,
      subscriptions: subscriptionsCount || 0,
      messages: messagesCount || 0,
      advisoryClients: advisoryClientsCount || 0,
      advisoryProjects: advisoryProjectsCount || 0,
      recoveryAssets: recoveryAssetsCount || 0,
      cities: citiesCount || 0,
      aiReviews: aiReviewsCount || 0,
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

// ── Funding Cases ───────────────────────────────────────────
// Logic lives in lib/api/funding-cases-admin.js and is re-exported below.

async function verifyClientToken(req, sb) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (e) {
    return null;
  }
}

async function getClientFundingCases(sb, userId) {
  const { data, error } = await sb
    .from('funding_cases')
    .select('id, case_reference, status, source, name, company, email, phone, country, financing_type, amount, purpose_category, sector, readiness_score, next_action_at, sla_deadline_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return { success: true, cases: data || [], statusLabels: FundingCases.FUNDING_STATUS_LABELS };
}

async function getClientFundingCaseDetail(sb, id, userId) {
  const { data: caseData, error } = await sb
    .from('funding_cases')
    .select('id, case_reference, status, source, name, company, email, phone, country, financing_type, amount, purpose_category, purpose, sector, readiness_score, next_action_at, sla_deadline_at, provider_name, submitted_at, approved_at, declined_at, closed_at, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !caseData) throw new Error('Funding case not found');

  const [{ data: events }, { data: documents }] = await Promise.all([
    sb.from('funding_case_events').select('*').eq('case_id', id).order('created_at', { ascending: false }),
    sb.from('funding_case_documents').select('*').eq('case_id', id).order('created_at', { ascending: false })
  ]);

  const docsWithUrls = await Promise.all((documents || []).map(async d => {
    try {
      const { data: urlData } = await sb.storage
        .from(d.storage_bucket || 'funding-documents')
        .createSignedUrl(d.storage_path, 3600);
      return { ...d, signedUrl: urlData?.signedUrl || null };
    } catch (e) {
      return { ...d, signedUrl: null };
    }
  }));

  return {
    success: true,
    case: caseData,
    events: events || [],
    documents: docsWithUrls,
    statusLabels: FundingCases.FUNDING_STATUS_LABELS
  };
}

async function guestLookupFundingCase(sb, payload) {
  const caseReference = String(payload.caseReference || '').trim().toUpperCase();
  const email = String(payload.email || '').trim().toLowerCase();
  const phone = String(payload.phone || '').trim();
  if (!caseReference || (!email && !phone)) {
    throw new HttpError(400, 'Case reference and email or phone are required');
  }

  const { data: caseData, error } = await sb
    .from('funding_cases')
    .select('id, case_reference, status, name, company, email, phone, country, financing_type, amount, purpose_category, created_at, updated_at')
    .eq('case_reference', caseReference)
    .maybeSingle();

  // .maybeSingle() contract:
  //   data !== null && error === null  → exactly one matching row found
  //   data === null && error === null  → zero matching rows (expected absence)
  //   error !== null                   → operational or data-contract failure
  if (error) {
    console.error('[guest-lookup] Supabase operational error:', error);
    throw new HttpError(500, 'Unable to process request');
  }

  if (!caseData) {
    // Expected absence (no matching row) or contact mismatch are normalized
    // to the same public response to avoid case enumeration.
    throw new HttpError(404, 'Case not found or details do not match');
  }

  const normalizedCasePhone = String(caseData.phone || '').replace(/[\s\-()+]/g, '');
  const normalizedInputPhone = phone.replace(/[\s\-()+]/g, '');
  const emailMatch = email && caseData.email && caseData.email.toLowerCase() === email;
  const phoneMatch = phone && normalizedCasePhone && normalizedCasePhone === normalizedInputPhone;
  if (!emailMatch && !phoneMatch) {
    throw new HttpError(404, 'Case not found or details do not match');
  }

  return {
    success: true,
    case: {
      id: caseData.id,
      case_reference: caseData.case_reference,
      status: caseData.status,
      name: caseData.name,
      company: caseData.company,
      country: caseData.country,
      financing_type: caseData.financing_type,
      amount: caseData.amount,
      purpose_category: caseData.purpose_category,
      created_at: caseData.created_at,
      updated_at: caseData.updated_at
    },
    portalLink: `https://bonds-global.com/client/funding-case.html?id=${caseData.id}`,
    statusLabels: FundingCases.FUNDING_STATUS_LABELS
  };
}

// ── Main Handler ────────────────────────────────────────────
async function handler(req, res) {
  const handlerStartedAt = Date.now();
  req.adminRequestId = req.headers['x-request-id'] || generateRequestId();
  setAllowedOrigin(res, req);
  res.setHeader('X-Request-ID', req.adminRequestId);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  const action = req.query?.action || req.body?.action;

  try {
    // Telemetry/read-heavy actions get a higher rate limit so dashboards can auto-refresh.
    const LIVE_ACTIONS = new Set(['online-users', 'page-views', 'user-journey', 'user-activity']);
    const PUBLIC_ACTIONS = new Set(['funding-cases-guest-lookup']);
    const ADMIN_READ_ACTIONS = new Set([
      'bank-transfers', 'settings', 'exceptions', 'stats', 'executive-stats',
      'messages', 'admin-users', 'sent-messages', 'roles', 'me', 'users',
      'profile-completeness-stats', 'data-quality-report', 'user-360',
      'subscriptions', 'control-center-overview', 'security-sessions-overview',
      'config-drift', 'data-governance-overview', 'executive-analytics-v2',
      'ai-operations', 'platform-overview', 'automation-overview',
      'permission-simulator', 'security-operations-overview', 'finance-overview',
      'support-overview', 'support-ticket-detail', 'crm-overview', 'analytics',
      'ai-reviews', 'audit-log', 'assistant-audit-search', 'assistant-operational-replay', 'assistant-cost-governance', 'assistant-task-budget', 'operations-overview', 'system-health',
      'security-status', 'funding-cases-list', 'funding-cases-detail',
      'funding-cases-assignees', 'funding-cases-kpis',
      'funding-cases-client-list', 'funding-cases-client-detail'
    ]);
    // Guest lookup applies its own dedicated, fail-closed rate limits inside its handler.
    const GUEST_LOOKUP_ACTION = 'funding-cases-guest-lookup';
    let rateCategory;
    if (action === GUEST_LOOKUP_ACTION) {
      rateCategory = null;
    } else if (LIVE_ACTIONS.has(action)) {
      rateCategory = 'live';
    } else if (PUBLIC_ACTIONS.has(action)) {
      rateCategory = 'public';
    } else if (req.method === 'GET' && ADMIN_READ_ACTIONS.has(action)) {
      rateCategory = 'admin_read';
    } else {
      // Mutations and unclassified admin operations remain on the strict bucket.
      rateCategory = 'strict';
    }
    if (rateCategory && await checkRateLimit(rateCategory, req, res)) return;

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
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authorization header required' });
        const token = authHeader.slice(7);
        const { data: { user }, error } = await sb.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

        const role = await getActorRole(sb, user);
        if (!role || role === 'unknown') return res.status(403).json({ error: 'Admin or advisory access required' });
        if (!(await checkAdminMfa(req, sb))) {
          return res.status(403).json({ error: 'MFA required', role });
        }

        return res.status(200).json({
          success: true,
          id: user.id,
          email: user.email,
          role,
          isOwner: isOwner(user.email)
        });
      }
      if (action === 'admin-session-revoke') {
        const access=await requireAdminPermission(req,sb,'security.sessions.manage');
        return res.status(200).json(await revokeAdminSession(sb,req.body,access.user,req));
      }
      if (action === 'admin-access-policy-upsert') {
        const access=await requireAdminPermission(req,sb,'security.policies.manage');
        return res.status(200).json(await upsertAdminAccessPolicy(sb,req.body,access.user,req));
      }
      if (action === 'admin-device-trust') {
        const access=await requireAdminPermission(req,sb,'security.sessions.manage');
        return res.status(200).json(await trustAdminDevice(sb,req.body,access.user,req));
      }
      if (action === 'finance-collection-create') {
        const access=await requireAdminPermission(req,sb,'billing.reconcile');
        return res.status(200).json(await createFinanceCollection(sb,req.body,access.user,req));
      }
      if (action === 'finance-contract-create') {
        const access=await requireAdminPermission(req,sb,'billing.reconcile');
        return res.status(200).json(await createFinanceContract(sb,req.body,access.user,req));
      }
      if (action === 'crm-renewal-create') {
        const access=await requireAdminPermission(req,sb,'crm.write');
        return res.status(200).json(await createCrmRenewal(sb,req.body,access.user,req));
      }
      if (action === 'privacy-request-create') {
        const access = await requireAdminPermission(req, sb, 'governance.manage');
        return res.status(200).json(await createPrivacyRequest(sb,req.body,access.user,req));
      }
      if (action === 'data-export-request') {
        const access = await requireAdminPermission(req, sb, 'governance.manage');
        return res.status(200).json(await createDataExportRequest(sb,req.body,access.user,req));
      }
      if (action === 'user-merge-dry-run') {
        const access = await requireAdminPermission(req, sb, 'governance.manage');
        return res.status(200).json(await createUserMergeDryRun(sb,req.body,access.user,req));
      }
      if (action === 'audit-integrity-anchor') {
        const access = await requireAdminPermission(req, sb, 'governance.manage');
        return res.status(200).json(await createAuditIntegrityAnchor(sb,access.user,req));
      }
      if (action === 'admin-document-register') {
        const access = await requireAdminPermission(req, sb, 'documents.manage');
        return res.status(200).json(await registerAdminDocument(sb,req.body,access.user,req));
      }
      if (action === 'admin-document-version-add') {
        const access = await requireAdminPermission(req, sb, 'documents.manage');
        return res.status(200).json(await addAdminDocumentVersion(sb,req.body,access.user,req));
      }
      if (action === 'ai-kill-switch-update') {
        const access = await requireAdminPermission(req, sb, 'ai.operations.manage');
        return res.status(200).json(await setAiKillSwitch(sb, req.body, access.user, req));
      }
      if (action === 'ai-prompt-version-create') {
        const access = await requireAdminPermission(req, sb, 'ai.operations.manage');
        return res.status(200).json(await createAiPromptVersion(sb, req.body, access.user, req));
      }
      if (action === 'incident-create') {
        const access = await requireAdminPermission(req, sb, 'incident.manage');
        return res.status(200).json(await createIncident(sb, req.body, access.user, req));
      }
      if (action === 'incident-update') {
        const access = await requireAdminPermission(req, sb, 'incident.manage');
        return res.status(200).json(await updateIncident(sb, req.body, access.user, req));
      }
      if (action === 'backup-check-record') {
        const access = await requireAdminPermission(req, sb, 'recovery.manage');
        return res.status(200).json(await recordBackupCheck(sb, req.body, access.user, req));
      }
      if (action === 'config-snapshot-record') {
        const access = await requireAdminPermission(req, sb, 'configuration.manage');
        return res.status(200).json(await recordConfigSnapshot(sb, req.body, access.user, req));
      }
      if (action === 'feature-flag-upsert') {
        const access = await requireAdminPermission(req, sb, 'product.flags');
        return res.status(200).json(await upsertFeatureFlag(sb, req.body, access.user, req));
      }
      if (action === 'feature-flag-rollback') {
        const access = await requireAdminPermission(req, sb, 'product.flags');
        return res.status(200).json(await rollbackFeatureFlag(sb, req.body, access.user, req));
      }
      if (action === 'feature-flag-rule-upsert') {
        const access = await requireAdminPermission(req, sb, 'product.flags');
        return res.status(200).json(await upsertFeatureFlagRule(sb, req.body, access.user, req));
      }
      if (action === 'entitlement-override-create') {
        const access = await requireAdminPermission(req, sb, 'entitlements.manage');
        return res.status(200).json(await createEntitlementOverride(sb, req.body, access.user, req));
      }
      if (action === 'plan-entitlement-upsert') {
        const access = await requireAdminPermission(req, sb, 'entitlements.manage');
        return res.status(200).json(await upsertPlanEntitlement(sb, req.body, access.user, req));
      }
      if (action === 'workflow-upsert') {
        const access = await requireAdminPermission(req, sb, 'workflow.manage');
        return res.status(200).json(await upsertWorkflow(sb, req.body, access.user, req));
      }
      if (action === 'workflow-run-queue') {
        const access = await requireAdminPermission(req, sb, 'workflow.manage');
        return res.status(200).json(await queueWorkflowRun(sb, req.body, access.user, req));
      }
      if (action === 'admin-task-create') {
        const access = await requireAdminPermission(req, sb, 'operations.manage');
        return res.status(200).json(await createAdminTask(sb, req.body, access.user, req));
      }
      if (action === 'admin-queue-update') {
        const access = await requireAdminPermission(req, sb, 'operations.manage');
        return res.status(200).json(await updateAdminQueueItem(sb, req.body, access.user, req));
      }
      if (action === 'temporary-permission-grant') {
        const access = await requireAdminPermission(req, sb, 'roles.manage');
        return res.status(200).json(await grantTemporaryPermission(sb, req.body, access.user, req));
      }
      if (action === 'approval-request-create') {
        const access = await requireAdminPermission(req, sb, 'roles.read');
        return res.status(200).json(await createApprovalRequest(sb, req.body, access.user, req));
      }
      if (action === 'finance-refund-create') {
        const access = await requireAdminPermission(req, sb, 'billing.refund');
        await recordSecurityEvent(sb, access.user, req, 'finance_refund_requested', 'high', 70, { amount: Number(req.body?.amount || 0) });
        return res.status(200).json(await createFinanceRefund(sb, req.body, access.user, req));
      }
      if (action === 'finance-refund-update') {
        const access = await requireAdminPermission(req, sb, 'billing.refund');
        await recordSecurityEvent(sb, access.user, req, 'finance_refund_updated', 'high', 75, { status: req.body?.status || null });
        return res.status(200).json(await updateFinanceRefund(sb, req.body, access.user, req));
      }
      if (action === 'finance-reconciliation-upsert') {
        const access = await requireAdminPermission(req, sb, 'billing.reconcile');
        return res.status(200).json(await upsertReconciliationItem(sb, req.body, access.user, req));
      }
      if (action === 'finance-revenue-exception-create') {
        const access = await requireAdminPermission(req, sb, 'billing.reconcile');
        return res.status(200).json(await createRevenueException(sb, req.body, access.user, req));
      }
      if (action === 'support-ticket-create') {
        const access = await requireAdminPermission(req, sb, 'support.manage');
        return res.status(200).json(await createSupportTicket(sb, req.body, access.user, req));
      }
      if (action === 'support-ticket-update') {
        const access = await requireAdminPermission(req, sb, 'support.manage');
        return res.status(200).json(await updateSupportTicket(sb, req.body, access.user, req));
      }
      if (action === 'support-note-add') {
        const access = await requireAdminPermission(req, sb, 'support.manage');
        return res.status(200).json(await addSupportNote(sb, req.body, access.user, req));
      }
      if (action === 'crm-organization-create') {
        const access = await requireAdminPermission(req, sb, 'crm.write');
        return res.status(200).json(await createCrmOrganization(sb, req.body, access.user, req));
      }
      if (action === 'crm-opportunity-create') {
        const access = await requireAdminPermission(req, sb, 'crm.write');
        return res.status(200).json(await createCrmOpportunity(sb, req.body, access.user, req));
      }
      if (action === 'crm-opportunity-update') {
        const access = await requireAdminPermission(req, sb, 'crm.write');
        return res.status(200).json(await updateCrmOpportunity(sb, req.body, access.user, req));
      }
      if (action === 'crm-customer-success-upsert') {
        const access = await requireAdminPermission(req, sb, 'crm.write');
        return res.status(200).json(await upsertCrmCustomerSuccess(sb, req.body, access.user, req));
      }
      if (action === 'service-request-status-update') {
        const access = await requireAdminPermission(req, sb, 'crm.write');
        return res.status(200).json(await updateServiceRequestStatus(sb, req.body, access.user, req));
      }
      if (action === 'user-360-note') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await addUser360Note(sb, req.body, admin, req));
      }
      if (action === 'user-360-tags') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await setUser360Tags(sb, req.body, admin, req));
      }
      if (action === 'users') {
        const start = Date.now();
        const requestId = req.headers['x-request-id'] || generateRequestId();
        try {
          if (!req.headers.authorization?.startsWith('Bearer ')) {
            safeAdminLog({ requestId, endpoint: 'users', status: 401, authenticated: false, duration: Date.now() - start });
            return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED', requestId });
          }
          const admin = await verifyAdmin(req, sb);
          if (!admin) {
            safeAdminLog({ requestId, endpoint: 'users', status: 403, authenticated: true, duration: Date.now() - start });
            return res.status(403).json({ error: 'Admin required', code: 'FORBIDDEN', requestId });
          }
          const role = await getAdminRoleForUser(sb, admin.id);
          const params = {
            limit: req.query?.limit,
            offset: req.query?.offset,
            search: req.query?.search,
            tier: req.query?.tier,
            status: req.query?.status,
            completeness: req.query?.completeness
          };
          const result = await getUsers(sb, params);
          safeAdminLog({ requestId, endpoint: 'users', status: 200, authenticated: true, userId: admin.id, role, duration: Date.now() - start });
          return res.status(200).json({ ...result, requestId });
        } catch (err) {
          const status = err.status || 500;
          const code = status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : 'SERVER_ERROR';
          const message = err.message || 'Failed to load users';
          safeAdminLog({ requestId, endpoint: 'users', status, authenticated: status !== 500, errorCode: err.code || err.message, duration: Date.now() - start });
          if (status === 500) console.error('[admin/users] error:', err);
          return res.status(status).json({ error: message, code, requestId });
        }
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
      if (action === 'user-360') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getUser360(sb, req.query?.user_id));
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
      if (action === 'workflow-cron') {
        const configured=process.env.CRON_SECRET;
        if(!configured) return res.status(503).json({error:'CRON_SECRET not configured',requestId:req.adminRequestId});
        if(req.headers.authorization!=='Bearer '+configured) return res.status(401).json({error:'Cron authorization required',requestId:req.adminRequestId});
        return res.status(200).json(await runScheduledWorkflows(sb));
      }
      if (action === 'control-center-overview') {
        const access=await requireAdminPermission(req,sb,'operations.manage');
        return res.status(200).json(await getControlCenterOverview(sb));
      }
      if (action === 'security-sessions-overview') {
        const access=await requireAdminPermission(req,sb,'security.read');
        return res.status(200).json(await getSecuritySessionsOverview(sb));
      }
      if (action === 'config-drift') {
        const access=await requireAdminPermission(req,sb,'configuration.read');
        return res.status(200).json(await getConfigDrift(sb));
      }
      if (action === 'data-governance-overview') {
        const access = await requireAdminPermission(req, sb, 'governance.read');
        return res.status(200).json(await getDataGovernanceOverview(sb, access));
      }
      if (action === 'executive-analytics-v2') {
        const access = await requireAdminPermission(req, sb, 'analytics.executive');
        return res.status(200).json(await getExecutiveAnalyticsV2(sb));
      }
      if (action === 'ai-operations') {
        const access = await requireAdminPermission(req, sb, 'ai.operations.read');
        return res.status(200).json(await getAiOperations(sb));
      }
      if (action === 'assistant-audit-search') {
        await requireAdminPermission(req, sb, 'ai.operations.read');
        return res.status(200).json(await searchAssistantAudit(sb, req.query || {}));
      }
      if (action === 'assistant-operational-replay') {
        await requireAdminPermission(req, sb, 'ai.operations.read');
        return res.status(200).json(await getAssistantOperationalReplay(sb, req.query || {}));
      }
      if (action === 'assistant-cost-governance') {
        await requireAdminPermission(req, sb, 'ai.operations.read');
        return res.status(200).json(await getAssistantCostGovernance(sb, req.query || {}));
      }
      if (action === 'assistant-task-budget') {
        await requireAdminPermission(req, sb, 'ai.operations.read');
        return res.status(200).json(await getAssistantTaskBudget(sb, req.query || {}));
      }
      if (action === 'platform-overview') {
        const access = await requireAdminPermission(req, sb, 'observability.read');
        const result = await getPlatformOverview(sb);
        await recordRequestMetric(sb, req, 200, handlerStartedAt, access.user.id);
        return res.status(200).json({ ...result, requestId: req.adminRequestId });
      }
      if (action === 'automation-overview') {
        const access = await requireAdminPermission(req, sb, 'operations.manage');
        return res.status(200).json(await getAutomationOverview(sb, access.permissions));
      }
      if (action === 'permission-simulator') {
        await requireAdminPermission(req, sb, 'roles.read');
        return res.status(200).json(await simulateAdminPermissions(sb, req.query?.user_id));
      }
      if (action === 'security-operations-overview') {
        await requireAdminPermission(req, sb, 'security.read');
        return res.status(200).json(await getSecurityOperationsOverview(sb));
      }
      if (action === 'finance-overview') {
        const access = await requireAdminPermission(req, sb, 'billing.read');
        return res.status(200).json(await getFinanceOverview(sb, access.user.id, req.query || {}));
      }
      if (action === 'support-overview') {
        await requireAdminPermission(req, sb, 'support.manage');
        return res.status(200).json(await getSupportOverview(sb));
      }
      if (action === 'support-ticket-detail') {
        await requireAdminPermission(req, sb, 'support.manage');
        return res.status(200).json(await getSupportTicketDetail(sb, req.query?.ticket_id));
      }
      if (action === 'crm-overview') {
        await requireAdminPermission(req, sb, 'crm.read');
        return res.status(200).json(await getCrmOverview(sb));
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
      if (action === 'operations-overview') {
        const admin = await verifyAdmin(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const requestId = req.headers['x-request-id'] || generateRequestId();
        const startedAt = Date.now();
        try {
          const overview = await getOperationsOverview(sb);
          safeAdminLog({
            requestId,
            endpoint: 'operations-overview',
            status: 200,
            authenticated: true,
            userId: admin.id,
            role: await getActorRole(sb, admin),
            duration: Date.now() - startedAt
          });
          return res.status(200).json({ ...overview, requestId });
        } catch (err) {
          safeAdminLog({
            requestId,
            endpoint: 'operations-overview',
            status: 500,
            authenticated: true,
            userId: admin.id,
            errorCode: err?.message || 'OPERATIONS_OVERVIEW_FAILED',
            duration: Date.now() - startedAt
          });
          return res.status(500).json({ success: false, error: 'Operations overview failed', code: 'OPERATIONS_OVERVIEW_FAILED', requestId });
        }
      }
      if (action === 'system-health') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        const requestId = req.headers['x-request-id'] || generateRequestId();
        try {
          const health = await getSystemHealth(sb);
          safeAdminLog({
            requestId,
            endpoint: 'system-health',
            status: 200,
            authenticated: true,
            userId: admin.id,
            role: await getActorRole(sb, admin),
            duration: health.durationMs
          });
          return res.status(200).json({ ...health, requestId });
        } catch (err) {
          safeAdminLog({
            requestId,
            endpoint: 'system-health',
            status: 500,
            authenticated: true,
            userId: admin.id,
            errorCode: err?.message || 'SYSTEM_HEALTH_FAILED',
            duration: 0
          });
          return res.status(500).json({ success: false, error: 'System health check failed', code: 'SYSTEM_HEALTH_FAILED', requestId });
        }
      }
      if (action === 'security-status') {
        const admin = await verifyAdminStrict(req, sb);
        if (!admin) return res.status(403).json({ error: 'Admin required' });
        return res.status(200).json(await getSecurityStatus(sb, admin));
      }
      if (action === 'funding-cases-list') {
        const admin = await verifyFundingCaseAccess(req, sb, 'viewer');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory access required' });
        return res.status(200).json(await FundingCases.getFundingCases(sb, req.query || {}));
      }
      if (action === 'funding-cases-detail') {
        const admin = await verifyFundingCaseAccess(req, sb, 'viewer');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory access required' });
        if (!req.query?.id) return res.status(400).json({ error: 'Missing id' });
        return res.status(200).json(await FundingCases.getFundingCaseDetail(sb, req.query.id));
      }
      if (action === 'funding-cases-assignees') {
        const admin = await verifyFundingCaseAccess(req, sb, 'manager');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory manager required' });
        return res.status(200).json(await FundingCases.listAssignees(sb));
      }
      if (action === 'funding-cases-kpis') {
        const admin = await verifyFundingCaseAccess(req, sb, 'viewer');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory access required' });
        return res.status(200).json(await FundingCases.getFundingCaseKpis(sb));
      }
      if (action === 'funding-cases-client-list') {
        const user = await verifyClientToken(req, sb);
        if (!user) return res.status(401).json({ error: 'Authentication required' });
        return res.status(200).json(await getClientFundingCases(sb, user.id));
      }
      if (action === 'funding-cases-client-detail') {
        const user = await verifyClientToken(req, sb);
        if (!user) return res.status(401).json({ error: 'Authentication required' });
        if (!req.query?.id) return res.status(400).json({ error: 'Missing id' });
        return res.status(200).json(await getClientFundingCaseDetail(sb, req.query.id, user.id));
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
        if (subAction === 'cancel-access') return res.status(200).json(await cancelAccess(sb, req.body, admin, req));
        if (subAction === 'delete') return res.status(200).json(await deleteUser(sb, req.body, admin, req));
        if (subAction === 'reset-password') return res.status(200).json(await resetPassword(sb, req.body, admin, req));
        return res.status(400).json({ error: 'Invalid sub-action' });
      }
      if (action === 'messages') {
        const subAction = req.body?.action;
        if (subAction === 'send') {
          const admin = await verifyAdmin(req, sb);
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
      if (action === 'run-migrations') {
        const cronSecret = req.headers['x-cron-secret'];
        const expectedCronSecret = process.env.CRON_SECRET;
        if (!expectedCronSecret || cronSecret !== expectedCronSecret) {
          return res.status(403).json({ success: false, error: 'Unauthorized' });
        }
        const targetFile = validateMigrationPath(req.query?.migration_file || req.body?.migration_file);
        const commitSha = req.query?.commit_sha || req.body?.commit_sha;
        const result = await applyMigration(targetFile, commitSha);
        return res.status(200).json({ success: true, ...result });
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
      if (action === 'funding-cases-update') {
        const admin = await verifyFundingCaseAccess(req, sb, 'manager');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory manager required' });
        if (!req.body?.id) return res.status(400).json({ error: 'Missing id' });
        const data = await FundingCases.updateFundingCase(sb, req.body.id, req.body, admin);
        return res.status(200).json({ success: true, case: data });
      }
      if (action === 'funding-cases-add-note') {
        const admin = await verifyFundingCaseAccess(req, sb, 'advisor');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory access required' });
        if (!req.body?.caseId || !req.body?.note) return res.status(400).json({ error: 'Missing caseId or note' });
        const data = await FundingCases.addFundingCaseNote(sb, req.body.caseId, req.body.note, admin);
        return res.status(200).json({ success: true, event: data });
      }
      if (action === 'funding-cases-request-document') {
        const admin = await verifyFundingCaseAccess(req, sb, 'manager');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory manager required' });
        if (!req.body?.caseId) return res.status(400).json({ error: 'Missing caseId' });
        return res.status(200).json(await FundingCases.requestDocument(sb, req.body.caseId, req.body, admin));
      }
      if (action === 'funding-cases-upload-document') {
        const admin = await verifyFundingCaseAccess(req, sb, 'advisor');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory access required' });
        if (!req.body?.caseId || !req.body?.file) return res.status(400).json({ error: 'Missing caseId or file' });
        return res.status(200).json(await FundingCases.uploadDocument(sb, req.body.caseId, req.body.file, admin));
      }
      if (action === 'funding-cases-link-advisory') {
        const admin = await verifyFundingCaseAccess(req, sb, 'manager');
        if (!admin) return res.status(403).json({ error: 'Admin or advisory manager required' });
        if (!req.body?.caseId) return res.status(400).json({ error: 'Missing caseId' });
        return res.status(200).json(await FundingCases.linkAdvisoryClient(sb, req.body.caseId, req.body, admin));
      }
      if (action === 'send-funding-reminders') {
        const cronSecret = req.headers['x-cron-secret'];
        const expectedCronSecret = process.env.CRON_SECRET;
        let admin = null;
        if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
          admin = { id: null, email: 'cron@bonds-global.com' };
        } else {
          admin = await verifyAdmin(req, sb);
          if (!admin) return res.status(403).json({ error: 'Admin or cron required' });
        }
        return res.status(200).json(await FundingCases.sendFundingCaseReminders(sb, admin));
      }
      if (action === 'funding-cases-client-upload') {
        const user = await verifyClientToken(req, sb);
        if (!user) return res.status(401).json({ error: 'Authentication required' });
        const { caseId, file } = req.body || {};
        if (!caseId || !file) return res.status(400).json({ error: 'Missing caseId or file' });
        // Verify ownership
        const { data: caseRow, error: caseErr } = await sb.from('funding_cases')
          .select('id')
          .eq('id', caseId)
          .eq('user_id', user.id)
          .single();
        if (caseErr || !caseRow) return res.status(403).json({ error: 'Case not found' });
        const result = await FundingCases.clientUploadDocument(sb, caseId, file, { id: user.id, email: user.email });
        return res.status(200).json(result);
      }
      if (action === 'funding-cases-guest-lookup') {
        try {
          const body = req.body || {};
          const caseReference = String(body.caseReference || '').trim();

          // Global endpoint-scoped bucket: no client-IP-derived identity.
          if (await checkRateLimit('funding_case_guest_lookup_global', req, res, 'funding-case-guest-lookup-global', true)) {
            return;
          }

          const hmacSecret = process.env.RATE_LIMIT_HMAC_SECRET;
          if (!hmacSecret || typeof hmacSecret !== 'string' || hmacSecret.length === 0) {
            // Mandatory secret missing: fail closed, do not expose configuration state.
            res.setHeader('Retry-After', '60');
            res.status(429).json({ error: 'Too many requests. Please try again later.' });
            return;
          }

          const perCaseIdentity = crypto
            .createHmac('sha256', hmacSecret)
            .update(caseReference)
            .digest('hex');

          // Per-case bucket keyed by HMAC of normalized case_reference only.
          if (await checkRateLimit('funding_case_guest_lookup_per_case', req, res, perCaseIdentity, true)) {
            return;
          }

          return res.status(200).json(await guestLookupFundingCase(sb, body));
        } catch (err) {
          if (err?.status === 400 || err?.status === 404) {
            return res.status(err.status).json({ error: err.message });
          }
          if (err?.statusCode === 400) {
            return res.status(400).json({ error: 'Invalid request body' });
          }
          console.error('[guest-lookup] unhandled path error:', err);
          return res.status(500).json({ error: 'Unable to process request' });
        }
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
    const status = err.status || 500;
    await recordErrorEvent(sb, req, err, status);
    await recordRequestMetric(sb, req, status, handlerStartedAt);
    res.status(status).json({ error: err.message, requestId: req.adminRequestId });
  }
}

module.exports = handler;
module.exports.getUsers = getUsers;
module.exports.isReservedTestEmail = isReservedTestEmail;
