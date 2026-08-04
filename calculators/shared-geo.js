/**
 * Bonds Global — Shared Geographic Utilities
 *
 * Provides a unified API for country/governorate/city selectors across the site.
 * Loads geographic data on demand:
 *   - Synchronously injects geo-data/meta.js + the active country chunk during
 *     HTML parsing so country lists and the active country's cities are
 *     available immediately.
 *   - Falls back to the legacy full master-data scripts when they are present.
 *   - Caches merged data in IndexedDB for faster repeat visits.
 *   - Lazy-loads other country chunks when the user selects a different country.
 */
(function () {
  'use strict';

  // Legacy full-data scripts. Kept for compatibility with tests and any page
  // that still includes them directly.
  const MASTER_DATA_URLS = [
    'v3/master-data/countries-governorates-cities.js',
    'v3/master-data/global-countries.js',
    'v3/master-data/arab-extended-countries.js'
  ];

  const DEFAULT_COUNTRY = 'SA';
  const GEO_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
  const BACKGROUND_LOAD_CONCURRENCY = 6;

  let _cachedData = null;
  let _activeCountry = detectCountry();
  let _ensureMasterPromise = null;
  let _loadAllPromise = null;
  const _countryPromises = {};

  function getBasePath() {
    if (!window.location || !window.location.pathname) return '';
    const depth = window.location.pathname.replace(/^\/+/, '').split('/').filter(Boolean).length;
    return depth === 0 ? '' : Array(depth).fill('../').join('');
  }

  function detectCountry() {
    try {
      if (window.location && window.location.search) {
        const m = window.location.search.match(/[?&]country=([A-Za-z]{2})/);
        if (m) return m[1].toUpperCase();
      }
      if (window.localStorage) {
        const saved = window.localStorage.getItem('bonds_country');
        if (saved) return saved.toUpperCase();
      }
      if (window.document && window.document.documentElement) {
        const lang = window.document.documentElement.lang;
        if (lang && lang.startsWith('en')) return 'SA';
      }
    } catch (e) {}
    return DEFAULT_COUNTRY;
  }

  const base = getBasePath();

  // Synchronously inject the metadata bundle and the active country chunk
  // during HTML parsing. This keeps BondsGeo.getCountries() synchronous and
  // makes the active country's governorates/cities available immediately.
  if (typeof document !== 'undefined' &&
      document.readyState === 'loading' &&
      typeof document.write === 'function') {
    document.write('<script src="' + base + 'calculators/geo-data/meta.js?v=1"><\/script>');
    document.write('<script src="' + base + 'calculators/geo-data/' + _activeCountry.toLowerCase() + '.js?v=1"><\/script>');
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
    if (typeof window.BondsDataCache !== 'undefined') return Promise.resolve();
    return loadScript(base + 'calculators/shared-data-cache.js');
  }

  function isDataReady() {
    return typeof window.ARAB_COUNTRIES_GEO !== 'undefined' &&
           typeof window.GLOBAL_COUNTRIES_GEO !== 'undefined' &&
           typeof window.ARAB_EXTENDED_COUNTRIES_GEO !== 'undefined';
  }

  function mergeData() {
    return Object.assign(
      {},
      window.ARAB_COUNTRIES_GEO || {},
      window.GLOBAL_COUNTRIES_GEO || {},
      window.ARAB_EXTENDED_COUNTRIES_GEO || {}
    );
  }

  function getMeta() {
    return window.BondsGeoMeta || {};
  }

  function hasGovernorates(country) {
    return country && Array.isArray(country.governorates) && country.governorates.length > 0;
  }

  function buildDataFromMeta() {
    const meta = getMeta();
    const chunks = window.BondsGeoCountryData || {};
    const data = {};
    Object.keys(meta).forEach(function (code) {
      data[code] = chunks[code] || meta[code];
    });
    return data;
  }

  function refreshCachedData() {
    if (isDataReady()) {
      _cachedData = mergeData();
    } else if (Object.keys(getMeta()).length) {
      _cachedData = buildDataFromMeta();
    }
    return _cachedData;
  }

  function getData() {
    if (_cachedData) return _cachedData;
    if (isDataReady()) return mergeData();
    const meta = getMeta();
    if (Object.keys(meta).length) return buildDataFromMeta();
    return {};
  }

  function dispatchCountryLoaded(code) {
    if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
    try {
      document.dispatchEvent(new CustomEvent('bonds:countryGeoLoaded', {
        detail: { country: code }
      }));
    } catch (e) {}
  }

  function loadMeta() {
    if (Object.keys(getMeta()).length) return Promise.resolve(getMeta());
    return loadScript(base + 'calculators/geo-data/meta.js').then(function () {
      return getMeta();
    });
  }

  function loadCountryChunk(code) {
    const upper = String(code).toUpperCase();
    if (_countryPromises[upper]) return _countryPromises[upper];

    _countryPromises[upper] = new Promise(function (resolve, reject) {
      if (window.BondsGeoCountryData && window.BondsGeoCountryData[upper]) {
        refreshCachedData();
        dispatchCountryLoaded(upper);
        return resolve(window.BondsGeoCountryData[upper]);
      }

      loadCacheScript().then(function () {
        if (typeof window.BondsDataCache !== 'undefined') {
          return window.BondsDataCache.getCachedGeoCountry(upper);
        }
        return null;
      }).then(function (cached) {
        if (cached) {
          window.BondsGeoCountryData = window.BondsGeoCountryData || {};
          window.BondsGeoCountryData[upper] = cached;
          refreshCachedData();
          dispatchCountryLoaded(upper);
          return resolve(cached);
        }
        return loadScript(base + 'calculators/geo-data/' + upper.toLowerCase() + '.js').then(function () {
          const data = window.BondsGeoCountryData && window.BondsGeoCountryData[upper];
          if (!data) throw new Error('Geo data not found for ' + upper);
          if (typeof window.BondsDataCache !== 'undefined') {
            window.BondsDataCache.cacheGeoCountry(upper, data);
          }
          refreshCachedData();
          dispatchCountryLoaded(upper);
          resolve(data);
        });
      }).catch(function (err) {
        delete _countryPromises[upper];
        reject(err);
      });
    });

    return _countryPromises[upper];
  }

  function ensureCountry(code) {
    const upper = String(code || _activeCountry).toUpperCase();
    const data = getData();
    if (data[upper] && hasGovernorates(data[upper])) {
      return Promise.resolve(data[upper]);
    }
    if (window.BondsGeoCountryData && window.BondsGeoCountryData[upper]) {
      refreshCachedData();
      return Promise.resolve(window.BondsGeoCountryData[upper]);
    }
    return loadCountryChunk(upper);
  }

  function promisePool(items, fn, concurrency) {
    return new Promise(function (resolve, reject) {
      let index = 0;
      let running = 0;
      let completed = 0;
      const results = [];
      const errors = [];

      function doneOne() {
        running--;
        completed++;
        if (completed === items.length) {
          resolve(results);
        } else {
          next();
        }
      }

      function next() {
        if (index >= items.length || running >= concurrency) return;
        const idx = index++;
        running++;
        fn(items[idx]).then(function (res) {
          results[idx] = res;
        }, function (err) {
          errors.push(err);
        }).finally(doneOne);
        next();
      }

      if (items.length === 0) return resolve(results);
      next();
    });
  }

  function loadAllCountries() {
    if (_loadAllPromise) return _loadAllPromise;
    _loadAllPromise = loadMeta().then(function (meta) {
      const codes = Object.keys(meta);
      return promisePool(codes, ensureCountry, BACKGROUND_LOAD_CONCURRENCY);
    }).then(function () {
      return getData();
    });
    return _loadAllPromise;
  }

  function cacheFullData() {
    if (typeof window.BondsDataCache !== 'undefined') {
      window.BondsDataCache.cacheGeo(getData(), GEO_TTL_MS).catch(function (e) {
        console.warn('[BondsGeo] cacheGeo failed', e);
      });
    }
  }

  function startChunkLoading(resolve, reject) {
    loadMeta().then(function () {
      refreshCachedData();
      return ensureCountry(_activeCountry);
    }).then(function () {
      resolve(getData());
      // Background: load remaining countries and cache the full dataset.
      if (!_loadAllPromise) {
        _loadAllPromise = loadAllCountries().then(function () {
          cacheFullData();
        }).catch(function (e) {
          console.warn('[BondsGeo] background load all failed', e);
        });
      }
    }).catch(reject);
  }

  function ensureMasterData() {
    if (_ensureMasterPromise) return _ensureMasterPromise;

    _ensureMasterPromise = new Promise(function (resolve, reject) {
      if (isDataReady()) {
        _cachedData = mergeData();
        cacheFullData();
        return resolve(getData());
      }

      loadCacheScript().then(function () {
        return window.BondsDataCache.getCachedGeo();
      }).then(function (cached) {
        if (cached && Object.keys(cached).length) {
          _cachedData = cached;
          resolve(getData());
          // The full cache already has everything; no need to load chunks.
          return;
        }
        startChunkLoading(resolve, reject);
      }).catch(function (e) {
        console.warn('[BondsGeo] cache load failed, falling back to chunks', e);
        startChunkLoading(resolve, reject);
      });
    });

    return _ensureMasterPromise;
  }

  function getLang(options) {
    if (options && options.lang) return options.lang;
    const html = document.documentElement;
    if (html && html.lang) return html.lang.startsWith('en') ? 'en' : 'ar';
    return 'ar';
  }

  function label(item, lang) {
    if (!item) return '';
    if (lang === 'en' && item.nameEn) return item.nameEn;
    return item.name || item.nameEn || '';
  }

  function getCountries(options) {
    const lang = getLang(options);
    const meta = getMeta();
    const data = getData();

    let codes;
    if (Object.keys(meta).length) {
      codes = Object.keys(meta);
    } else {
      codes = Object.keys(data);
    }

    return codes.map(function (code) {
      const item = data[code] || meta[code];
      return {
        value: code,
        label: label(item, lang),
        icon: 'https://flagcdn.com/w20/' + code.toLowerCase() + '.png',
        raw: item
      };
    });
  }

  function getGovernorates(countryCode, options) {
    const data = getData();
    const lang = getLang(options);
    const country = data[countryCode];
    if (!country || !Array.isArray(country.governorates)) return [];
    return country.governorates.map(function (gov, index) {
      return {
        value: String(index),
        label: label(gov, lang),
        index: index,
        raw: gov
      };
    });
  }

  function getCities(countryCode, governorateIndex, options) {
    const data = getData();
    const lang = getLang(options);
    const country = data[countryCode];
    if (!country || !Array.isArray(country.governorates)) return [];
    const gov = country.governorates[Number(governorateIndex)];
    if (!gov || !Array.isArray(gov.cities)) return [];
    return gov.cities.map(function (city, index) {
      return {
        value: city.code || (countryCode + '-' + String(governorateIndex).padStart(2, '0') + '-' + String(index + 1).padStart(3, '0')),
        label: label(city, lang),
        raw: city
      };
    });
  }

  function findCityByCode(code) {
    if (!code) return null;
    const data = getData();
    for (const countryCode of Object.keys(data)) {
      const country = data[countryCode];
      if (!country.governorates) continue;
      for (let g = 0; g < country.governorates.length; g++) {
        const gov = country.governorates[g];
        if (!gov.cities) continue;
        for (let c = 0; c < gov.cities.length; c++) {
          const city = gov.cities[c];
          if (city.code === code) {
            return { countryCode: countryCode, governorateIndex: g, cityIndex: c, city: city, governorate: gov, country: country };
          }
        }
      }
    }
    return null;
  }

  function getGovernorateAndCityByCode(code) {
    return findCityByCode(code);
  }

  function getCountryName(code, lang) {
    const data = getData();
    const country = data[code];
    if (!country) return code;
    return label(country, lang || getLang());
  }

  function getCountryMeta(code) {
    if (window.BondsPlatforms && window.BondsPlatforms.getCountryMeta) {
      return window.BondsPlatforms.getCountryMeta(code);
    }
    const data = getData();
    return data[code] || null;
  }

  function getCurrencySymbol(code, lang) {
    if (window.BondsPlatforms && window.BondsPlatforms.getCurrencySymbol) {
      return window.BondsPlatforms.getCurrencySymbol(code, lang);
    }
    return lang === 'en' ? 'SAR' : 'ريال';
  }

  function getVatRate(code) {
    if (window.BondsPlatforms && window.BondsPlatforms.getVatRate) {
      return window.BondsPlatforms.getVatRate(code);
    }
    return 0;
  }

  function populateSelect(selectEl, items, options) {
    if (!selectEl) return;
    options = options || {};
    const placeholder = options.placeholder !== undefined ? options.placeholder : '';
    selectEl.innerHTML = '';
    if (placeholder !== null) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = placeholder;
      selectEl.appendChild(opt);
    }
    items.forEach(function (item) {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      if (item.icon) opt.dataset.icon = item.icon;
      selectEl.appendChild(opt);
    });
    if (options.selected) selectEl.value = options.selected;
  }

  function getActiveSelect(select) {
    if (!select) return null;
    if (select.id) {
      const byId = document.getElementById(select.id);
      if (byId) return byId;
    }
    return select;
  }

  function refreshDropdown(select) {
    const active = getActiveSelect(select);
    if (!active) return;
    if (window.getUniversalDropdown) {
      const dd = window.getUniversalDropdown(active);
      if (dd && typeof dd.refresh === 'function') {
        dd.refresh();
        return;
      }
    }
    const wrapper = active.closest && active.closest('.ud-dropdown');
    if (wrapper && wrapper._universalDropdown && typeof wrapper._universalDropdown.refresh === 'function') {
      wrapper._universalDropdown.refresh();
    }
  }

  function bindCascading(config) {
    const countryId = config.countryId || 'country';
    const governorateId = config.governorateId || 'governorate';
    const cityId = config.cityId || 'city';
    const lang = getLang(config);

    const _countrySelect = typeof countryId === 'string' ? document.getElementById(countryId) : countryId;
    const _governorateSelect = typeof governorateId === 'string' ? document.getElementById(governorateId) : governorateId;
    const _citySelect = typeof cityId === 'string' ? document.getElementById(cityId) : cityId;

    if (!_countrySelect || !_governorateSelect || !_citySelect) {
      console.warn('BondsGeo.bindCascading: one or more selects not found', { countryId: countryId, governorateId: governorateId, cityId: cityId });
      return;
    }

    const placeholders = {
      ar: { country: 'اختر الدولة', governorate: 'اختر المحافظة', city: 'اختر المدينة' },
      en: { country: 'Select country', governorate: 'Select region', city: 'Select city' }
    };
    const p = placeholders[lang] || placeholders.ar;

    const countrySelect = function () { return getActiveSelect(_countrySelect); };
    const governorateSelect = function () { return getActiveSelect(_governorateSelect); };
    const citySelect = function () { return getActiveSelect(_citySelect); };

    function updateGovernorates() {
      const cs = countrySelect();
      const gs = governorateSelect();
      const cits = citySelect();
      const countryCode = cs ? cs.value : '';
      if (!countryCode) {
        populateSelect(gs, [], { placeholder: p.governorate });
        populateSelect(cits, [], { placeholder: p.city });
        refreshDropdown(gs);
        refreshDropdown(cits);
        return Promise.resolve();
      }
      return ensureCountry(countryCode).then(function () {
        populateSelect(gs, getGovernorates(countryCode, { lang: lang }), { placeholder: p.governorate });
        populateSelect(cits, [], { placeholder: p.city });
        refreshDropdown(gs);
        refreshDropdown(cits);
      }).catch(function (err) {
        console.warn('[BondsGeo] updateGovernorates failed', err);
      });
    }

    function updateCities() {
      const cs = countrySelect();
      const gs = governorateSelect();
      const cits = citySelect();
      const countryCode = cs ? cs.value : '';
      const governorateIndex = gs ? gs.value : '';
      populateSelect(cits, getCities(countryCode, governorateIndex, { lang: lang }), { placeholder: p.city });
      refreshDropdown(cits);
    }

    function apply() {
      const cs = countrySelect();
      const gs = governorateSelect();
      const cits = citySelect();
      populateSelect(cs, getCountries({ lang: lang }), { placeholder: p.country, selected: config.selectedCountry || _activeCountry });
      refreshDropdown(cs);

      if (!cs || !config.selectedCountry) return Promise.resolve();

      const countryCode = config.selectedCountry;
      cs.value = countryCode;

      return ensureCountry(countryCode).then(function () {
        populateSelect(gs, getGovernorates(countryCode, { lang: lang }), { placeholder: p.governorate });
        refreshDropdown(gs);

        if (config.selectedGovernorate !== undefined && config.selectedGovernorate !== '') {
          gs.value = String(config.selectedGovernorate);
          populateSelect(cits, getCities(countryCode, gs.value, { lang: lang }), { placeholder: p.city });
          refreshDropdown(cits);
          if (config.selectedCity) {
            cits.value = config.selectedCity;
          }
        } else if (config.selectedCity) {
          const found = findCityByCode(config.selectedCity);
          if (found) {
            gs.value = String(found.governorateIndex);
            populateSelect(cits, getCities(countryCode, gs.value, { lang: lang }), { placeholder: p.city });
            refreshDropdown(cits);
            cits.value = config.selectedCity;
          }
        }
      }).catch(function (err) {
        console.warn('[BondsGeo] bindCascading apply failed', err);
      });
    }

    function attachUniversalDropdownListener(selectEl, handler) {
      if (typeof window === 'undefined' || !window.getUniversalDropdown) return;
      const dd = window.getUniversalDropdown(selectEl);
      if (!dd || !dd.opts) return;
      const orig = dd.opts.onChange;
      dd.opts.onChange = function (value, label, instance) {
        if (typeof orig === 'function') orig(value, label, instance);
        handler();
      };
    }

    _countrySelect.addEventListener('change', updateGovernorates);
    _governorateSelect.addEventListener('change', updateCities);
    attachUniversalDropdownListener(_countrySelect, updateGovernorates);
    attachUniversalDropdownListener(_governorateSelect, updateCities);

    const ready = ensureMasterData().then(apply).catch(function (err) {
      console.warn('BondsGeo.bindCascading:', err);
    });

    return {
      countrySelect: _countrySelect,
      governorateSelect: _governorateSelect,
      citySelect: _citySelect,
      ready: ready,
      refresh: function () {
        apply();
        return ready;
      },
      setValues: function (selectedCountry, selectedGovernorate, selectedCity) {
        if (selectedCountry) {
          const cs = countrySelect();
          const gs = governorateSelect();
          const cits = citySelect();
          if (cs) cs.value = selectedCountry;
          ensureCountry(selectedCountry).then(function () {
            populateSelect(gs, getGovernorates(selectedCountry, { lang: lang }), { placeholder: p.governorate });
            refreshDropdown(gs);
            if (selectedGovernorate !== undefined && selectedGovernorate !== '') {
              if (gs) gs.value = String(selectedGovernorate);
              populateSelect(cits, getCities(selectedCountry, gs ? gs.value : '', { lang: lang }), { placeholder: p.city });
              refreshDropdown(cits);
              if (selectedCity && cits) cits.value = selectedCity;
            } else if (selectedCity) {
              const found = findCityByCode(selectedCity);
              if (found) {
                if (gs) gs.value = String(found.governorateIndex);
                populateSelect(cits, getCities(selectedCountry, gs ? gs.value : '', { lang: lang }), { placeholder: p.city });
                refreshDropdown(cits);
                if (cits) cits.value = selectedCity;
              }
            }
          }).catch(function (err) {
            console.warn('[BondsGeo] setValues failed', err);
          });
        }
      }
    };
  }

  function bindCountryOnly(config) {
    const selectId = config.selectId || config.countryId || 'country';
    const lang = getLang(config);
    const _select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
    if (!_select) {
      console.warn('BondsGeo.bindCountryOnly: select not found', selectId);
      return null;
    }
    const placeholder = config.placeholder || (lang === 'en' ? 'Select country' : 'اختر الدولة');
    function apply() {
      const select = getActiveSelect(_select);
      if (!select) return;
      populateSelect(select, getCountries({ lang: lang }), { placeholder: placeholder, selected: config.selectedCountry || _activeCountry });
      refreshDropdown(select);
    }
    const ready = ensureMasterData().then(apply).catch(function (err) {
      console.warn('BondsGeo.bindCountryOnly:', err);
    });
    return { select: _select, ready: ready, refresh: function () { apply(); return ready; } };
  }

  window.BondsGeo = {
    ensureMasterData,
    ensureCountry,
    loadAllCountries,
    getCountries,
    getGovernorates,
    getCities,
    populateSelect,
    bindCascading,
    bindCountryOnly,
    findCityByCode,
    getCountryName,
    getCountryMeta,
    getCurrencySymbol,
    getVatRate,
    getGovernorateAndCityByCode,
    getData
  };

  // Auto-initialize country selects marked with data-bonds-geo-bind="country"
  function autoInit() {
    if (typeof document === 'undefined') return;
    const selects = Array.from(document.querySelectorAll('[data-bonds-geo-bind="country"]'));
    if (!selects.length) return;
    ensureMasterData().then(function () {
      selects.forEach(function (select) {
        const lang = select.dataset.bondsGeoLang || getLang();
        bindCountryOnly({ selectId: select, lang: lang, selectedCountry: _activeCountry });
      });
    }).catch(function (err) {
      console.warn('BondsGeo.autoInit:', err);
    });
  }

  function scheduleAutoInit() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(autoInit, 0); });
    } else {
      setTimeout(autoInit, 0);
    }
  }

  scheduleAutoInit();
})();
