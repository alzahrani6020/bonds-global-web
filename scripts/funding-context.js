/**
 * BONDS Funding Context — safe bridge from funding tools to /funding-extraction
 * Uses sessionStorage fallback + shareable query params.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bonds_funding_context';
  const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  const ALLOWED_KEYS = new Set([
    'source',
    'amount',
    'country',
    'financingType',
    'sector',
    'purposeCategory',
    'purpose',
    'readinessScore',
    'selectedSource',
    'note',
    'lang'
  ]);

  function isSafeString(value) {
    return typeof value === 'string' && value.length <= 2000;
  }

  function sanitize(data) {
    if (!data || typeof data !== 'object') return {};
    const out = {};
    Object.keys(data).forEach(function (key) {
      if (!ALLOWED_KEYS.has(key)) return;
      let value = data[key];
      if (value === null || value === undefined) return;
      if (typeof value === 'number') {
        if (!Number.isFinite(value) || value < 0 || value > 1e15) return;
        out[key] = value;
      } else if (typeof value === 'string') {
        value = value.trim();
        if (!value) return;
        // Strip script tags and excessive whitespace
        value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
        value = value.replace(/\s+/g, ' ').trim();
        if (value.length > 2000) value = value.slice(0, 2000);
        out[key] = value;
      }
    });
    return out;
  }

  function set(data) {
    try {
      const payload = {
        _t: Date.now(),
        data: sanitize(data)
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function get() {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed._t !== 'number') return null;
      if (Date.now() - parsed._t > EXPIRY_MS) {
        clear();
        return null;
      }
      return sanitize(parsed.data || {});
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function buildUrl(base, data, lang) {
    const sanitized = sanitize(data || {});
    if (lang) sanitized.lang = lang;
    const params = new URLSearchParams();
    Object.keys(sanitized).forEach(function (key) {
      params.append(key, String(sanitized[key]));
    });
    const query = params.toString();
    if (!query) return base;
    return base + (base.indexOf('?') > -1 ? '&' : '?') + query;
  }

  window.BondsFundingContext = {
    set: set,
    get: get,
    clear: clear,
    buildUrl: buildUrl,
    sanitize: sanitize
  };
})();
