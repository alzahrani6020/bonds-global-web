/**
 * Shared admin authorization helper.
 * Accepts either the unified admin_roles (super_admin/admin/support)
 * or the legacy user_roles (admin/editor).
 */

async function verifyAdminOrEditor(req, supabase) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return { authorized: false, reason: 'missing' };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { authorized: false, reason: 'invalid' };

  const userId = userData.user.id;

  // Unified admin dashboard roles
  const { data: adminRoles } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['super_admin', 'admin', 'support']);

  if (adminRoles && adminRoles.length > 0) {
    return { authorized: true, userId, role: adminRoles[0].role };
  }

  // Legacy valuation editor roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'editor']);

  if (userRoles && userRoles.length > 0) {
    return { authorized: true, userId, role: userRoles[0].role };
  }

  return { authorized: false, reason: 'forbidden' };
}

module.exports = { verifyAdminOrEditor };
