/**
 * Bonds Admin Common Helpers
 * Shared utilities used across standalone admin pages to avoid duplicate code.
 */
(function (global) {
  'use strict';

  function isAsciiJwt(value) {
    return typeof value === 'string' && /^[A-Za-z0-9\-_\.]+$/.test(value);
  }

  function extractToken(value) {
    if (!value || typeof value !== 'string') return '';
    if (isAsciiJwt(value)) return value;
    // Supabase stores the session as a JSON string under bonds-auth-token.
    try {
      const parsed = JSON.parse(value);
      const access = parsed?.access_token || parsed?.session?.access_token || parsed?.data?.session?.access_token || '';
      return isAsciiJwt(access) ? access : '';
    } catch (e) {
      return '';
    }
  }

  async function getAdminToken() {
    let token = extractToken(global.__ADMIN_TOKEN);
    if (!token && global.BondsAuth?.getSession) {
      try {
        const { data: { session } } = await global.BondsAuth.getSession();
        token = extractToken(session?.access_token);
      } catch (e) {}
    }
    if (!token && typeof supabase !== 'undefined' && global.__ENV?.SUPABASE_URL) {
      try {
        // Use the same unified storage key so we share the session with BondsAuth
        // instead of creating a second, isolated client.
        const client = supabase.createClient(global.__ENV.SUPABASE_URL, global.__ENV.SUPABASE_ANON_KEY, {
          auth: { storageKey: 'bonds-auth-token', persistSession: true, autoRefreshToken: true }
        });
        const { data: { session } } = await client.auth.getSession();
        token = extractToken(session?.access_token);
      } catch (e) {}
    }
    if (!token) {
      try {
        token = extractToken(global.localStorage?.getItem('bonds-auth-token'));
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

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ''));

      if (url.protocol === 'https:') {
        return url.toString();
      }

      if (
        url.protocol === 'http:' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      ) {
        return url.toString();
      }

      return '';
    } catch {
      return '';
    }
  }

  function ensureAdminI18n() {
    if (global.BondsAdminI18n) return Promise.resolve(global.BondsAdminI18n);
    if (global.__BONDS_ADMIN_I18N_PROMISE__) return global.__BONDS_ADMIN_I18N_PROMISE__;
    global.__BONDS_ADMIN_I18N_PROMISE__ = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-bonds-admin-i18n]');
      if (existing) {
        existing.addEventListener('load', () => resolve(global.BondsAdminI18n), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = '/admin/admin-i18n.js?v=2';
      script.dataset.bondsAdminI18n = 'true';
      script.onload = () => resolve(global.BondsAdminI18n);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return global.__BONDS_ADMIN_I18N_PROMISE__;
  }

  function humanizeAdminKey(value, locale) {
    const requested = String(locale || global.BondsAdminI18n?.locale || document?.documentElement?.lang || 'ar')
      .toLowerCase().startsWith('en') ? 'en' : 'ar';
    if (global.BondsAdminI18n?.label) return global.BondsAdminI18n.label(value);
    ensureAdminI18n().catch(() => {});
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (requested === 'ar') return /[\u0600-\u06FF]/.test(raw) ? raw : 'مسمى غير معرّف';
    return /[\u0600-\u06FF]/.test(raw)
      ? 'Unknown label'
      : raw.split('.').map(part => part
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, m => m.toUpperCase()))
        .join(' · ');
  }

  async function requestJson(url, options) {
    const response = await global.BondsAuth.authenticatedFetch(url, options || {});
    let body = {};
    try {
      body = typeof response?.json === 'function' ? await response.json() : response || {};
    } catch (error) {
      body = { error: error?.message || 'INVALID_JSON_RESPONSE' };
    }
    if (!response?.ok || body?.success === false) {
      const err = new Error(body?.error || body?.message || ('HTTP ' + Number(response?.status || 0)));
      err.status = Number(response?.status || 0);
      err.body = body;
      throw err;
    }
    return body;
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  global.BondsAdminCommon = {
    getAdminToken,
    showAdminStatus,
    escapeHtml,
    safeExternalUrl,
    ensureAdminI18n,
    humanizeAdminKey,
    requestJson,
    debounce
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureAdminI18n().then(i18n => i18n?.setLocale?.(i18n.locale)).catch(() => {});
    }, { once: true });
  } else {
    ensureAdminI18n().then(i18n => i18n?.setLocale?.(i18n.locale)).catch(() => {});
  }
})(window);
