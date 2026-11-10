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

describe('execute entitlement', () => {
  test.each(['admin','super_admin'])('%s is entitled without subscription lookup', async (role) => {
    expect(await isExecuteEntitled({}, { id:'admin-1', app_metadata:{ role } })).toBe(true);
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
