// Correspondence verification admin service
/* global BondsAdminModuleCache, BondsAuth */
(function () {
  'use strict';

  const API = '/api/admin';
  const CACHE_KEY = 'correspondence_verification_events';
  const CACHE_TTL_MS = 30 * 1000;

  async function getToken() {
    if (window.BondsAuth && BondsAuth.getSession) {
      const result = await BondsAuth.getSession();
      return result?.data?.session?.access_token || window.__ADMIN_TOKEN || '';
    }
    return window.__ADMIN_TOKEN || '';
  }

  async function request(action, params = {}) {
    const token = await getToken();
    if (!token) throw new Error('Admin session missing');

    const query = new URLSearchParams({ action, ...params });
    const url = `${API}?${query.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  const CorrespondenceVerificationService = {
    async list(filters = {}) {
      const cacheKey = `${CACHE_KEY}_${JSON.stringify(filters)}`;
      const cached = typeof BondsAdminModuleCache !== 'undefined'
        ? BondsAdminModuleCache.get(cacheKey, 'default', CACHE_TTL_MS)
        : null;
      if (cached) return cached;

      const data = await request('verification-events', filters);
      if (typeof BondsAdminModuleCache !== 'undefined') BondsAdminModuleCache.set(cacheKey, 'default', data);
      return data;
    }
  };

  if (typeof window !== 'undefined') window.CorrespondenceVerificationService = CorrespondenceVerificationService;
})();
