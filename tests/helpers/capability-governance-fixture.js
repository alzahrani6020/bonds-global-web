'use strict';

const { getService } = require('../../lib/capabilities/bonds-capability-registry');

// Only the external database boundary is simulated. The API, resolver, gateway,
// executor and pure capability adapters can run unchanged against this fixture.
function createGovernanceFixture({
  userId = 'governance-fixture-user',
  serviceCode = 'web-research',
  now = Date.now(),
  tier = 'pro',
  permissions,
  tables: replacements = {},
  failures = {}
} = {}) {
  const service = getService(serviceCode);
  const keys = service.governance.entitlements;
  const grantedPermissions = permissions === undefined ? service.governance.permissions : permissions;
  const tables = {
    profiles: [{ id: userId, status: 'active' }],
    subscriptions: [{
      user_id: userId, tier, status: 'active',
      current_period_start: new Date(now - 60_000).toISOString(),
      current_period_end: new Date(now + 3_600_000).toISOString()
    }],
    admin_entitlements: keys.map(key => ({ key, default_value: false })),
    admin_plan_entitlements: keys.map(key => ({ tier, entitlement_key: key, value: true })),
    admin_entitlement_overrides: [],
    ...replacements
  };
  const reads = [];
  const db = {
    from(table) {
      const filters = [];
      let maximum = 1000;
      let countRequested = false;
      function result(single = false) {
        reads.push({ table, filters: filters.map(({ kind, key, value }) => ({ kind, key, value })) });
        if (failures[table]) return { data: null, error: { message: 'Fixture database unavailable' } };
        const matching = (tables[table] || []).filter(row => filters.every(({ test }) => test(row)));
        const data = matching.slice(0, maximum);
        if (single && data.length > 1) return { data: null, error: { message: 'Multiple rows' } };
        return { data: single ? data[0] || null : data, error: null,
          ...(countRequested ? { count: matching.length } : {}) };
      }
      const query = {
        select(_fields, options = {}) { countRequested = options.count === 'exact'; return this; },
        eq(key, value) { filters.push({ kind: 'eq', key, value, test: row => row[key] === value }); return this; },
        in(key, value) { filters.push({ kind: 'in', key, value, test: row => value.includes(row[key]) }); return this; },
        is(key, value) { filters.push({ kind: 'is', key, value, test: row => row[key] === value }); return this; },
        limit(value) { maximum = value; return this; },
        maybeSingle() { return Promise.resolve(result(true)); },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); }
      };
      return query;
    },
    async rpc(name, args) {
      reads.push({ rpc: name, args });
      if (name !== 'get_user_permissions' || args.p_user_id !== userId || failures[name]) {
        return { data: null, error: { message: 'Fixture permission lookup unavailable' } };
      }
      return { data: grantedPermissions.map(permission_code => ({ permission_code })), error: null };
    }
  };
  return { db, tables, reads, user: { id: userId } };
}

module.exports = { createGovernanceFixture };
