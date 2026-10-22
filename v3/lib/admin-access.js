const crypto = require('crypto');
const { getSupabaseClient } = require('./supabase');

function constantTimeEqual(actual, expected) {
  const a = Buffer.from(String(actual || ''), 'utf8');
  const b = Buffer.from(String(expected || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function configuredOwnerEmails() {
  return String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

async function getBearerAdmin(req) {
  const authorization = String(req.headers.authorization || '');
  const bearer = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(bearer);
    const user = data?.user || null;
    if (error || !user) return null;

    const email = String(user.email || '').toLowerCase();
    if (configuredOwnerEmails().includes(email)) {
      return { user, role: 'owner', source: 'bearer' };
    }

    const { data: role, error: roleError } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleError && role && ['super_admin', 'admin'].includes(role.role)) {
      return { user, role: role.role, source: 'bearer' };
    }
  } catch (_error) {
    return null;
  }

  return null;
}

async function requireAdminAccess(req, options = {}) {
  const bearerAdmin = await getBearerAdmin(req);
  if (bearerAdmin) return bearerAdmin;

  const {
    staticTokenEnv = 'ADMIN_TOKEN',
    staticTokenHeader = 'x-admin-token',
    allowStaticToken = true,
    legacyFlagEnv = 'V3_ADMIN_ALLOW_LEGACY_TOKEN'
  } = options;

  const legacyEnabled = allowStaticToken &&
    String(process.env[legacyFlagEnv] ?? 'true').toLowerCase() !== 'false';
  const supplied = req.headers[staticTokenHeader];
  const expected = process.env[staticTokenEnv];

  if (
    legacyEnabled &&
    expected &&
    supplied &&
    constantTimeEqual(supplied, expected)
  ) {
    return { user: null, role: 'legacy_admin', source: 'static_token' };
  }

  return null;
}

async function getBearerAgentInboxUser(req) {
  const authorization = String(req.headers.authorization || '');
  const bearer = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(bearer);
    const user = data?.user || null;
    if (error || !user) return null;

    const email = String(user.email || '').toLowerCase();
    if (configuredOwnerEmails().includes(email)) {
      return { user, role:'owner', source:'bearer' };
    }

    const { data: role, error: roleError } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleError && role && ['super_admin','admin','support'].includes(role.role)) {
      return { user, role:role.role, source:'bearer' };
    }
  } catch (_error) {
    return null;
  }

  return null;
}

async function requireHumanApprovalAccess(req) {
  // Human approval decisions require an attributable bearer identity.
  // Legacy/static admin tokens are intentionally not accepted here.
  return getBearerAdmin(req);
}

async function requireAgentInboxAccess(req, options = {}) {
  const bearerAgent = await getBearerAgentInboxUser(req);
  if (bearerAgent) return bearerAgent;

  const {
    staticTokenEnv = 'ADMIN_TOKEN',
    staticTokenHeader = 'x-admin-token',
    allowStaticToken = true,
    legacyFlagEnv = 'V3_ADMIN_ALLOW_LEGACY_TOKEN'
  } = options;

  const legacyEnabled = allowStaticToken &&
    String(process.env[legacyFlagEnv] ?? 'true').toLowerCase() !== 'false';
  const supplied = req.headers[staticTokenHeader];
  const expected = process.env[staticTokenEnv];

  if (legacyEnabled && expected && supplied && constantTimeEqual(supplied, expected)) {
    return { user:null, role:'legacy_admin', source:'static_token' };
  }

  return null;
}

module.exports = {
  constantTimeEqual,
  configuredOwnerEmails,
  getBearerAdmin,
  requireAdminAccess,
  getBearerAgentInboxUser,
  requireAgentInboxAccess,
  requireHumanApprovalAccess
};
