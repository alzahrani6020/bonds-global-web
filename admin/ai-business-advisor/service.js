/**
 * AI Business Advisor — Data Service
 * Client-side Supabase aggregation.
 */
(function (root) {
  'use strict';

  let _sb = null;
  const ADMIN_EMAIL = (root.__ENV && root.__ENV.ADMIN_EMAIL) ? root.__ENV.ADMIN_EMAIL : '';

  function getSb() {
    if (_sb) return _sb;
    const url = (root.__ENV && root.__ENV.SUPABASE_URL) || '';
    const key = (root.__ENV && root.__ENV.SUPABASE_ANON_KEY) || '';
    if (!url || !key) throw new Error('Supabase env missing');
    _sb = root.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
    return _sb;
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms))
    ]);
  }

  async function getSessionUser() {
    const sb = getSb();
    const { data, error } = await withTimeout(sb.auth.getUser(), 10000, 'getUser');
    if (error) throw error;
    return data.user;
  }

  async function getUserRole() {
    const user = await getSessionUser();
    if (!user) return null;
    if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) return { role: 'manager', user };

    const sb = getSb();
    const { data: adminRole } = await withTimeout(
      sb.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle(),
      10000, 'admin_roles'
    );
    if (['super_admin','admin'].includes(adminRole?.role)) return { role: 'manager', user };

    const { data: advRole } = await withTimeout(
      sb.from('advisory_roles').select('role').eq('user_id', user.id).maybeSingle(),
      10000, 'advisory_roles'
    );
    if (['manager','analyst'].includes(advRole?.role)) return { role: advRole.role, user };
    return { role: null, user };
  }

  function monthsAgo(n) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 7) + '-01';
  }

  function bucketByMonth(rows, dateField, valueField) {
    const map = {};
    rows.forEach(r => {
      const d = r[dateField];
      if (!d) return;
      const m = d.slice(0, 7);
      const val = valueField === 'count' ? 1 : (Number(r[valueField]) || 0);
      map[m] = (map[m] || 0) + val;
    });
    return map;
  }

  function countByMonth(rows, dateField) {
    return bucketByMonth(rows, dateField, 'count');
  }

  function fillMonths(months) {
    const arr = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(d.toISOString().slice(0, 7));
    }
    return arr;
  }

  async function fetchAdvisoryProjects(sb) {
    const { data, error } = await withTimeout(
      sb.from('advisory_projects')
        .select('id, name, status, budget, advisory_clients(name)')
        .order('created_at', { ascending: false }),
      15000, 'advisory_projects'
    );
    if (error) throw error;
    return data || [];
  }

  async function fetchAdvisoryClients(sb) {
    const { data, error } = await withTimeout(
      sb.from('advisory_clients').select('id, name, status, created_at').order('created_at', { ascending: false }),
      15000, 'advisory_clients'
    );
    if (error) throw error;
    return data || [];
  }

  async function fetchRecoveryAssets(sb) {
    const { data, error } = await withTimeout(
      sb.from('recovery_assets')
        .select('id, name, category, original_value, distressed_value, status, priority, created_at')
        .order('created_at', { ascending: false }),
      15000, 'recovery_assets'
    );
    if (error) throw error;
    return data || [];
  }

  async function fetchSubscriptions(sb) {
    const { data, error } = await withTimeout(
      sb.from('subscriptions').select('status, tier, created_at, current_period_start, current_period_end')
        .not('status', 'eq', 'cancelled'),
      15000, 'subscriptions'
    );
    if (error) throw error;
    return data || [];
  }

  async function fetchMoyasarInvoices(sb) {
    const { data, error } = await withTimeout(
      sb.from('moyasar_invoices').select('status, amount, paid_at, created_at').eq('status', 'paid'),
      15000, 'moyasar_invoices'
    );
    if (error) throw error;
    return data || [];
  }

  async function fetchProfiles(sb) {
    const { count, error } = await withTimeout(
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      15000, 'profiles'
    );
    if (error) throw error;
    return count || 0;
  }

  function tierToMonthly(tier) {
    if (tier === 'pro') return 82;
    if (tier === 'enterprise') return 212;
    return 0;
  }

  async function getMetrics() {
    const sb = getSb();
    const results = await Promise.allSettled([
      fetchSubscriptions(sb),
      fetchMoyasarInvoices(sb),
      fetchProfiles(sb),
      fetchAdvisoryClients(sb),
      fetchAdvisoryProjects(sb),
      fetchRecoveryAssets(sb)
    ]);

    const subscriptions = results[0].status === 'fulfilled' ? results[0].value : [];
    const invoices = results[1].status === 'fulfilled' ? results[1].value : [];
    const profileCount = results[2].status === 'fulfilled' ? results[2].value : 0;
    const clients = results[3].status === 'fulfilled' ? results[3].value : [];
    const projects = results[4].status === 'fulfilled' ? results[4].value : [];
    const assets = results[5].status === 'fulfilled' ? results[5].value : [];

    const subRevenueByMonth = bucketByMonth(subscriptions, 'current_period_start', 'amount');
    const invRevenueByMonth = bucketByMonth(invoices, 'paid_at', 'amount');

    // Fallback: compute from tier if amount missing
    subscriptions.forEach(s => {
      if (!s.amount && s.tier) {
        const m = (s.current_period_start || s.created_at || '').slice(0, 7);
        if (m) subRevenueByMonth[m] = (subRevenueByMonth[m] || 0) + tierToMonthly(s.tier);
      }
    });

    const months = fillMonths(12);
    const revenueByMonth = months.map(m => (subRevenueByMonth[m] || 0) + (invRevenueByMonth[m] || 0));
    const totalRevenue = revenueByMonth.reduce((a, b) => a + b, 0);
    const mrr = revenueByMonth[revenueByMonth.length - 1] || 0;

    const clientMap = countByMonth(clients, 'created_at');
    const clientsByMonth = months.map(m => clientMap[m] || 0);

    const projectCounts = { active: 0, completed: 0, on_hold: 0, cancelled: 0, other: 0 };
    let activeProjectsValue = 0;
    projects.forEach(p => {
      if (p.status === 'active') { projectCounts.active++; activeProjectsValue += Number(p.budget) || 0; }
      else if (p.status === 'completed') projectCounts.completed++;
      else if (p.status === 'on_hold') projectCounts.on_hold++;
      else if (p.status === 'cancelled') projectCounts.cancelled++;
      else projectCounts.other++;
    });

    const activeAssets = assets.filter(a => a.status === 'active_rescue' || a.status === 'restructuring');
    const totalOpportunityValue = assets.reduce((s, a) => s + ((Number(a.original_value) || 0) - (Number(a.distressed_value) || 0)), 0);

    return {
      stats: {
        months,
        revenueByMonth,
        totalRevenue,
        mrr,
        clientsByMonth,
        totalClients: clients.length,
        profileCount,
        projectCounts,
        activeProjectsCount: projectCounts.active,
        distressedProjectsCount: projectCounts.on_hold + projectCounts.cancelled,
        activeProjectsValue,
        activeAssetsCount: activeAssets.length,
        totalAssetsValue: assets.reduce((s, a) => s + (Number(a.original_value) || 0), 0),
        distressedAssetsCount: assets.filter(a => !['recovered','liquidated'].includes(a.status)).length,
        totalOpportunityValue
      },
      clients,
      projects,
      assets
    };
  }

  root.AiAdvisorService = {
    getSb,
    getUserRole,
    getMetrics
  };
})(window);
