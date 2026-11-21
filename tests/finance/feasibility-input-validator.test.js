'use strict';

const { validateFeasibilityInputs } = require('../../lib/finance/feasibility-input-validator');

describe('governed feasibility input validation', () => {
  test('accepts realistic small, large and mega initial investment amounts', () => {
    for (const [project_size, investment_amount] of [
      ['small', 50000], ['large', 50000000], ['mega', 5000000000]
    ]) {
      const result = validateFeasibilityInputs({
        project_size, investment_amount, currency: 'SAR',
        years: 3, discount_rate: 0.1,
        cash_flows: [10000, -20000, 30000]
      });
      expect(result.valid).toBe(true);
    }
  });

  test('rejects nonnumeric, blank and nonfinite annual cashflow entries', () => {
    for (const cash_flows of [[100, null], [''], [100, 'not-a-number'], [Infinity]]) {
      const result = validateFeasibilityInputs({ cash_flows, discount_rate: 0.1 });
      expect(result.valid).toBe(false);
      expect(result.invalid_fields).toContain('cash_flows');
    }
  });

  test('rejects a missing discount rate whenever annual cashflows are provided', () => {
    const result = validateFeasibilityInputs({ cash_flows: [10, 20] });
    expect(result.valid).toBe(false);
    expect(result.invalid_fields).toContain('discount_rate_required_for_cash_flows');
  });

  test('rejects unsupported sizes, currencies, negative investments and invalid horizons', () => {
    const result = validateFeasibilityInputs({
      project_size: 'supermega', currency: 'invalid',
      investment_amount: -1, years: 61,
      cash_flows: [100, 200], discount_rate: 5
    });
    expect(result.valid).toBe(false);
    for (const key of ['project_size', 'currency', 'investment_amount', 'years', 'discount_rate', 'cash_flows_years_mismatch']) {
      expect(result.invalid_fields).toContain(key);
    }
  });

  test('retains backwards-compatible optional fields when not supplied', () => {
    expect(validateFeasibilityInputs({ project_name: 'Existing project' }).valid).toBe(true);
    expect(validateFeasibilityInputs({ initial_investment: '1000000' }).valid).toBe(true);
  });

  test('governed API runs validation before executing and saving results', () => {
    const fs=require('fs'), path=require('path');
    const api=fs.readFileSync(path.join(__dirname,'../../v3/api/services.js'),'utf8');
    const preflight=api.indexOf("validateFeasibilityInputs(inputs || {})");
    const execute=api.indexOf('await executeService({ req, user, supabase, serviceCode, body })');
    expect(preflight).toBeGreaterThan(0);
    expect(execute).toBeGreaterThan(preflight);
    expect(api).toContain('FEASIBILITY_INPUT_VALIDATION_FAILED');
  });
});
