/**
 * BONDS Formatting Utilities
 *
 * Unified number, currency, and percent formatting for Arabic and English.
 * Supports both Node (require) and browser (global BondsFormatting).
 */
(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    global.BondsFormatting = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const CURRENCY_SYMBOLS = {
    SAR: 'ر.س',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
    EGP: 'ج.م',
    JOD: 'د.أ',
    KWD: 'د.ك',
    BHD: 'د.ب',
    QAR: 'ر.ق',
    OMR: 'ر.ع',
    MAD: 'د.م.',
    TND: 'د.ت',
    DZD: 'د.ج',
    LBP: 'ل.ل',
    IQD: 'د.ع',
    YER: 'ر.ي',
    SDG: 'ج.س',
    LYD: 'د.ل',
    SYR: 'ل.س',
    DJF: 'ف.ج',
    KMF: 'ف.ك',
    MRU: 'أ.م',
    PS: '₪',
    SO: 'S',
  };

  function normalizeLang(lang) {
    return (lang || 'ar').toString().toLowerCase().startsWith('en') ? 'en' : 'ar';
  }

  function getCurrencySymbol(currency) {
    const code = (currency || 'SAR').toUpperCase();
    return CURRENCY_SYMBOLS[code] || code;
  }

  function formatNumber(value, lang, options) {
    if (value === null || value === undefined) return String(value);
    const opts = options || {};
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);

    const decimals = typeof opts.decimals === 'number' ? opts.decimals : 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';

    // Use Latin digits with Western grouping for financial readability in both languages.
    const formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return sign + formatted;
  }

  function formatCurrency(value, currency, lang) {
    const l = normalizeLang(lang);
    const symbol = getCurrencySymbol(currency);
    const num = formatNumber(value, l, { decimals: 2 });

    if (l === 'ar') {
      return `${num} ${symbol}`;
    }
    // English: single-character symbols attach directly ($1,000); multi-character symbols use a space.
    const spacer = symbol.length > 1 ? ' ' : '';
    return `${symbol}${spacer}${num}`;
  }

  function formatPercent(value, lang) {
    const l = normalizeLang(lang);
    const num = formatNumber(value, l, { decimals: 1 });
    return `${num}%`;
  }

  return {
    formatNumber,
    formatCurrency,
    formatPercent,
    getCurrencySymbol,
    normalizeLang,
  };
}));
