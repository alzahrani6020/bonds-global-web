/**
 * Enterprise RBAC Client Helper — Bonds Global
 * Checks permissions against the enterprise permission system.
 */
(function (root) {
  'use strict';

  const MODULES = [
    'dashboard', 'advisory', 'recovery', 'city', 'ai_advisor',
    'reports', 'users', 'subscriptions', 'billing', 'settings'
  ];
  const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

  async function fetchPermissions() {
    const cached = root.BondsCache && root.BondsCache.get('user_permissions');
    if (cached) return cached;

    if (!root.BondsAuth || !root.BondsAuth.getSupabase) return {};
    const sb = root.BondsAuth.getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return {};

    const { data, error } = await sb
      .rpc('get_user_permissions', { p_user_id: user.id });
    if (error) throw error;
    const perms = {};
    (data || []).forEach(row => { perms[row.permission_code] = true; });
    if (root.BondsCache) root.BondsCache.set('user_permissions', perms, 5 * 60 * 1000);
    return perms;
  }

  async function hasPermission(permissionCode) {
    const perms = await fetchPermissions();
    return !!perms[permissionCode];
  }

  async function hasModuleAction(module, action) {
    return hasPermission(`${module}.${action}`);
  }

  function requirePermission(permissionCode, fallback) {
    hasPermission(permissionCode).then(ok => {
      if (!ok && typeof fallback === 'function') fallback();
    });
  }

  function clearCache() {
    if (root.BondsCache) root.BondsCache.remove('user_permissions');
  }

  root.BondsRBAC = {
    MODULES,
    ACTIONS,
    fetchPermissions,
    hasPermission,
    hasModuleAction,
    requirePermission,
    clearCache
  };
})(window);
