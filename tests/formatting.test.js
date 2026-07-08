/**
 * BONDS Formatting Utilities Tests
 */
const { formatNumber, formatCurrency, formatPercent, getCurrencySymbol } = require('../lib/formatting.js');

describe('BondsFormatting', () => {
  describe('formatNumber', () => {
    test('formats integers with grouping', () => {
      expect(formatNumber(1234567, 'ar')).toBe('1,234,567');
      expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    });

    test('formats decimals', () => {
      expect(formatNumber(1234.5, 'ar', { decimals: 2 })).toBe('1,234.50');
      expect(formatNumber(1234.5, 'en', { decimals: 2 })).toBe('1,234.50');
    });

    test('handles negative numbers', () => {
      expect(formatNumber(-50000, 'ar')).toBe('-50,000');
    });

    test('returns fallback for non-numbers', () => {
      expect(formatNumber(null, 'ar')).toBe('null');
      expect(formatNumber(undefined, 'ar')).toBe('undefined');
      expect(formatNumber('abc', 'ar')).toBe('abc');
    });
  });

  describe('formatCurrency', () => {
    test('Arabic: amount followed by symbol', () => {
      expect(formatCurrency(100000, 'SAR', 'ar')).toBe('100,000.00 ر.س');
    });

    test('English: symbol followed by amount', () => {
      expect(formatCurrency(100000, 'SAR', 'en')).toBe('ر.س 100,000.00');
    });

    test('falls back to currency code for unknown currencies', () => {
      expect(formatCurrency(1000, 'XYZ', 'ar')).toBe('1,000.00 XYZ');
    });
  });

  describe('formatPercent', () => {
    test('formats percent with one decimal', () => {
      expect(formatPercent(25.5, 'ar')).toBe('25.5%');
      expect(formatPercent(25.5, 'en')).toBe('25.5%');
    });
  });

  describe('getCurrencySymbol', () => {
    test('returns known symbols', () => {
      expect(getCurrencySymbol('SAR')).toBe('ر.س');
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    test('returns code for unknown currency', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    });
  });
});
