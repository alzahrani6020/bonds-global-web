/**
 * Executive Dashboard Service
 * Aggregates data from subscriptions, profiles, advisory projects/clients and recovery assets.
 */
(function (root) {
  'use strict';

  const TIMEOUT_MS = 15000;
  const TIER_PRICE = { pro: 82, enterprise: 212 };

  function getSb() {
    const sb = (typeof getSupabase === 'function') ? getSupabase() : window.supabaseClient;
    if (!sb) throw new Error('Supabase client not initialized');
    return sb;
  }

  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), TIMEOUT_MS))
    ]);
  }

  async function getSessionUser() {
    const sb = getSb();
    const { data: { session }, error } = await withTimeout(sb.auth.getSession(), 'getSession');
    if (error || !session) throw new Error('Session required');
    return session.user;
  }

  async function getUserRole() {
    const user = await getSessionUser();
    const sb = getSb();

    if (window.__ENV?.ADMIN_EMAIL && user.email === window.__ENV.ADMIN_EMAIL) {
      return { role: 'owner', user };
    }

    try {
      const { data: adminRole } = await withTimeout(
        sb.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle(),
        'admin_roles'
      );
      if (['super_admin','admin'].includes(adminRole?.role)) return { role: 'admin', user };
      if (adminRole?.role) return { role: 'manager', user };
    } catch (e) {
      console.warn('[ExecutiveService] admin_roles check failed:', e.message);
    }

    try {
      const { data: advRole } = await withTimeout(
        sb.from('advisory_roles').select('role').eq('user_id', user.id).maybeSingle(),
        'advisory_roles'
      );
      if (advRole?.role === 'manager') return { role: 'manager', user };
    } catch (e) {
      console.warn('[ExecutiveService] advisory_roles check failed:', e.message);
    }

    return { role: null, user };
  }

  function monthKey(d) {
    const date = d ? new Date(d) : new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function last12Months() {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  function labelForMonth(key) {
    const [y, m] = key.split('-');
    return `${m}/${y}`;
  }

  async function getStats() {
    const sb = getSb();
    const months = last12Months();

    const queries = [
      {
        key: 'subscriptions',
        q: sb.from('subscriptions').select('status, tier, created_at').order('created_at', { ascending: true })
      },
      {
        key: 'profiles',
        q: sb.from('profiles').select('created_at').order('created_at', { ascending: true })
      },
      {
        key: 'advisoryClients',
        q: sb.from('advisory_clients').select('status, created_at').order('created_at', { ascending: true })
      },
      {
        key: 'advisoryProjects',
        q: sb.from('advisory_projects').select('status, budget, start_date, created_at, client_id, advisory_clients(name)').order('created_at', { ascending: false })
      },
      {
        key: 'recoveryAssets',
        q: sb.from('recovery_assets').select('status, original_value, distressed_value, name, category, created_at').order('created_at', { ascending: false })
      }
    ];

    const results = await Promise.all(queries.map(item =>
      withTimeout(item.q, 'query:' + item.key)
        .then(res => ({ key: item.key, ok: true, res }))
        .catch(err => ({ key: item.key, ok: false, err }))
    ));

    const data = {
      subscriptions: [],
      profiles: [],
      advisoryClients: [],
      advisoryProjects: [],
      recoveryAssets: [],
      errors: []
    };

    for (const r of results) {
      if (!r.ok) {
        data.errors.push({ key: r.key, message: r.err?.message || String(r.err) });
        continue;
      }
      if (r.res.error) {
        data.errors.push({ key: r.key, message: r.res.error.message || String(r.res.error) });
      }
      data[r.key] = r.res.data || [];
    }

    // Revenue calculations
    const activeSubs = data.subscriptions.filter(s => s.status === 'active');
    const totalRevenue = activeSubs.reduce((sum, s) => sum + (TIER_PRICE[s.tier] || 0), 0);
    const mrr = totalRevenue;

    const revenueByMonth = {};
    months.forEach(m => revenueByMonth[m] = 0);
    data.subscriptions.forEach(s => {
      const m = monthKey(s.created_at);
      if (revenueByMonth.hasOwnProperty(m)) revenueByMonth[m] += (TIER_PRICE[s.tier] || 0);
    });

    const activeClientsCount = data.advisoryClients.filter(c => c.status === 'active').length;
    const totalAdvisoryClients = data.advisoryClients.length;
    const totalProfiles = data.profiles.length;

    const clientsByMonth = {};
    months.forEach(m => clientsByMonth[m] = 0);
    data.profiles.forEach(p => {
      const m = monthKey(p.created_at);
      if (clientsByMonth.hasOwnProperty(m)) clientsByMonth[m] += 1;
    });

    // Projects
    const projectCounts = {
      lead: 0, active: 0, on_hold: 0, completed: 0, cancelled: 0, total: data.advisoryProjects.length
    };
    let activeProjectsValue = 0;
    data.advisoryProjects.forEach(p => {
      if (projectCounts.hasOwnProperty(p.status)) projectCounts[p.status] += 1;
      if (p.status === 'active') activeProjectsValue += Number(p.budget) || 0;
    });

    // Recovery assets
    const opportunityStatuses = ['identified','valuation','planning'];
    const distressedStatuses = ['active_rescue','restructuring'];
    const investmentOpportunities = data.recoveryAssets.filter(a => opportunityStatuses.includes(a.status));
    const distressedAssets = data.recoveryAssets.filter(a => distressedStatuses.includes(a.status));
    const totalOpportunityValue = investmentOpportunities.reduce((sum, a) => sum + (Number(a.distressed_value) || 0), 0);

    const recentSubscriptions = data.subscriptions.slice(-10).reverse();
    const recentProjects = data.advisoryProjects.slice(0, 8);
    const topOpportunities = investmentOpportunities.slice(0, 8);

    return {
      months,
      monthLabels: months.map(labelForMonth),
      revenueByMonth: months.map(m => revenueByMonth[m]),
      clientsByMonth: months.map(m => clientsByMonth[m]),
      totalRevenue,
      mrr,
      totalProfiles,
      totalAdvisoryClients,
      activeClientsCount,
      projectCounts,
      activeProjectsValue,
      activeProjectsCount: projectCounts.active,
      distressedProjectsCount: projectCounts.on_hold + projectCounts.cancelled,
      investmentOpportunitiesCount: investmentOpportunities.length,
      distressedAssetsCount: distressedAssets.length,
      totalOpportunityValue,
      recentSubscriptions,
      recentProjects,
      topOpportunities,
      errors: data.errors
    };
  }

  async function ensureAccess() {
    const { role, user } = await getUserRole();
    if (!role) throw new Error('ليس لديك صلاحية الوصول إلى لوحة المؤشرات التنفيذية');
    return { role, user };
  }

  root.ExecutiveService = {
    getUserRole,
    ensureAccess,
    getStats,
    TIER_PRICE,
    monthKey,
    last12Months,
    labelForMonth
  };
})(window);
