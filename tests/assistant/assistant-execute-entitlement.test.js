/** @jest-environment node */

const { isExecuteEntitled } = require('../../lib/assistant/execute-entitlement');

function supabaseFor(row, error = null) {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({ data:row, error }))
        }))
      }))
    }))
  };
}

// Routes queries by table so admin_roles lookups and subscription lookups
// can return different rows for the same client.
function supabaseRouter({ adminRole = null, adminRolesError = null, subscription = null } = {}) {
  return {
    from: jest.fn((table) => {
      const row = table === 'admin_roles' ? (adminRole ? { role: adminRole } : null) : subscription;
      const error = table === 'admin_roles' ? adminRolesError : null;
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({ data: row, error }))
          }))
        }))
      };
    })
  };
}

describe('execute entitlement', () => {
  test.each(['admin','super_admin'])('%s is entitled without subscription lookup', async (role) => {
    expect(await isExecuteEntitled({}, { id:'admin-1', app_metadata:{ role } })).toBe(true);
  });

  test('user_metadata.role="admin" does not grant entitlement', async () => {
    const supabase = supabaseRouter({ subscription: null });
    expect(await isExecuteEntitled(supabase, {
      id:'user-1',
      user_metadata:{ role:'admin' }
    })).toBe(false);
  });

  test('top-level user.role="admin" does not grant entitlement', async () => {
    const supabase = supabaseRouter({ subscription: null });
    expect(await isExecuteEntitled(supabase, { id:'user-1', role:'admin' })).toBe(false);
  });

  test.each(['admin','super_admin'])('%s granted via admin_roles table is entitled without a subscription', async (role) => {
    const supabase = supabaseRouter({ adminRole: role, subscription: null });
    expect(await isExecuteEntitled(supabase, { id:'admin-1' })).toBe(true);
  });

  test.each(['viewer','support'])('admin_roles role "%s" does not grant execute entitlement', async (role) => {
    const supabase = supabaseRouter({ adminRole: role, subscription: null });
    expect(await isExecuteEntitled(supabase, { id:'staff-1' })).toBe(false);
  });

  test('admin_roles lookup error fails closed', async () => {
    const supabase = supabaseRouter({ adminRolesError: new Error('boom'), subscription: null });
    expect(await isExecuteEntitled(supabase, { id:'user-1' })).toBe(false);
  });

  test('app_metadata claim wins without touching the roles table', async () => {
    const supabase = supabaseRouter({ adminRole: null, subscription: null });
    expect(await isExecuteEntitled(supabase, {
      id:'admin-1',
      app_metadata:{ role:'super_admin' },
      user_metadata:{ role:'viewer' }
    })).toBe(true);
  });

  test('trialing pro with a future period end is entitled', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(await isExecuteEntitled(supabaseFor({
      status:'trialing',
      tier:'pro',
      current_period_end:future
    }), { id:'user-1' })).toBe(true);
  });

  test('expired subscription is not entitled', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(await isExecuteEntitled(supabaseFor({
      status:'active',
      tier:'enterprise',
      current_period_end:past
    }), { id:'user-1' })).toBe(false);
  });

  test('missing subscription is not entitled', async () => {
    expect(await isExecuteEntitled(supabaseFor(null), { id:'user-1' })).toBe(false);
  });

  test('free tier is not entitled', async () => {
    expect(await isExecuteEntitled(supabaseFor({
      status:'active',
      tier:'free',
      current_period_end:null
    }), { id:'user-1' })).toBe(false);
  });

  test('missing supabase.from fails closed', async () => {
    expect(await isExecuteEntitled({}, { id:'user-1' })).toBe(false);
  });
});
