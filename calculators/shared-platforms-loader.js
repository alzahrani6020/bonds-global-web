/**
 * Bonds Shared Platforms Loader
 * Loads only the active country's platform data plus global metadata,
 * instead of the full shared-platforms.js bundle.
 *
 * For the active country, the data is injected synchronously during parsing
 * so existing calculators can keep calling BondsPlatforms.getPlatforms(code)
 * synchronously. Other countries are loaded on demand and cached in IndexedDB.
 */
(function (global) {
  'use strict';

  function getBasePath() {
    const depth = global.location.pathname.replace(/^\/+/, '').split('/').filter(Boolean).length;
    return depth === 0 ? '' : Array(depth).fill('../').join('');
  }

  function detectCountry() {
    try {
      if (global.location && global.location.search) {
        const m = global.location.search.match(/[?&]country=([A-Za-z]{2})/);
        if (m) return m[1].toUpperCase();
      }
      if (global.localStorage) {
        const saved = global.localStorage.getItem('bonds_country');
        if (saved) return saved.toUpperCase();
      }
      if (global.document && global.document.documentElement) {
        const lang = global.document.documentElement.lang;
        if (lang && lang.startsWith('en')) return 'SA';
      }
    } catch (e) {}
    return 'SA';
  }

  const base = getBasePath();
  let activeCountry = detectCountry();

  // Synchronously inject active-country scripts during HTML parsing.
  // This keeps BondsPlatforms.getPlatforms(code) synchronous for the active country.
  if (global.document && typeof global.document.write === 'function') {
    global.document.write('<script src="' + base + 'calculators/platform-data/meta.js?v=1"><\/script>');
    global.document.write('<script src="' + base + 'calculators/platform-data/' + activeCountry.toLowerCase() + '.js?v=1"><\/script>');
  }

  let cacheReady = false;
  let cachePromise = null;

  function ensureCache() {
    if (cacheReady) return Promise.resolve();
    if (cachePromise) return cachePromise;
    if (typeof global.BondsDataCache !== 'undefined') {
      cacheReady = true;
      return Promise.resolve();
    }
    cachePromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = base + 'calculators/shared-data-cache.js';
      script.onload = function () {
        cacheReady = true;
        resolve();
      };
      script.onerror = function () {
        cacheReady = false;
        resolve(); // continue without cache
      };
      document.head.appendChild(script);
    });
    return cachePromise;
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = url;
      script.async = false;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('Failed to load ' + url)); };
      document.head.appendChild(script);
    });
  }

  function getMeta() {
    return global.BondsPlatformMeta || {};
  }

  function getCountryData(code) {
    return global.BondsPlatformCountryData && global.BondsPlatformCountryData[code]
      ? global.BondsPlatformCountryData[code]
      : null;
  }

  function setCountryData(code, data) {
    global.BondsPlatformCountryData = global.BondsPlatformCountryData || {};
    global.BondsPlatformCountryData[code] = data;
  }

  function dispatchCountryLoaded(code) {
    if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
    try {
      document.dispatchEvent(new CustomEvent('bonds:countryPlatformsLoaded', {
        detail: { country: code }
      }));
    } catch (e) {}
  }

  function ensureCountry(code) {
    const upper = String(code || activeCountry).toUpperCase();
    const existing = getCountryData(upper);
    if (existing) return Promise.resolve(existing);

    return ensureCache().then(function () {
      if (typeof global.BondsDataCache !== 'undefined') {
        return global.BondsDataCache.getCachedPlatformsCountry(upper);
      }
      return null;
    }).then(function (cached) {
      if (cached) {
        setCountryData(upper, cached);
        dispatchCountryLoaded(upper);
        return cached;
      }
      return loadScript(base + 'calculators/platform-data/' + upper.toLowerCase() + '.js').then(function () {
        const data = getCountryData(upper);
        if (!data) throw new Error('Platform data not found for ' + upper);
        if (typeof global.BondsDataCache !== 'undefined') {
          global.BondsDataCache.cachePlatformsCountry(upper, data);
        }
        dispatchCountryLoaded(upper);
        return data;
      });
    });
  }

  function setActiveCountry(code) {
    const upper = String(code).toUpperCase();
    activeCountry = upper;
    try {
      if (global.localStorage) global.localStorage.setItem('bonds_country', upper);
    } catch (e) {}
    return ensureCountry(upper).then(function (data) {
      if (global.BondsPlatforms) {
        global.BondsPlatforms.PLATFORMS_DATA = global.BondsPlatformCountryData || {};
        global.BondsPlatforms._activeCountry = upper;
      }
      return data;
    });
  }

  function getCountryMeta(code) {
    return getMeta()[code ? code.toUpperCase() : activeCountry] || null;
  }

  function getAllCountryMeta() {
    return getMeta();
  }

  function getPlatforms(code) {
    const upper = String(code || activeCountry).toUpperCase();
    const data = getCountryData(upper);
    return data ? (data.platforms || []) : [];
  }

  function getPlatform(code, platformId) {
    const platforms = getPlatforms(code);
    return platforms.find(function (p) { return p.id === platformId; }) || null;
  }

  function getPlatformByIndex(code, index) {
    const platforms = getPlatforms(code);
    return platforms[index] || null;
  }

  function getCurrencySymbol(code, lang) {
    const meta = getCountryMeta(code);
    if (!meta) return lang === 'en' ? 'SAR' : 'ريال';
    return lang === 'en' ? (meta.currencySymbolEn || meta.currencySymbol || meta.currency) : (meta.currencySymbol || meta.currency);
  }

  function getVatRate(code) {
    const meta = getCountryMeta(code);
    return meta ? (meta.vatRate || 0) : 0;
  }

  // Async loaders for non-active countries; existing UIs that change country
  // can call these and re-render inside the returned Promise.
  function loadAndGetPlatforms(code) {
    return ensureCountry(code).then(function (data) { return data ? (data.platforms || []) : []; });
  }

  global.BondsPlatforms = {
    COUNTRY_META: getMeta(),
    PLATFORMS_DATA: global.BondsPlatformCountryData || {},
    getCountryMeta,
    getAllCountryMeta,
    getPlatforms,
    getPlatform,
    getPlatformByIndex,
    getCurrencySymbol,
    getVatRate,
    // active country helpers
    setActiveCountry,
    getActiveCountry: function () { return activeCountry; },
    // async helpers
    ensureCountry,
    loadAndGetPlatforms,
    _activeCountry: activeCountry
  };

  // Cache the synchronously-loaded active country data as soon as cache is ready.
  ensureCache().then(function () {
    const data = getCountryData(activeCountry);
    if (data && typeof global.BondsDataCache !== 'undefined') {
      global.BondsDataCache.cachePlatformsCountry(activeCountry, data);
    }
  }).catch(function () {});
})(window);
