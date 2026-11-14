'use strict';

// Only app_metadata is server-controlled (service key writes). user_metadata
// and the top-level user.role claim are self-service forgeable and must never
// be trusted for entitlement.
function claimsRole(user) {
  return String(user?.app_metadata?.role || '').trim().toLowerCase();
}

async function adminTableRole(supabase, user) {
  if (!user?.id || !supabase || typeof supabase.from !== 'function') return '';
  try {
    const { data, error } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return '';
    return String(data?.role || '').trim().toLowerCase();
  } catch (_error) {
    return '';
  }
}

async function isExecuteEntitled(supabase, user) {
  const role = claimsRole(user) || await adminTableRole(supabase, user);
  if (role === 'admin' || role === 'super_admin') return true;
  if (!user?.id || !supabase || typeof supabase.from !== 'function') return false;

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status,tier,current_period_end')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return false;
    if (!['active', 'trialing'].includes(String(data.status || '').toLowerCase())) return false;
    if (!['pro', 'enterprise'].includes(String(data.tier || '').toLowerCase())) return false;

    if (data.current_period_end) {
      const end = Date.parse(data.current_period_end);
      if (!Number.isFinite(end) || end <= Date.now()) return false;
    }

    return true;
  } catch (_error) {
    return false;
  }
}

module.exports = { isExecuteEntitled };
