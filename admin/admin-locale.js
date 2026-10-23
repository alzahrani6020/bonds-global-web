/**
 * Backward-compatible Admin locale shim.
 * Translation data and locale state live only in admin-i18n.js.
 */
(function (global) {
  'use strict';

  function ensureCentral() {
    if (global.BondsAdminI18n) return Promise.resolve(global.BondsAdminI18n);
    if (global.BondsAdminCommon?.ensureAdminI18n) return global.BondsAdminCommon.ensureAdminI18n();
    if (global.__BONDS_ADMIN_I18N_PROMISE__) return global.__BONDS_ADMIN_I18N_PROMISE__;

    global.__BONDS_ADMIN_I18N_PROMISE__ = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/admin/admin-i18n.js?v=2';
      script.dataset.bondsAdminI18n = 'true';
      script.onload = () => resolve(global.BondsAdminI18n);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return global.__BONDS_ADMIN_I18N_PROMISE__;
  }

  async function applyToDocument(doc) {
    const i18n = await ensureCentral();
    if (!i18n || !doc) return;
    doc.documentElement.lang = i18n.locale;
    doc.documentElement.dir = i18n.locale === 'ar' ? 'rtl' : 'ltr';
    i18n.bind(doc);
  }

  function translateText(text) {
    return global.BondsAdminI18n?.translateText
      ? global.BondsAdminI18n.translateText(text)
      : String(text ?? '');
  }

  global.BondsAdminLocale = {
    applyToDocument,
    translateText,
    ensureCentral
  };

  const start = () => applyToDocument(document).catch(() => {});
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window);
