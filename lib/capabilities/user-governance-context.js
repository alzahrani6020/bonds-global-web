'use strict';

// Resolve the existing user/RBAC/entitlement records at the server boundary.
// This does not grant roles, infer organization membership, or accept client claims.
class ResolutionError extends Error {
  constructor(code, httpStatus = 503) {
    super(code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function readRows(result) {
  if (!result || result.error || !Array.isArray(result.data)) {
    throw new ResolutionError('USER_GOVERNANCE_UNAVAILABLE');
  }
  return result.data;
}

function timestamp(value) {
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

function resolveTier(rows, userId, now) {
  // The existing subscriptions schema is unique by user_id. Multiple records
  // are an inconsistent authority, not a reason to choose the highest tier.
  if (rows.length > 1) throw new ResolutionError('SUBSCRIPTION_CONFLICT');
  if (rows.length === 0) return 'free';

  const row = rows[0];
  if (!row || row.user_id !== userId || typeof row.status !== 'string') {
    throw new ResolutionError('SUBSCRIPTION_INVALID');
  }
  if (!['active', 'trialing'].includes(row.status)) {
    if (!['inactive', 'canceled', 'cancelled', 'expired', 'past_due', 'unpaid',
      'incomplete', 'incomplete_expired', 'paused'].includes(row.status)) {
      throw new ResolutionError('SUBSCRIPTION_INVALID');
    }
    return 'free';
  }

  const start = timestamp(row.current_period_start);
  const end = timestamp(row.current_period_end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      !['free', 'pro', 'enterprise'].includes(row.tier)) {
    throw new ResolutionError('SUBSCRIPTION_INVALID');
  }
  return start <= now && now < end ? row.tier : 'free';
}

function activeOverrides(rows, userId, now) {
  return rows.filter(row => {
    if (!row || row.user_id !== userId) {
      throw new ResolutionError('ENTITLEMENT_CONTEXT_INVALID');
    }
    if (row.revoked_at != null) return false;
    const start = timestamp(row.starts_at);
    const end = row.expires_at == null ? Infinity : timestamp(row.expires_at);
    if (!Number.isFinite(start) || Number.isNaN(end) || end <= start) {
      throw new ResolutionError('ENTITLEMENT_CONTEXT_INVALID');
    }
    if (start > now || now >= end) return false;
    // A row targeting both a user and an organization has unresolved scope.
    // No organization id from profile metadata or request input is trusted.
    if (row.organization_id != null) {
      throw new ResolutionError('ENTITLEMENT_SCOPE_UNRESOLVED');
    }
    return true;
  });
}

function resolveEntitlements(keys, catalogs, plans, overrides) {
  const granted = [];
  for (const key of keys) {
    const definitions = catalogs.filter(row => row.key === key);
    if (definitions.length !== 1 ||
        !Object.prototype.hasOwnProperty.call(definitions[0], 'default_value')) {
      throw new ResolutionError('ENTITLEMENT_CATALOG_UNAVAILABLE');
    }

    const plan = plans.filter(row => row.entitlement_key === key);
    const personal = overrides.filter(row => row.entitlement_key === key);
    if (plan.length > 1 || personal.length > 1) {
      // No undocumented priority or "latest wins" rule for overlapping overrides.
      throw new ResolutionError('ENTITLEMENT_CONFLICT');
    }
    const source = personal[0] || plan[0];
    if (source && !Object.prototype.hasOwnProperty.call(source, 'value')) {
      throw new ResolutionError('ENTITLEMENT_CONTEXT_INVALID');
    }
    const value = source ? source.value : definitions[0].default_value;
    if (value === true) granted.push(key);
  }
  return granted;
}

async function resolveUserGovernanceContext({ user, service, supabase, now = Date.now() } = {}) {
  try {
    if (!user || typeof user.id !== 'string' || !user.id ||
        !service || !Array.isArray(service.governance?.entitlements) ||
        !Number.isFinite(now)) {
      throw new ResolutionError('USER_GOVERNANCE_UNAVAILABLE');
    }
    const db = supabase || require('../../v3/lib/supabase').getSupabaseClient();
    const [profileResult, permissionsResult, subscriptionResult] = await Promise.all([
      db.from('profiles').select('id,status').eq('id', user.id).maybeSingle(),
      db.rpc('get_user_permissions', { p_user_id: user.id }),
      db.from('subscriptions')
        .select('user_id,tier,status,current_period_start,current_period_end')
        .eq('user_id', user.id).limit(2)
    ]);

    if (!profileResult || profileResult.error ||
        profileResult.data?.id !== user.id ||
        typeof profileResult.data.status !== 'string') {
      throw new ResolutionError('USER_PROFILE_UNAVAILABLE');
    }
    // profiles.status is the existing administrative account switch (active /
    // inactive). Other restricted states, including banned/disabled, cannot pass.
    if (profileResult.data.status !== 'active') {
      throw new ResolutionError('USER_DISABLED', 403);
    }

    const permissions = readRows(permissionsResult).map(row => {
      if (!row || typeof row.permission_code !== 'string' || !row.permission_code) {
        throw new ResolutionError('USER_GOVERNANCE_UNAVAILABLE');
      }
      return row.permission_code;
    });
    const userTier = resolveTier(readRows(subscriptionResult), user.id, now);
    const keys = [...new Set(service.governance.entitlements)];
    let entitlements = [];

    if (keys.length) {
      const [catalogResult, plansResult, overridesResult] = await Promise.all([
        db.from('admin_entitlements').select('key,default_value').in('key', keys),
        db.from('admin_plan_entitlements').select('tier,entitlement_key,value')
          .eq('tier', userTier).in('entitlement_key', keys),
        db.from('admin_entitlement_overrides')
          .select('user_id,organization_id,entitlement_key,value,starts_at,expires_at,revoked_at', { count: 'exact' })
          .eq('user_id', user.id).in('entitlement_key', keys).is('revoked_at', null)
      ]);
      const overrides = readRows(overridesResult);
      // An API row limit must not hide a conflicting override and become a grant.
      if (typeof overridesResult.count !== 'number' || overridesResult.count !== overrides.length) {
        throw new ResolutionError('ENTITLEMENT_CONTEXT_INCOMPLETE');
      }
      const plans = readRows(plansResult);
      if (plans.some(row => row.tier !== userTier)) {
        throw new ResolutionError('ENTITLEMENT_CONTEXT_INVALID');
      }
      entitlements = resolveEntitlements(keys, readRows(catalogResult), plans,
        activeOverrides(overrides, user.id, now));
    }

    return {
      ok: true,
      context: {
        actor: { id: user.id },
        userId: user.id,
        userTier,
        governance: { permissions: [...new Set(permissions)], entitlements }
      }
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof ResolutionError ? error.code : 'USER_GOVERNANCE_UNAVAILABLE',
      httpStatus: error instanceof ResolutionError ? error.httpStatus : 503
    };
  }
}

async function probeUserGovernanceReadiness({ supabase } = {}) {
  if (!supabase && (!String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim() ||
      !String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim())) {
    return { status: 'not_configured', code: 'USER_GOVERNANCE_UNCONFIGURED' };
  }

  try {
    const db = supabase || require('../../v3/lib/supabase').getSupabaseClient();
    const { SERVICES } = require('./bonds-capability-registry');
    const enabled = Object.values(SERVICES).filter(service => service.enabled === true);
    const requiredPermissions = [...new Set(enabled.flatMap(service => service.governance.permissions))];
    const requiredEntitlements = [...new Set(enabled.flatMap(service => service.governance.entitlements))];
    const [permissionsResult, entitlementsResult, rpcResult] = await Promise.all([
      db.from('enterprise_permissions').select('code').in('code', requiredPermissions),
      db.from('admin_entitlements').select('key,value_type,default_value').in('key', requiredEntitlements),
      // The existing read-only RPC permits service_role to inspect any UUID.
      // Nil is not an application user: a nonempty result fails this probe.
      db.rpc('get_user_permissions', { p_user_id: '00000000-0000-0000-0000-000000000000' })
    ]);

    const permissions = readRows(permissionsResult);
    if (requiredPermissions.some(code => permissions.filter(row => row?.code === code).length !== 1)) {
      throw new ResolutionError('PERMISSION_CATALOG_UNAVAILABLE');
    }
    const entitlements = readRows(entitlementsResult);
    if (requiredEntitlements.some(key => {
      const definitions = entitlements.filter(row => row?.key === key);
      return definitions.length !== 1 || definitions[0].value_type !== 'boolean' ||
        typeof definitions[0].default_value !== 'boolean';
    })) {
      throw new ResolutionError('ENTITLEMENT_CATALOG_UNAVAILABLE');
    }
    if (readRows(rpcResult).length !== 0) {
      throw new ResolutionError('USER_PERMISSION_PROBE_INVALID');
    }

    // This proves metadata/configuration access, not any user's authorization.
    return { status: 'ok', code: null };
  } catch (error) {
    return { status: 'error',
      code: error instanceof ResolutionError ? error.code : 'USER_GOVERNANCE_UNAVAILABLE' };
  }
}

module.exports = { resolveUserGovernanceContext, probeUserGovernanceReadiness };
