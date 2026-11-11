'use strict';

function userRole(user) {
  return String(
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    user?.role ||
    ''
  ).trim().toLowerCase();
}

async function isExecuteEntitled(supabase, user) {
  const role = userRole(user);
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
