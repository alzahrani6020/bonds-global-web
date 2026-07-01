const { validate, assertValid, isEmail, isUuid, isPhone, isPriceId, isCountryCode } = require('../../lib/validation');

describe('Server-side Validation', () => {
  it('validates required email', () => {
    const result = validate({ email: 'test@example.com' }, { email: { required: true, email: true } });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = validate({ email: 'not-an-email' }, { email: { required: true, email: true } });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('email');
  });

  it('validates UUID', () => {
    const result = validate({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }, { id: { required: true, uuid: true } });
    expect(result.valid).toBe(true);
  });

  it('validates Saudi phone', () => {
    expect(isPhone('0501234567')).toBe(true);
    expect(isPhone('123456')).toBe(false);
  });

  it('validates priceId', () => {
    expect(isPriceId('price_123')).toBe(true);
    expect(isPriceId('prod_123')).toBe(false);
  });

  it('validates country code', () => {
    expect(isCountryCode('SA')).toBe(true);
    expect(isCountryCode('sa')).toBe(false);
  });

  it('throws assertValid on failure', () => {
    expect(() => assertValid({ age: -1 }, { age: { required: true, min: 0 } })).toThrow();
  });

  it('validates range', () => {
    const result = validate({ score: 85 }, { score: { required: true, type: 'number', min: 0, max: 100 } });
    expect(result.valid).toBe(true);
  });
});
