const { UniversalCalculationPlatform } = require('../../lib/ucp');

describe('Universal Calculation Platform', () => {
  let ucp;

  beforeEach(async () => {
    ucp = await UniversalCalculationPlatform.create({ preferStatic: true });
    ucp.options.persistRuns = false;
  });

  test('calculates restaurant scenario with expected output', async () => {
    const result = await ucp.calculate({
      sector: 'restaurant',
      inputs: {
        revenue: 100000,
        cogs: 35000,
        operating_expenses: 25000,
        fixed_costs: 20000,
        variable_cost_per_unit: 15,
        unit_price: 50,
        transaction_count: 2000,
        loan_amount: 100000,
        asset_value: 500000
      },
      scenarioCodes: ['scn_expected', 'scn_optimistic']
    });
    expect(result.outputs.net_profit.value).toBe(40000);
    expect(result.scenarios.length).toBe(2);
    expect(result.confidence).toBe(1);
  });

  test('returns validation errors for bad inputs', async () => {
    const result = await ucp.calculate({
      sector: 'restaurant',
      inputs: { revenue: -100, cogs: 0 }
    });
    expect(result.validation.valid).toBe(false);
  });

  test('throws for unknown sector', async () => {
    await expect(ucp.calculate({ sector: 'unknown_sector_xyz' })).rejects.toThrow('No UCP template found');
  });
});
