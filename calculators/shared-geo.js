/**
 * Bonds Global — Shared Geographic Utilities
 *
 * Provides a unified API for country/governorate/city selectors across the site.
 * Loads ARAB_COUNTRIES_GEO master data automatically if not present.
 */
(function () {
  'use strict';

  const MASTER_DATA_URLS = [
    'v3/master-data/countries-governorates-cities.js',
    'v3/master-data/global-countries.js',
    'v3/master-data/arab-extended-countries.js'
  ];

  function getBasePath() {
    const depth = window.location.pathname.replace(/^\/+/, '').split('/').filter(Boolean).length;
    return depth === 0 ? '' : Array(depth).fill('../').join('');
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load ' + url));
      document.head.appendChild(script);
    });
  }

  function isDataReady() {
    return typeof window.ARAB_COUNTRIES_GEO !== 'undefined' &&
           typeof window.GLOBAL_COUNTRIES_GEO !== 'undefined' &&
           typeof window.ARAB_EXTENDED_COUNTRIES_GEO !== 'undefined';
  }

  function ensureMasterData() {
    return new Promise((resolve, reject) => {
      if (isDataReady()) {
        return resolve(getData());
      }

      const base = getBasePath();
      const promises = MASTER_DATA_URLS.map(url => loadScript(base + url));
      Promise.all(promises).then(() => {
        if (isDataReady()) return resolve(getData());
        reject(new Error('Country master data not found after loading scripts'));
      }).catch(reject);
    });
  }

  function getData() {
    return Object.assign(
      {},
      window.ARAB_COUNTRIES_GEO || {},
      window.GLOBAL_COUNTRIES_GEO || {},
      window.ARAB_EXTENDED_COUNTRIES_GEO || {}
    );
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
    const data = getData();
    const lang = getLang(options);
    return Object.keys(data).map(code => ({
      value: code,
      label: label(data[code], lang),
      icon: `https://flagcdn.com/w20/${code.toLowerCase()}.png`,
      raw: data[code]
    }));
  }

  function getGovernorates(countryCode, options) {
    const data = getData();
    const lang = getLang(options);
    const country = data[countryCode];
    if (!country || !Array.isArray(country.governorates)) return [];
    return country.governorates.map((gov, index) => ({
      value: String(index),
      label: label(gov, lang),
      index: index,
      raw: gov
    }));
  }

  function getCities(countryCode, governorateIndex, options) {
    const data = getData();
    const lang = getLang(options);
    const country = data[countryCode];
    if (!country || !Array.isArray(country.governorates)) return [];
    const gov = country.governorates[Number(governorateIndex)];
    if (!gov || !Array.isArray(gov.cities)) return [];
    return gov.cities.map((city, index) => ({
      value: city.code || `${countryCode}-${String(governorateIndex).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`,
      label: label(city, lang),
      raw: city
    }));
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
            return { countryCode, governorateIndex: g, cityIndex: c, city, governorate: gov, country };
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
    const country = data[code];
    if (!country) return null;
    return { code, name: country.name, nameEn: country.nameEn, flag: country.flag };
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
    items.forEach(item => {
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
      console.warn('BondsGeo.bindCascading: one or more selects not found', { countryId, governorateId, cityId });
      return;
    }

    const placeholders = {
      ar: { country: 'اختر الدولة', governorate: 'اختر المحافظة', city: 'اختر المدينة' },
      en: { country: 'Select country', governorate: 'Select region', city: 'Select city' }
    };
    const p = placeholders[lang] || placeholders.ar;

    const countrySelect = () => getActiveSelect(_countrySelect);
    const governorateSelect = () => getActiveSelect(_governorateSelect);
    const citySelect = () => getActiveSelect(_citySelect);

    function updateGovernorates() {
      const cs = countrySelect();
      const gs = governorateSelect();
      const cits = citySelect();
      const countryCode = cs ? cs.value : '';
      populateSelect(gs, getGovernorates(countryCode, { lang }), { placeholder: p.governorate });
      populateSelect(cits, [], { placeholder: p.city });
      refreshDropdown(gs);
      refreshDropdown(cits);
    }

    function updateCities() {
      const cs = countrySelect();
      const gs = governorateSelect();
      const cits = citySelect();
      const countryCode = cs ? cs.value : '';
      const governorateIndex = gs ? gs.value : '';
      populateSelect(cits, getCities(countryCode, governorateIndex, { lang }), { placeholder: p.city });
      refreshDropdown(cits);
    }

    function apply() {
      const cs = countrySelect();
      const gs = governorateSelect();
      const cits = citySelect();
      populateSelect(cs, getCountries({ lang }), { placeholder: p.country, selected: config.selectedCountry || 'SA' });
      refreshDropdown(cs);
      if (config.selectedCountry && cs) {
        cs.value = config.selectedCountry;
        updateGovernorates();
        if (config.selectedGovernorate !== undefined) {
          gs.value = String(config.selectedGovernorate);
          updateCities();
          if (config.selectedCity) {
            cits.value = config.selectedCity;
          }
        } else if (config.selectedCity) {
          const found = findCityByCode(config.selectedCity);
          if (found) {
            gs.value = String(found.governorateIndex);
            updateCities();
            cits.value = config.selectedCity;
          }
        }
      }
    }

    function attachUniversalDropdownListener(selectEl, handler) {
      if (typeof window === 'undefined' || !window.getUniversalDropdown) return;
      const dd = window.getUniversalDropdown(selectEl);
      if (!dd || !dd.opts) return;
      const orig = dd.opts.onChange;
      dd.opts.onChange = function(value, label, instance) {
        if (typeof orig === 'function') orig(value, label, instance);
        handler();
      };
    }

    _countrySelect.addEventListener('change', updateGovernorates);
    _governorateSelect.addEventListener('change', updateCities);
    attachUniversalDropdownListener(_countrySelect, updateGovernorates);
    attachUniversalDropdownListener(_governorateSelect, updateCities);

    const ready = ensureMasterData().then(apply).catch(err => console.warn('BondsGeo.bindCascading:', err));

    return {
      countrySelect: _countrySelect,
      governorateSelect: _governorateSelect,
      citySelect: _citySelect,
      ready,
      refresh: () => {
        apply();
        return ready;
      },
      setValues: (selectedCountry, selectedGovernorate, selectedCity) => {
        if (selectedCountry) {
          const cs = countrySelect();
          const gs = governorateSelect();
          const cits = citySelect();
          if (cs) cs.value = selectedCountry;
          updateGovernorates();
          if (selectedGovernorate !== undefined && selectedGovernorate !== '') {
            if (gs) gs.value = String(selectedGovernorate);
            updateCities();
            if (selectedCity && cits) cits.value = selectedCity;
          } else if (selectedCity) {
            const found = findCityByCode(selectedCity);
            if (found) {
              if (gs) gs.value = String(found.governorateIndex);
              updateCities();
              if (cits) cits.value = selectedCity;
            }
          }
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
      populateSelect(select, getCountries({ lang }), { placeholder: placeholder, selected: config.selectedCountry || 'SA' });
      refreshDropdown(select);
    }
    const ready = ensureMasterData().then(apply).catch(err => console.warn('BondsGeo.bindCountryOnly:', err));
    return { select: _select, ready, refresh: () => { apply(); return ready; } };
  }

  window.BondsGeo = {
    ensureMasterData,
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
    ensureMasterData().then(function() {
      selects.forEach(function(select) {
        const lang = select.dataset.bondsGeoLang || getLang();
        bindCountryOnly({ selectId: select, lang: lang, selectedCountry: 'SA' });
      });
    }).catch(function(err) {
      console.warn('BondsGeo.autoInit:', err);
    });
  }

  function scheduleAutoInit() {
    if (typeof document === 'undefined') return;
    // Run after all DOMContentLoaded handlers (e.g. UniversalDropdown auto-init)
    // so we target the enhanced select clone and its MutationObserver is active.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(autoInit, 0); });
    } else {
      setTimeout(autoInit, 0);
    }
  }

  scheduleAutoInit();
})();
