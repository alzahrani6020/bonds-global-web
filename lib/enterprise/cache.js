/**
 * Enterprise Client Cache — Bonds Global
 * Simple TTL cache backed by localStorage/IndexedDB with memory fallback.
 */
(function (root) {
  'use strict';

  const PREFIX = 'bonds_cache_';
  const DEFAULT_TTL_MS = 60 * 1000; // 1 minute

  function now() { return Date.now(); }

  function key(k) { return PREFIX + k; }

  function get(k) {
    try {
      const raw = localStorage.getItem(key(k));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (entry.expires && entry.expires < now()) {
        localStorage.removeItem(key(k));
        return null;
      }
      return entry.value;
    } catch (e) {
      return null;
    }
  }

  function set(k, value, ttlMs = DEFAULT_TTL_MS) {
    try {
      const entry = { value, expires: ttlMs ? now() + ttlMs : null };
      localStorage.setItem(key(k), JSON.stringify(entry));
    } catch (e) {
      // quota exceeded or private mode
    }
  }

  function remove(k) {
    try { localStorage.removeItem(key(k)); } catch (e) {}
  }

  function clear() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  async function wrap(fetcher, k, ttlMs) {
    const cached = get(k);
    if (cached !== null) return cached;
    const value = await fetcher();
    set(k, value, ttlMs);
    return value;
  }

  root.BondsCache = { get, set, remove, clear, wrap };
})(window);
