const { ValidationRegistry } = require('../../lib/ucp/validation-registry');

describe('UCP Validation Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new ValidationRegistry({ preferStatic: true });
  });

  test('validates required field', () => {
    const result = registry.validate({}, ['val_required']);
    expect(result.valid).toBe(false);
    expect(result.errors.val_required).toBeDefined();
  });

  test('validates positive number', () => {
    const pass = registry.validate({ revenue: 100 }, ['val_revenue_positive']);
    expect(pass.valid).toBe(true);
    const fail = registry.validate({ revenue: -10 }, ['val_revenue_positive']);
    expect(fail.valid).toBe(false);
  });

  test('validates range', () => {
    const pass = registry.validate({ loan_term_months: 120 }, ['val_loan_term_months']);
    expect(pass.valid).toBe(true);
    const fail = registry.validate({ loan_term_months: 700 }, ['val_loan_term_months']);
    expect(fail.valid).toBe(false);
  });
});
