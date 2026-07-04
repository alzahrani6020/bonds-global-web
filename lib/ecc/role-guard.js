/**
 * BONDS Executive Command Center — Role Guard (Phase E.1)
 *
 * Lightweight role awareness for portfolio and project command center.
 */

const VALID_ROLES = ['owner', 'admin', 'advisor', 'viewer'];
const DEFAULT_ROLE = 'viewer';

const PERMISSIONS = {
  viewer: ['read'],
  advisor: ['read', 'advise'],
  admin: ['read', 'advise', 'write', 'admin'],
  owner: ['read', 'advise', 'write', 'admin']
};

async function getUserRole(supabase, userId) {
  if (!supabase || !userId) return DEFAULT_ROLE;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('[RoleGuard] profile fetch failed:', error.message);
      return DEFAULT_ROLE;
    }
    const role = data?.role;
    return VALID_ROLES.includes(role) ? role : DEFAULT_ROLE;
  } catch (err) {
    console.warn('[RoleGuard] error fetching role:', err.message);
    return DEFAULT_ROLE;
  }
}

function can(role, action) {
  const allowed = PERMISSIONS[role] || PERMISSIONS[DEFAULT_ROLE];
  return allowed.includes(action);
}

function requireRole(role, action) {
  if (!can(role, action)) {
    throw new Error(`Role '${role}' is not allowed to perform '${action}'`);
  }
}

module.exports = {
  getUserRole,
  can,
  requireRole,
  VALID_ROLES,
  DEFAULT_ROLE
};
