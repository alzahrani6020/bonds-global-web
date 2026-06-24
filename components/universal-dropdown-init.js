/* UniversalDropdown Auto-Init — Bonds Global
 * Automatically enhances <select> elements marked with data-universal-dropdown.
 * Also exposes window.initUniversalDropdowns(container) for dynamic content.
 */

(function () {
  'use strict';

  if (typeof UniversalDropdown === 'undefined') {
    console.error('[UniversalDropdown] Core not loaded. Include universal-dropdown.js first.');
    return;
  }

  const registry = new WeakMap();

  function parseBool(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    return String(value).toLowerCase() === 'true';
  }

  function buildOptions(select) {
    const dataset = select.dataset;
    const direction = dataset.udDirection || (document.documentElement.getAttribute('dir') === 'ltr' ? 'ltr' : 'rtl');
    return {
      search: parseBool(dataset.udSearch, select.options.length > 10),
      searchPlaceholder: dataset.udSearchPlaceholder || (direction === 'ltr' ? 'Search...' : 'بحث...'),
      sort: parseBool(dataset.udSort, false),
      sortLocale: dataset.udSortLocale || (direction === 'ltr' ? 'en' : 'ar'),
      deduplicate: parseBool(dataset.udDeduplicate, false),
      removeEmpty: parseBool(dataset.udRemoveEmpty, false),
      emptyText: dataset.udEmptyText || (direction === 'ltr' ? 'No data available' : 'لا توجد بيانات متاحة'),
      loadingText: dataset.udLoadingText || (direction === 'ltr' ? 'Loading...' : 'جاري التحميل...'),
      placeholder: dataset.udPlaceholder || null,
      direction: direction,
      fixed: parseBool(dataset.udFixed, false),
      maxHeight: dataset.udMaxHeight || null,
      theme: dataset.udTheme || null,
      className: dataset.udClass || '',
      virtualize: parseBool(dataset.udVirtualize, false),
      virtualItemHeight: parseInt(dataset.udVirtualItemHeight || '36', 10),
      virtualThreshold: parseInt(dataset.udVirtualThreshold || '50', 10)
    };
  }

  function shouldUseNativeOnMobile(select) {
    const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) return false;
    const threshold = parseInt(select.dataset.udMobileThreshold || '6', 10);
    return select.options.length <= threshold;
  }

  function initOne(select) {
    if (registry.has(select) || select.closest('.ud-dropdown')) return null;
    if (shouldUseNativeOnMobile(select)) {
      // Keep native OS select on touch devices for short lists
      select.removeAttribute('data-universal-dropdown');
      return null;
    }
    try {
      const options = buildOptions(select);
      const dd = UniversalDropdown.fromSelect(select, options);
      registry.set(select, dd);
      return dd;
    } catch (err) {
      console.error('[UniversalDropdown] Failed to initialize', select, err);
      return null;
    }
  }

  function initUniversalDropdowns(root = document) {
    const selects = root.querySelectorAll ? root.querySelectorAll('select[data-universal-dropdown]') : [];
    const instances = [];
    selects.forEach(select => {
      const inst = initOne(select);
      if (inst) instances.push(inst);
    });
    return instances;
  }

  function destroyUniversalDropdowns(root = document) {
    root.querySelectorAll('select[data-universal-dropdown]').forEach(select => {
      const dd = registry.get(select);
      if (dd) {
        dd.destroy();
        registry.delete(select);
      }
    });
  }

  // Global API
  window.initUniversalDropdowns = initUniversalDropdowns;
  window.destroyUniversalDropdowns = destroyUniversalDropdowns;
  window.getUniversalDropdown = function (select) {
    return registry.get(select) || null;
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initUniversalDropdowns(document));
  } else {
    initUniversalDropdowns(document);
  }

  // Auto-init dynamically added selects
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches && node.matches('select[data-universal-dropdown]')) {
            initOne(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('select[data-universal-dropdown]').forEach(initOne);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
