const {
  runFinancialEngine
} = require('../../lib/finance/financial-engine-registry');

describe('Profitability intelligence and unit economics core', () => {
  test('computes dimensional profitability using explicit allocated cost', () => {
    const result = runFinancialEngine('profitability_intelligence', {
      cost_allocation_source: 'accounting_allocation_engine',
      units: [
        {
          id: 'P1',
          name: 'Product 1',
          scope_type: 'product',
          revenue: 1000,
          variable_cost: 400,
          direct_fixed_cost: 100,
          allocated_cost: 120
        },
        {
          id: 'P2',
          name: 'Product 2',
          scope_type: 'product',
          revenue: 500,
          variable_cost: 300,
          direct_fixed_cost: 80,
          allocated_cost: 70
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.total_revenue).toBe(1500);
    expect(result.metrics.total_allocated_cost).toBe(190);
    expect(result.metrics.total_contribution_margin).toBe(800);
    expect(result.metrics.total_operating_profit).toBe(430);
    expect(result.metrics.total_operating_margin_pct)
      .toBeCloseTo((430 / 1500) * 100, 8);
    expect(result.metrics.profitable_unit_count).toBe(2);
    expect(result.metrics.units[0].id).toBe('P1');
    expect(result.metrics.units[0].profitability_rank).toBe(1);
    expect(result.diagnostics.allocated_cost_supported).toBe(true);
  });

  test('supports customer, product, branch, project and governed accounting scopes', () => {
    const scopes = [
      'customer',
      'product',
      'branch',
      'project',
      'segment',
      'cost_center'
    ];

    const result = runFinancialEngine('profitability_intelligence', {
      units: scopes.map((scope, index) => ({
        id: `U${index + 1}`,
        scope_type: scope,
        revenue: 100,
        variable_cost: 40,
        direct_fixed_cost: 10,
        allocated_cost: 5
      }))
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.scope_types).toEqual([...scopes].sort());
    expect(result.metrics.unit_count).toBe(6);
  });

  test('profitability fails closed on unsupported scope or negative allocated cost', () => {
    const result = runFinancialEngine('profitability_intelligence', {
      units: [{
        id: 'X1',
        scope_type: 'warehouse',
        revenue: 100,
        allocated_cost: -5
      }]
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('units[0].scope_type_supported');
    expect(result.required_inputs).toContain('units[0].allocated_cost_non_negative');
  });

  test('computes CAC, LTV, LTV/CAC and CAC payback from explicit period data', () => {
    const result = runFinancialEngine('unit_economics', {
      period_basis: 'monthly',
      acquisition_spend: 12000,
      new_customers: 120,
      active_customers: 1000,
      revenue: 200000,
      gross_profit: 80000,
      churn_rate_pct: 4,
      units_sold: 5000,
      variable_cost: 90000
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.cac).toBe(100);
    expect(result.metrics.revenue_per_customer).toBe(200);
    expect(result.metrics.gross_profit_per_customer).toBe(80);
    expect(result.metrics.ltv).toBe(2000);
    expect(result.metrics.ltv_to_cac).toBe(20);
    expect(result.metrics.cac_payback_periods).toBe(1.25);
    expect(result.metrics.revenue_per_unit).toBe(40);
    expect(result.metrics.variable_cost_per_unit).toBe(18);
    expect(result.metrics.contribution_per_unit).toBe(22);
    expect(result.diagnostics.period_basis).toBe('monthly');
  });

  test('accepts governed explicit LTV without inventing churn', () => {
    const result = runFinancialEngine('unit_economics', {
      acquisition_spend: 10000,
      new_customers: 100,
      active_customers: 500,
      revenue: 100000,
      gross_profit: 40000,
      ltv: 1500
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.cac).toBe(100);
    expect(result.metrics.ltv).toBe(1500);
    expect(result.metrics.ltv_to_cac).toBe(15);
    expect(result.diagnostics.ltv_method).toBe('explicit_ltv');
  });

  test('supports LTV-only analysis without requiring CAC inputs', () => {
    const result = runFinancialEngine('unit_economics', {
      analysis_scope: 'ltv',
      period_basis: 'monthly',
      active_customers: 10,
      gross_profit: 4000,
      churn_rate_pct: 5
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.ltv).toBe(8000);
    expect(result.metrics.cac).toBeNull();
    expect(result.metrics.ltv_to_cac).toBeNull();
    expect(result.diagnostics.analysis_scope).toBe('ltv');
  });

  test('LTV-only analysis still fails closed without governed LTV evidence', () => {
    const result = runFinancialEngine('unit_economics', {
      analysis_scope: 'ltv',
      active_customers: 10,
      gross_profit: 4000
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('ltv_or_churn_rate_pct_gt_0_lte_100');
  });

  test('unit economics fails closed when LTV cannot be supported', () => {
    const result = runFinancialEngine('unit_economics', {
      acquisition_spend: 10000,
      new_customers: 100,
      active_customers: 500,
      revenue: 100000,
      gross_profit: 40000
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('ltv_or_churn_rate_pct_gt_0_lte_100');
  });
});
