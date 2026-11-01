const { buildCacRoas } = require('../../lib/analytics/cac-roas');

describe('CAC / ROAS adapter', () => {
  test('stays partial and unknown without governed acquisition spend evidence', () => {
    const result = buildCacRoas({
      opportunities: [{ source: 'google' }],
      invoices: []
    });

    expect(result.status).toBe('partial');
    expect(result.dataState).toBe('unknown');
    expect(result.cac).toBeNull();
    expect(result.roas).toBeNull();
    expect(result.missingEvidence).toContain('governed_acquisition_spend');
    expect(result.semantics).toBe('governed_spend_and_attributed_revenue_not_pipeline_value');
  });

  test('computes CAC and ROAS through the existing unit-economics engine only with explicit period and currency', () => {
    const result = buildCacRoas({
      governedAcquisitionInput: {
        acquisition_spend: 10000,
        new_customers: 50,
        attributed_revenue: 40000,
        period_basis: 'monthly',
        currency: 'SAR'
      }
    });

    expect(result.dataState).toBe('available');
    expect(result.cac).toBe(200);
    expect(result.roas).toBe(4);
    expect(result.attributedRevenue).toBe(40000);
    expect(result.currency).toBe('SAR');
    expect(result.periodBasis).toBe('monthly');
    expect(result.engine).toBe('unit_economics');
  });

  test('does not treat CRM pipeline value as attributed revenue', () => {
    const result = buildCacRoas({
      opportunities: [{ source: 'google', value_amount: 999999 }],
      governedAcquisitionInput: {
        acquisition_spend: 10000,
        new_customers: 50,
        period_basis: 'monthly',
        currency: 'SAR'
      }
    });

    expect(result.dataState).toBe('unknown');
    expect(result.roas).toBeNull();
    expect(result.attributedRevenue).toBeNull();
  });

  test('fails honest when currency or period basis is absent', () => {
    const result = buildCacRoas({
      governedAcquisitionInput: {
        acquisition_spend: 10000,
        new_customers: 50,
        attributed_revenue: 40000
      }
    });

    expect(result.dataState).toBe('unknown');
    expect(result.cac).toBeNull();
    expect(result.roas).toBeNull();
  });
});
