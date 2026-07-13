/**
 * Bonds Global — Shared Country Selector for Calculators
 *
 * Adds a professional country dropdown (names + flags) to calculator pages and
 * keeps currency labels in sync with the selected country.
 *
 * Usage:
 *   <select id="country" data-universal-dropdown="true" data-ud-search="true"></select>
 *   <script>
 *     BondsCountrySelector.init({ select: '#country', defaultCountry: 'SA' });
 *   </script>
 *
 * The module also auto-wraps static currency text (e.g. "ر.س", "SAR", "ريال")
 * in <span class="currency-label"> so it can be updated on the fly.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bonds_selected_country';
  const DEFAULT_COUNTRY = 'SA';

  const CURRENCY_PATTERNS = [
    { ar: 'ر.س', en: 'SAR' },
    { ar: 'ريال', en: 'SAR' }
  ];

  function getLang() {
    const html = document.documentElement;
    return html && html.lang && html.lang.startsWith('en') ? 'en' : 'ar';
  }

  function getDefaultCountry() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('country');
      if (fromUrl && window.BondsPlatforms && window.BondsPlatforms.getCountryMeta(fromUrl)) return fromUrl.toUpperCase();
    } catch (e) {}
    try {
      const fromStorage = localStorage.getItem(STORAGE_KEY);
      if (fromStorage && window.BondsPlatforms && window.BondsPlatforms.getCountryMeta(fromStorage)) return fromStorage.toUpperCase();
    } catch (e) {}
    return DEFAULT_COUNTRY;
  }

  function saveCountry(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
  }

  function getCurrencySymbol(code, lang) {
    if (window.BondsPlatforms && window.BondsPlatforms.getCurrencySymbol) {
      return window.BondsPlatforms.getCurrencySymbol(code, lang);
    }
    return lang === 'en' ? 'SAR' : 'ر.س';
  }

  function waitForDeps() {
    return new Promise((resolve) => {
      const baseReady = () => window.BondsGeo && window.BondsPlatforms;
      const dataReady = () => baseReady() && window.ARAB_COUNTRIES_GEO && Object.keys(window.ARAB_COUNTRIES_GEO).length > 0;
      if (dataReady()) return resolve();
      if (baseReady() && window.BondsGeo.ensureMasterData) {
        window.BondsGeo.ensureMasterData().then(() => resolve()).catch(() => resolve());
        return;
      }
      let attempts = 0;
      const timer = setInterval(() => {
        if (dataReady() || ++attempts > 100) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }

  function populateSelect(select) {
    if (!window.BondsGeo || !window.BondsGeo.getCountries) return;
    const lang = getLang();
    const countries = window.BondsGeo.getCountries({ lang });
    const currentValue = select.value;
    select.innerHTML = '';
    countries.forEach(c => {
      const option = document.createElement('option');
      option.value = c.value;
      option.textContent = c.label;
      if (c.icon) option.dataset.icon = c.icon;
      select.appendChild(option);
    });
    select.value = currentValue || getDefaultCountry();
  }

  function enhanceDropdown(select) {
    if (typeof window !== 'undefined' && window.UniversalDropdown && window.UniversalDropdown.fromSelect) {
      try {
        const lang = getLang();
        window.UniversalDropdown.fromSelect(select, {
          search: true,
          sort: true,
          sortLocale: lang,
          removeEmpty: true,
          direction: document.documentElement.getAttribute('dir') === 'ltr' ? 'ltr' : 'rtl',
          emptyText: lang === 'en' ? 'No data available' : 'لا توجد بيانات متاحة',
          noResultsText: lang === 'en' ? 'No matching results' : 'لا توجد نتائج مطابقة',
          searchPlaceholder: lang === 'en' ? 'Search countries...' : 'ابحث عن دولة...'
        });
      } catch (e) {
        console.warn('[BondsCountrySelector] failed to enhance dropdown', e);
      }
    }
  }

  /**
   * Auto-wrap static currency text in the given container with
   * <span class="currency-label"> so it can be updated on country change.
   */
  function wrapCurrencyLabels(container) {
    if (!container) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (/ر\.س|ريال|SAR/.test(node.nodeValue)) {
        const parent = node.parentElement;
        if (!parent) continue;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'OPTION') continue;
        if (parent.classList && parent.classList.contains('currency-label')) continue;
        if (parent.closest && parent.closest('.currency-label')) continue;
        if (parent.isContentEditable) continue;
        if (parent.closest('script, style')) continue;
        nodes.push(node);
      }
    }
    nodes.forEach(node => {
      const text = node.nodeValue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      const regex = /ر\.س|ريال|SAR/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement('span');
        span.className = 'currency-label';
        span.textContent = match[0];
        span.dataset.currencyBase = match[0];
        fragment.appendChild(span);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      node.parentNode.replaceChild(fragment, node);
    });
  }

  function updateCurrencyLabels(code) {
    const lang = getLang();
    const symbol = getCurrencySymbol(code, lang);
    document.querySelectorAll('.currency-label').forEach(el => {
      el.textContent = symbol;
    });
    window.dispatchEvent(new CustomEvent('bonds:countrychange', {
      detail: { code, symbol, lang }
    }));
  }

  function init(options = {}) {
    const select = typeof options.select === 'string'
      ? document.querySelector(options.select)
      : options.select;
    if (!select) {
      console.warn('[BondsCountrySelector] select element not found');
      return;
    }

    waitForDeps().then(() => {
      populateSelect(select);
      enhanceDropdown(select);

      const initialCode = select.value || getDefaultCountry();
      updateCurrencyLabels(initialCode);

      select.addEventListener('change', () => {
        const code = select.value;
        saveCountry(code);
        updateCurrencyLabels(code);
      });

      const container = options.container
        ? (typeof options.container === 'string' ? document.querySelector(options.container) : options.container)
        : document.querySelector('.investment-calculator') || document.body;
      wrapCurrencyLabels(container);
      updateCurrencyLabels(initialCode);
    });
  }

  window.BondsCountrySelector = {
    init,
    getSelected() {
      const sel = typeof window.BondsCountrySelector._select === 'string'
        ? document.querySelector(window.BondsCountrySelector._select)
        : null;
      return sel ? sel.value : getDefaultCountry();
    },
    getCurrencySymbol,
    getDefaultCountry,
    wrapCurrencyLabels,
    updateCurrencyLabels
  };
})();
