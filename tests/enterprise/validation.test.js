/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

// Load the IIFE script into a minimal DOM-less context
const code = fs.readFileSync(path.join(__dirname, '../../lib/enterprise/validation.js'), 'utf8');
const ctx = {};
const fn = new Function('window', code);
fn(ctx);
const V = ctx.BondsValidation;

describe('BondsValidation', () => {
  test('validates required fields', () => {
    const res = V.validate({ name: 'Bonds' }, { name: { required: true } });
    expect(res.valid).toBe(true);
  });

  test('detects missing required fields', () => {
    const res = V.validate({ name: '' }, { name: { required: true } });
    expect(res.valid).toBe(false);
    expect(res.errors[0].code).toBe('required');
  });

  test('validates email', () => {
    expect(V.isEmail('test@example.com')).toBe(true);
    expect(V.isEmail('not-an-email')).toBe(false);
  });

  test('validates UUID', () => {
    expect(V.isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(V.isUuid('bad')).toBe(false);
  });

  test('validates phone numbers', () => {
    expect(V.isPhone('0501234567')).toBe(true);
    expect(V.isPhone('+966501234567')).toBe(true);
    expect(V.isPhone('123')).toBe(false);
  });

  test('validates priceId', () => {
    expect(V.isPriceId('price_123')).toBe(true);
    expect(V.isPriceId('prod_123')).toBe(false);
  });

  test('validates country code', () => {
    expect(V.isCountryCode('SA')).toBe(true);
    expect(V.isCountryCode('sau')).toBe(false);
  });

  test('respects min/max length', () => {
    const res = V.validate({ code: 'AB' }, { code: { required: true, minLength: 3, maxLength: 5 } });
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.code === 'minLength')).toBe(true);
  });

  test('assertValid throws on invalid data', () => {
    expect(() => V.assertValid({ email: 'bad' }, { email: { email: true } })).toThrow();
  });
});
