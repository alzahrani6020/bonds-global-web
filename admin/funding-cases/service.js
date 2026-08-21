// Funding Cases admin service
/* global BondsAdminCache, BondsAuth */
(function () {
  'use strict';

  const API = '/api/v3/funding-cases';
  const CACHE_KEY = 'funding_cases_list';
  const CACHE_TTL_MS = 60 * 1000;

  async function getToken() {
    if (window.BondsAuth && BondsAuth.getSession) {
      const session = await BondsAuth.getSession();
      return session?.access_token || '';
    }
    return window.__ADMIN_TOKEN || '';
  }

  async function request(action, params = {}, method = 'GET', body = null) {
    const token = await getToken();
    if (!token) throw new Error('Admin session missing');

    const query = new URLSearchParams({ action, ...params });
    const url = `${API}?${query.toString()}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  const FundingCasesService = {
    async list(filters = {}) {
      const cacheKey = `${CACHE_KEY}_${JSON.stringify(filters)}`;
      const cached = typeof BondsAdminModuleCache !== 'undefined'
        ? BondsAdminModuleCache.get(cacheKey, 'default', CACHE_TTL_MS)
        : null;
      if (cached) return cached;

      const data = await request('list', filters);
      if (typeof BondsAdminModuleCache !== 'undefined') BondsAdminModuleCache.set(cacheKey, 'default', data);
      return data;
    },

    async detail(id) {
      return request('detail', { id });
    },

    async update(id, updates) {
      const data = await request('update', {}, 'POST', { id, ...updates });
      if (typeof BondsAdminModuleCache !== 'undefined') BondsAdminModuleCache.invalidate(CACHE_KEY);
      return data;
    },

    async addNote(caseId, note) {
      const data = await request('add-note', {}, 'POST', { caseId, note });
      if (typeof BondsAdminModuleCache !== 'undefined') BondsAdminModuleCache.invalidate(CACHE_KEY);
      return data;
    }
  };

  if (typeof window !== 'undefined') window.FundingCasesService = FundingCasesService;
})();
