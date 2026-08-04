/**
 * Bonds Admin Module Cache
 * Simple TTL cache for SPA admin modules to avoid re-fetching data on every view switch.
 */
(function (global) {
  'use strict';

  const cache = new Map();

  function key(module, scope) {
    return module + '::' + (scope || 'default');
  }

  const ModuleCache = {
    get: (module, scope, maxAgeMs = 60000) => {
      const k = key(module, scope);
      const entry = cache.get(k);
      if (!entry) return null;
      if (Date.now() - entry.ts > maxAgeMs) {
        cache.delete(k);
        return null;
      }
      return entry.data;
    },

    set: (module, scope, data) => {
      cache.set(key(module, scope), { data, ts: Date.now() });
    },

    invalidate: (module, scope) => {
      if (scope) {
        cache.delete(key(module, scope));
      } else {
        const prefix = module + '::';
        for (const k of cache.keys()) {
          if (k.startsWith(prefix)) cache.delete(k);
        }
      }
    },

    clear: () => cache.clear()
  };

  global.BondsAdminModuleCache = ModuleCache;
})(typeof window !== 'undefined' ? window : globalThis);
