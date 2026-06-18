/**
 * Bonds Global — Shared Geographic Utilities
 *
 * Provides a unified API for country/governorate/city selectors across the site.
 * Loads ARAB_COUNTRIES_GEO master data automatically if not present.
 */
(function () {
  'use strict';

  const MASTER_DATA_URL = 'v3/master-data/countries-governorates-cities.js';

  function ensureMasterData() {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.ARAB_COUNTRIES_GEO) {
        return resolve(window.ARAB_COUNTRIES_GEO);
      }

      // Try to compute relative path from current page
      const depth = window.location.pathname.replace(/^\/+/, '').split('/').filter(Boolean).length;
      const base = depth === 0 ? '' : Array(depth).fill('../').join('');
      const url = base + MASTER_DATA_URL;

      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        if (window.ARAB_COUNTRIES_GEO) resolve(window.ARAB_COUNTRIES_GEO);
        else reject(new Error('ARAB_COUNTRIES_GEO not found after loading master data'));
      };
      script.onerror = () => reject(new Error('Failed to load ' + url));
      document.head.appendChild(script);
    });
  }

  function getData() {
    return window.ARAB_COUNTRIES_GEO || {};
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
      label: `${data[code].flag || ''} ${label(data[code], lang)}`.trim(),
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
      selectEl.appendChild(opt);
    });
    if (options.selected) selectEl.value = options.selected;
  }

  function bindCascading(config) {
    const countryId = config.countryId || 'country';
    const governorateId = config.governorateId || 'governorate';
    const cityId = config.cityId || 'city';
    const lang = getLang(config);

    const countrySelect = typeof countryId === 'string' ? document.getElementById(countryId) : countryId;
    const governorateSelect = typeof governorateId === 'string' ? document.getElementById(governorateId) : governorateId;
    const citySelect = typeof cityId === 'string' ? document.getElementById(cityId) : cityId;

    if (!countrySelect || !governorateSelect || !citySelect) {
      console.warn('BondsGeo.bindCascading: one or more selects not found', { countryId, governorateId, cityId });
      return;
    }

    const placeholders = {
      ar: { country: 'اختر الدولة', governorate: 'اختر المحافظة', city: 'اختر المدينة' },
      en: { country: 'Select country', governorate: 'Select region', city: 'Select city' }
    };
    const p = placeholders[lang] || placeholders.ar;

    populateSelect(countrySelect, getCountries({ lang }), { placeholder: p.country, selected: config.selectedCountry });

    function updateGovernorates() {
      const countryCode = countrySelect.value;
      populateSelect(governorateSelect, getGovernorates(countryCode, { lang }), { placeholder: p.governorate });
      populateSelect(citySelect, [], { placeholder: p.city });
    }

    function updateCities() {
      const countryCode = countrySelect.value;
      const governorateIndex = governorateSelect.value;
      populateSelect(citySelect, getCities(countryCode, governorateIndex, { lang }), { placeholder: p.city });
    }

    countrySelect.addEventListener('change', updateGovernorates);
    governorateSelect.addEventListener('change', updateCities);

    // Restore selections if provided
    if (config.selectedCountry) {
      countrySelect.value = config.selectedCountry;
      updateGovernorates();
      if (config.selectedGovernorate !== undefined) {
        governorateSelect.value = String(config.selectedGovernorate);
        updateCities();
        if (config.selectedCity) {
          citySelect.value = config.selectedCity;
        }
      } else if (config.selectedCity) {
        // Try to infer governorate from city code
        const found = findCityByCode(config.selectedCity);
        if (found) {
          governorateSelect.value = String(found.governorateIndex);
          updateCities();
          citySelect.value = config.selectedCity;
        }
      }
    }

    return {
      countrySelect,
      governorateSelect,
      citySelect,
      refresh: () => {
        populateSelect(countrySelect, getCountries({ lang }), { placeholder: p.country });
        updateGovernorates();
      },
      setValues: (selectedCountry, selectedGovernorate, selectedCity) => {
        if (selectedCountry) {
          countrySelect.value = selectedCountry;
          updateGovernorates();
          if (selectedGovernorate !== undefined && selectedGovernorate !== '') {
            governorateSelect.value = String(selectedGovernorate);
            updateCities();
            if (selectedCity) citySelect.value = selectedCity;
          } else if (selectedCity) {
            const found = findCityByCode(selectedCity);
            if (found) {
              governorateSelect.value = String(found.governorateIndex);
              updateCities();
              citySelect.value = selectedCity;
            }
          }
        }
      }
    };
  }

  function bindCountryOnly(config) {
    const selectId = config.selectId || config.countryId || 'country';
    const lang = getLang(config);
    const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
    if (!select) {
      console.warn('BondsGeo.bindCountryOnly: select not found', selectId);
      return null;
    }
    const placeholder = config.placeholder || (lang === 'en' ? 'Select country' : 'اختر الدولة');
    populateSelect(select, getCountries({ lang }), { placeholder: placeholder, selected: config.selectedCountry });
    return { select, refresh: () => populateSelect(select, getCountries({ lang }), { placeholder: placeholder }) };
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
    document.querySelectorAll('[data-bonds-geo-bind="country"]').forEach(function(select) {
      const lang = select.dataset.bondsGeoLang || getLang();
      bindCountryOnly({ selectId: select, lang: lang });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      autoInit();
    }
  }
})();
