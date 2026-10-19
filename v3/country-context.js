(function () {
  'use strict';

  const STORAGE_KEY = 'bonds_selected_country';
  let cachedCountries = null;

  function normalize(code) {
    return String(code || '').trim().toUpperCase();
  }

  function getStored(defaultCode = 'SA') {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY)) || defaultCode;
    } catch (_) {
      return defaultCode;
    }
  }

  function setSelected(code, detail = {}) {
    const normalized = normalize(code);
    if (!normalized) return null;
    try { localStorage.setItem(STORAGE_KEY, normalized); } catch (_) {}
    window.dispatchEvent(new CustomEvent('bonds:countrychange', {
      detail: { code: normalized, ...detail }
    }));
    return normalized;
  }

  async function loadCountries(force = false) {
    if (cachedCountries && !force) return cachedCountries;
    const res = await fetch('/api/v3/catalog/countries', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load country profiles');
    const data = await res.json();
    cachedCountries = data.countries || [];
    return cachedCountries;
  }

  async function getProfile(code) {
    const normalized = normalize(code);
    const countries = await loadCountries();
    return countries.find(c => c.code === normalized) || null;
  }

  async function bindSelect(select, options = {}) {
    if (typeof select === 'string') select = document.querySelector(select);
    if (!select) return null;

    const countries = options.countries || await loadCountries();
    const urlCountry = (() => {
      try { return normalize(new URLSearchParams(location.search).get('country')); } catch (_) { return ''; }
    })();
    const desired = urlCountry || getStored(options.defaultCountry || 'SA');
    const next = countries.some(c => c.code === desired)
      ? desired
      : (countries.some(c => c.code === options.defaultCountry) ? options.defaultCountry : countries[0]?.code);

    if (next) select.value = next;

    const persist = () => {
      const profile = countries.find(c => c.code === select.value) || null;
      setSelected(select.value, {
        currency_code: profile?.currency_code || null,
        currency_symbol: profile?.currency_symbol || null,
        locale_ar: profile?.locale_ar || null,
        locale_en: profile?.locale_en || null
      });
    };

    select.addEventListener('change', persist);
    if (next) persist();
    return countries.find(c => c.code === next) || null;
  }

  function formatCurrency(value, currencyCode, profile, lang = 'ar') {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    const locale = lang === 'en'
      ? (profile?.locale_en || 'en')
      : (profile?.locale_ar || 'ar');
    const currency = normalize(currencyCode);
    if (!currency) return num.toLocaleString(locale);
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      }).format(num);
    } catch (_) {
      return num.toLocaleString(locale) + ' ' + currency;
    }
  }

  function formatMoney(value, profile, lang = 'ar') {
    return formatCurrency(value, profile?.currency_code, profile, lang);
  }

  function formatProvenanceMoney(value, currencyCode, profile, lang = 'ar') {
    const formatted = formatCurrency(value, currencyCode, profile, lang);
    const sourceCurrency = normalize(currencyCode);
    const localCurrency = normalize(profile?.currency_code);
    if (!sourceCurrency || !localCurrency || sourceCurrency === localCurrency) return formatted;
    return formatted + (lang === 'en'
      ? ' · source currency ' + sourceCurrency + ', not local ' + localCurrency
      : ' · عملة المصدر ' + sourceCurrency + ' وليست العملة المحلية ' + localCurrency);
  }

  function formatActivityLabel(activity, lang = 'ar') {
    const label = activity?.name_ar || activity?.name_en || activity?.code || '-';
    const status = activity?.country?.availability_status;
    if (status === 'unknown') {
      return label + (lang === 'en' ? ' · Local status unverified' : ' · الحالة المحلية غير موثقة');
    }
    return label;
  }

  window.BondsCountryContext = {
    STORAGE_KEY,
    getSelected: getStored,
    setSelected,
    loadCountries,
    getProfile,
    bindSelect,
    formatCurrency,
    formatMoney,
    formatProvenanceMoney,
    formatActivityLabel
  };
})();