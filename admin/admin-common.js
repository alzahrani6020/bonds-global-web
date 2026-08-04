/**
 * Bonds Admin Common Helpers
 * Shared utilities used across standalone admin pages to avoid duplicate code.
 */
(function (global) {
  'use strict';

  async function getAdminToken() {
    let token = global.__ADMIN_TOKEN || global.__ADMIN_SESSION?.access_token || '';
    if (!token && global.BondsAuth?.getSession) {
      try {
        const { data: { session } } = await global.BondsAuth.getSession();
        token = session?.access_token || '';
      } catch (e) {}
    }
    if (!token && typeof supabase !== 'undefined' && global.__ENV?.SUPABASE_URL) {
      try {
        const client = supabase.createClient(global.__ENV.SUPABASE_URL, global.__ENV.SUPABASE_ANON_KEY);
        const { data: { session } } = await client.auth.getSession();
        token = session?.access_token || '';
      } catch (e) {}
    }
    if (!token) {
      try {
        token = global.localStorage?.getItem('bonds-auth-token') || '';
      } catch (e) {}
    }
    return token;
  }

  function showAdminStatus(containerId, message, isError) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    el.style.background = isError ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
    el.style.border = '1px solid ' + (isError ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)');
    el.style.color = isError ? 'var(--danger)' : 'var(--success)';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  global.BondsAdminCommon = { getAdminToken, showAdminStatus, escapeHtml, debounce };
})(window);
