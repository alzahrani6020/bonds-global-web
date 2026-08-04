/**
 * Bonds Shared Data Cache
 * Caches BondsGeo and BondsPlatforms in IndexedDB for faster repeat visits.
 * Uses idb-keyval (lazy-loaded) to avoid blocking initial paint.
 */
(function (global) {
  'use strict';

  const STORE = {
    GEO: 'bonds_geo_full',
    PLATFORMS: 'bonds_platforms_full',
    PLATFORMS_COUNTRY: 'bonds_platforms_country',
    GEO_COUNTRY: 'bonds_geo_country',
    META: 'bonds_data_cache_meta'
  };

  let idbReady = false;
  let idbGet, idbSet, idbDel, idbKeys;

  function loadIdb() {
    if (idbReady) return Promise.resolve();
    if (global.idbKeyval) {
      idbGet = global.idbKeyval.get;
      idbSet = global.idbKeyval.set;
      idbDel = global.idbKeyval.del;
      idbKeys = global.idbKeyval.keys;
      idbReady = true;
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/umd.js';
      script.onload = function () {
        idbGet = global.idbKeyval.get;
        idbSet = global.idbKeyval.set;
        idbDel = global.idbKeyval.del;
        idbKeys = global.idbKeyval.keys;
        idbReady = true;
        resolve();
      };
      script.onerror = function () { reject(new Error('idb-keyval failed to load')); };
      document.head.appendChild(script);
    });
  }

  function dbGet(key) {
    return loadIdb().then(function () { return idbGet(key); });
  }

  function dbSet(key, value) {
    return loadIdb().then(function () { return idbSet(key, value); });
  }

  function dbDel(key) {
    return loadIdb().then(function () { return idbDel(key); });
  }

  function now() { return Date.now(); }

  function withTimestamp(data) {
    return { version: (global.__DATA_VERSION || '1'), cachedAt: now(), data: data };
  }

  function isStale(entry, ttlMs) {
    if (!entry || !entry.cachedAt) return true;
    return (now() - entry.cachedAt) > ttlMs;
  }

  const BondsDataCache = {
    // Cache full merged geo data
    cacheGeo: function (geoData, ttlMs) {
      if (!geoData) return Promise.resolve();
      return dbSet(STORE.GEO, withTimestamp(geoData)).then(function () {
        if (ttlMs) {
          return dbSet(STORE.META, { geoTtl: ttlMs, cachedAt: now() });
        }
      }).catch(function (e) { console.warn('[BondsDataCache] cacheGeo failed', e); });
    },

    getCachedGeo: function () {
      return dbGet(STORE.GEO).then(function (entry) {
        if (!entry || !entry.data) return null;
        return entry.data;
      }).catch(function () { return null; });
    },

    // Cache full platforms data
    cachePlatforms: function (platformsData, ttlMs) {
      if (!platformsData) return Promise.resolve();
      return dbSet(STORE.PLATFORMS, withTimestamp(platformsData)).then(function () {
        if (ttlMs) {
          return dbGet(STORE.META).then(function (meta) {
            meta = meta || {};
            meta.platformsTtl = ttlMs;
            meta.cachedAt = now();
            return dbSet(STORE.META, meta);
          });
        }
      }).catch(function (e) { console.warn('[BondsDataCache] cachePlatforms failed', e); });
    },

    getCachedPlatforms: function () {
      return dbGet(STORE.PLATFORMS).then(function (entry) {
        if (!entry || !entry.data) return null;
        return entry.data;
      }).catch(function () { return null; });
    },

    // Per-country cache helpers
    cachePlatformsCountry: function (code, data) {
      if (!code || !data) return Promise.resolve();
      return dbSet(STORE.PLATFORMS_COUNTRY + '_' + code.toUpperCase(), withTimestamp(data))
        .catch(function (e) { console.warn('[BondsDataCache] cachePlatformsCountry failed', e); });
    },

    getCachedPlatformsCountry: function (code) {
      return dbGet(STORE.PLATFORMS_COUNTRY + '_' + code.toUpperCase()).then(function (entry) {
        return entry && entry.data ? entry.data : null;
      }).catch(function () { return null; });
    },

    cacheGeoCountry: function (code, data) {
      if (!code || !data) return Promise.resolve();
      return dbSet(STORE.GEO_COUNTRY + '_' + code.toUpperCase(), withTimestamp(data))
        .catch(function (e) { console.warn('[BondsDataCache] cacheGeoCountry failed', e); });
    },

    getCachedGeoCountry: function (code) {
      return dbGet(STORE.GEO_COUNTRY + '_' + code.toUpperCase()).then(function (entry) {
        return entry && entry.data ? entry.data : null;
      }).catch(function () { return null; });
    },

    clear: function () {
      return loadIdb().then(function () {
        return idbKeys().then(function (keys) {
          const toDelete = keys.filter(function (k) {
            return String(k).indexOf('bonds_') === 0;
          });
          return Promise.all(toDelete.map(function (k) { return idbDel(k); }));
        });
      }).catch(function (e) { console.warn('[BondsDataCache] clear failed', e); });
    }
  };

  global.BondsDataCache = BondsDataCache;
})(window);
