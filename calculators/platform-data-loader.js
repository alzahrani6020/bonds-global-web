/**
 * Bonds Platform Data Loader
 * Loads per-country platform data on demand and caches it in IndexedDB.
 * Falls back to window.BondsPlatforms if already loaded.
 */
(function (global) {
  'use strict';

  function getBasePath() {
    const depth = global.location.pathname.replace(/^\/+/, '').split('/').filter(Boolean).length;
    return depth === 0 ? '' : Array(depth).fill('../').join('');
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = url;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('Failed to load ' + url)); };
      document.head.appendChild(script);
    });
  }

  function loadCacheScript() {
    if (typeof global.BondsDataCache !== 'undefined') return Promise.resolve();
    const base = getBasePath();
    return loadScript(base + 'calculators/shared-data-cache.js');
  }

  function loadMeta() {
    if (global.BondsPlatformMeta) return Promise.resolve(global.BondsPlatformMeta);
    const base = getBasePath();
    return loadScript(base + 'calculators/platform-data/meta.js').then(function () {
      return global.BondsPlatformMeta || {};
    });
  }

  const BondsPlatformLoader = {
    loadCountry: function (code) {
      const upper = String(code || 'SA').toUpperCase();
      return loadCacheScript().then(function () {
        return global.BondsDataCache.getCachedPlatformsCountry(upper);
      }).then(function (cached) {
        if (cached) return cached;
        const base = getBasePath();
        return loadScript(base + 'calculators/platform-data/' + upper.toLowerCase() + '.js').then(function () {
          const data = global.BondsPlatformCountryData && global.BondsPlatformCountryData[upper];
          if (!data) throw new Error('Platform data not found for ' + upper);
          global.BondsDataCache.cachePlatformsCountry(upper, data);
          return data;
        });
      });
    },

    getCountryMeta: function (code) {
      return loadMeta().then(function (meta) {
        return meta[code ? code.toUpperCase() : 'SA'] || null;
      });
    },

    getAllCountryMeta: function () {
      return loadMeta().then(function (meta) { return meta; });
    },

    getPlatforms: function (code) {
      return this.loadCountry(code).then(function (data) { return data.platforms || []; });
    },

    getPlatform: function (code, platformId) {
      return this.getPlatforms(code).then(function (platforms) {
        return platforms.find(function (p) { return p.id === platformId; }) || null;
      });
    },

    getCurrencySymbol: function (code, lang) {
      return this.loadCountry(code).then(function (data) {
        if (lang === 'en') return data.currencySymbolEn || data.currencySymbol || data.currency;
        return data.currencySymbol || data.currency;
      });
    },

    getVatRate: function (code) {
      return this.loadCountry(code).then(function (data) { return data.vatRate || 0; });
    }
  };

  global.BondsPlatformLoader = BondsPlatformLoader;
})(window);
