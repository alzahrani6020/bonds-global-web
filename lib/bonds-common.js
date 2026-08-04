/**
 * Bonds Common Helpers
 * Shared utilities used across the public site to avoid duplicate code.
 */
(function (global) {
  'use strict';

  async function getAuthToken() {
    let token = global.__AUTH_TOKEN || global.__SESSION?.access_token || '';
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

  function showStatus(containerId, message, isError) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    el.style.background = isError ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
    el.style.border = '1px solid ' + (isError ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)');
    el.style.color = isError ? 'var(--danger)' : 'var(--success)';
    setTimeout(function () { el.style.display = 'none'; }, 6000);
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  global.BondsCommon = { getAuthToken, showStatus, escapeHtml, debounce };
})(typeof window !== 'undefined' ? window : globalThis);
