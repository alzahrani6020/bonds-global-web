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

  function getAdminToken() {
    return window.__ADMIN_TOKEN || window.__ADMIN_SESSION?.access_token || '';
  }

  async function apiRequest(action, token) {
    const t = token || getAdminToken();
    if (!t) throw new Error('No admin token available');
    const res = await fetch('/api/admin?action=' + encodeURIComponent(action), {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/json' }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || ('API ' + action + ' failed'));
    return json;
  }

  async function getSessionUser() {
    // Prefer server-side verification via admin token to avoid iframe storage/auth issues.
    const token = getAdminToken();
    if (token) {
      try {
        const json = await withTimeout(apiRequest('me', token), 'api:me');
        if (json.success && json.id && json.email) {
          return { id: json.id, email: json.email, role: json.role || null };
        }
      } catch (e) {
        console.warn('[ExecutiveService] API me failed:', e?.message);
      }
    }

    let sb;
    try {
      sb = getSb();
    } catch (e) {
      console.error('[ExecutiveService] getSb failed:', e?.message, e?.stack);
      throw new Error('Supabase client error: ' + (e?.message || 'unknown'));
    }

    // Use session bridge from parent dashboard if available (avoids iframe storage issues).
    const bridgeSession = window.__ADMIN_SESSION;
    console.log('[ExecutiveService] bridgeSession present:', !!bridgeSession, 'type:', typeof bridgeSession);
    if (bridgeSession && typeof bridgeSession === 'object' && typeof sb.auth.setSession === 'function') {
      try {
        const minimalSession = {
          access_token: bridgeSession.access_token,
          refresh_token: bridgeSession.refresh_token
        };
        console.log('[ExecutiveService] calling setSession with minimal tokens');
        await sb.auth.setSession(minimalSession);
        console.log('[ExecutiveService] setSession succeeded');
        const { data: { session }, error } = await withTimeout(sb.auth.getSession(), 'getSession');
        console.log('[ExecutiveService] getSession after setSession:', { hasSession: !!session, error: error?.message });
        if (!error && session) return session.user;
      } catch (e) {
        console.warn('[ExecutiveService] session bridge failed:', e?.message, e?.stack);
      }
    }

    try {
      console.log('[ExecutiveService] falling back to getSession');
      const { data: { session }, error } = await withTimeout(sb.auth.getSession(), 'getSession');
      console.log('[ExecutiveService] fallback getSession:', { hasSession: !!session, error: error?.message });
      if (error || !session) throw new Error('Session required');
      return session.user;
    } catch (e) {
      console.error('[ExecutiveService] getSession failed:', e?.message, e?.stack);
      throw e;
    }
  }

  const OWNER_EMAILS = ['iiffund.dev@gmail.com'];

  function mapApiRole(apiRole) {
    if (apiRole === 'super_admin') return 'owner';
    if (apiRole === 'admin') return 'admin';
    if (apiRole === 'support' || apiRole === 'manager') return 'manager';
    return null;
  }

  async function getUserRole() {
    const token = getAdminToken();
    if (token) {
      try {
        const json = await withTimeout(apiRequest('me', token), 'api:me');
        if (json.success && json.role && json.email) {
          const role = mapApiRole(json.role);
          if (role) {
            return {
              role,
              user: { id: json.id, email: json.email }
            };
          }
        }
      } catch (e) {
        console.warn('[ExecutiveService] API role lookup failed:', e?.message);
      }
    }

    const user = await getSessionUser();
    const sb = getSb();

    const configuredOwner = window.__ENV?.ADMIN_EMAIL || '';
    const owners = [...OWNER_EMAILS];
    if (configuredOwner) owners.push(configuredOwner);
    if (owners.some(e => user.email.toLowerCase() === e.toLowerCase())) {
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

    throw new Error('لم يتم العثور على دور للمستخدم: ' + (user?.email || user?.id || 'unknown'));
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

  function aggregateStats(raw) {
    const months = last12Months();

    const data = {
      subscriptions: raw.subscriptions || [],
      profiles: raw.profiles || [],
      advisoryClients: raw.advisoryClients || [],
      advisoryProjects: raw.advisoryProjects || [],
      recoveryAssets: raw.recoveryAssets || [],
      errors: raw.errors || []
    };

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

  async function getStats() {
    const token = getAdminToken();
    if (token) {
      try {
        const json = await withTimeout(apiRequest('executive-stats', token), 'api:executive-stats');
        if (json.success) return aggregateStats(json);
      } catch (e) {
        console.warn('[ExecutiveService] API executive-stats failed:', e?.message);
      }
    }

    const sb = getSb();
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

    return aggregateStats(data);
  }

  async function ensureAccess() {
    let role, user;
    try {
      ({ role, user } = await getUserRole());
    } catch (e) {
      console.error('[ExecutiveService] ensureAccess failed:', e?.message, e?.stack);
      if (e?.message?.includes('Maximum call stack') || e?.message?.includes('call stack')) {
        throw new Error('خطأ داخلي في جلسة المستخدم. جرّب إعادة تحميل الصفحة أو تسجيل الخروج والدخول مرة أخرى.');
      }
      throw new Error('فشل التحقق من الصلاحيات: ' + (e?.message || 'خطأ غير معروف'));
    }
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
