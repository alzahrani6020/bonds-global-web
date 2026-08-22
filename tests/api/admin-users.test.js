const { getUsers } = require('../../api/admin.js');

function createMockSupabase({ rows = [], count = 0, rangeError = null, countError = null } = {}) {
  let rangeAttempts = 0;
  function builder({ isHead = false } = {}) {
    const b = {
      lt: () => b,
      gt: () => b,
      eq: () => b,
      or: () => b,
      order: () => ({
        range: async () => {
          rangeAttempts += 1;
          if (rangeError && rangeAttempts === 1) return { data: null, error: rangeError };
          return { data: rows, error: null, count };
        }
      }),
      then: (resolve, reject) => {
        if (isHead && countError) return reject(countError);
        return resolve({ data: isHead ? null : rows, count, error: null });
      }
    };
    return b;
  }
  return {
    from: () => ({
      select: (_cols, opts) => builder({ isHead: opts?.head })
    }),
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: null } })
      }
    }
  };
}

describe('admin/users getUsers pagination', () => {
  test('total=0 returns empty metadata', async () => {
    const sb = createMockSupabase({ rows: [], count: 0 });
    const result = await getUsers(sb, { limit: 50, offset: 0 });
    expect(result.success).toBe(true);
    expect(result.recentUsers).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.pageOutOfRange).toBe(false);
  });

  test('first page returns rows and count', async () => {
    const rows = [
      { id: 'u1', restaurant_name: 'A', email: 'a@example.com', phone: '', country: '', city: '', business_type: '', bio: '', needs: '', employee_count: 0, branch_count: 1, tier: 'free', tier_expires_at: null, status: 'active', created_at: '2026-01-01', profile_completeness: 50 }
    ];
    const sb = createMockSupabase({ rows, count: 1 });
    const result = await getUsers(sb, { limit: 50, offset: 0 });
    expect(result.success).toBe(true);
    expect(result.recentUsers).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.pageOutOfRange).toBe(false);
  });

  test('last page returns rows and correct metadata', async () => {
    const rows = [
      { id: 'u3', restaurant_name: 'C', email: 'c@example.com', phone: '', country: '', city: '', business_type: '', bio: '', needs: '', employee_count: 0, branch_count: 1, tier: 'free', tier_expires_at: null, status: 'active', created_at: '2026-01-03', profile_completeness: 50 }
    ];
    const sb = createMockSupabase({ rows, count: 25 });
    const result = await getUsers(sb, { limit: 10, offset: 20 });
    expect(result.success).toBe(true);
    expect(result.recentUsers).toHaveLength(1);
    expect(result.total).toBe(25);
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.pageOutOfRange).toBe(false);
  });

  test('offset beyond range (PGRST103) returns empty with pageOutOfRange and lastValidOffset', async () => {
    const rangeError = { message: 'Requested range not satisfiable', code: 'PGRST103' };
    const sb = createMockSupabase({ rows: [], count: 25, rangeError });
    const result = await getUsers(sb, { limit: 10, offset: 30 });
    expect(result.success).toBe(true);
    expect(result.recentUsers).toEqual([]);
    expect(result.total).toBe(25);
    expect(result.page).toBe(4);
    expect(result.totalPages).toBe(3);
    expect(result.pageOutOfRange).toBe(true);
    expect(result.lastValidOffset).toBe(20);
  });

  test('filters reducing total pages reflect correct metadata', async () => {
    const rows = [
      { id: 'u1', restaurant_name: 'A', email: 'a@example.com', phone: '', country: '', city: '', business_type: '', bio: '', needs: '', employee_count: 0, branch_count: 1, tier: 'pro', tier_expires_at: null, status: 'active', created_at: '2026-01-01', profile_completeness: 50 }
    ];
    const sb = createMockSupabase({ rows, count: 5 });
    const result = await getUsers(sb, { limit: 10, offset: 0, tier: 'pro' });
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(1);
    expect(result.recentUsers).toHaveLength(1);
  });
});

describe('admin/users getUsers error handling', () => {
  test('throws on unexpected database errors', async () => {
    const rangeError = new Error('connection failed');
    const sb = createMockSupabase({ rows: [], count: 0, rangeError });
    await expect(getUsers(sb, { limit: 50, offset: 0 })).rejects.toThrow();
  });

  test('throws when count query fails during PGRST103 fallback', async () => {
    const rangeError = { message: 'Requested range not satisfiable', code: 'PGRST103' };
    const countError = new Error('count query failed');
    const sb = createMockSupabase({ rows: [], count: 0, rangeError, countError });
    await expect(getUsers(sb, { limit: 10, offset: 30 })).rejects.toThrow('count query failed');
  });

  test('throws on unrelated table errors', async () => {
    const rangeError = new Error('relation "profiles" does not exist');
    const sb = createMockSupabase({ rows: [], count: 0, rangeError });
    await expect(getUsers(sb, { limit: 50, offset: 0 })).rejects.toThrow();
  });
});

describe('admin/users getUsers schema fallback', () => {
  test('falls back when profile_completeness column is missing', async () => {
    const rows = [
      { id: 'u1', restaurant_name: 'A', email: 'a@example.com', phone: '', country: '', city: '', business_type: '', bio: '', needs: '', employee_count: 0, branch_count: 1, tier: 'free', tier_expires_at: null, status: 'active', created_at: '2026-01-01' }
    ];
    const rangeError = { message: 'column "profile_completeness" does not exist' };
    const sb = createMockSupabase({ rows, count: 1, rangeError });
    const result = await getUsers(sb, { limit: 50, offset: 0, completeness: 'incomplete' });
    expect(result.success).toBe(true);
    expect(result.recentUsers).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
