const {
  ENGINE_VERSION,
  runFinancialEngine
} = require('../../lib/finance/financial-engine-registry');

describe('Batch 6A liquidity gap analysis', () => {
  test('uses financial engine contract version 1.5.0', () => {
    expect(ENGINE_VERSION).toBe('1.5.0');
  });

  test('computes peak cumulative liquidity gap and recovery deterministically', () => {
    const result = runFinancialEngine('cash_flow_analysis', {
      opening_balance: 100,
      periods: [
        { period: 'M1', inflows: { sales: 50 }, outflows: { payroll: 200 } },
        { period: 'M2', inflows: { sales: 20 }, outflows: { payroll: 120 } },
        { period: 'M3', inflows: { sales: 250 }, outflows: { payroll: 50 } }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.minimum_balance).toBe(-150);
    expect(result.metrics.peak_liquidity_gap).toBe(150);
    expect(result.metrics.funding_required_to_maintain_non_negative_balance).toBe(150);
    expect(result.metrics.first_deficit_period).toBe('M1');
    expect(result.metrics.peak_gap_period).toBe('M2');
    expect(result.metrics.recovery_period).toBe('M3');
    expect(result.metrics.deficit_period_count).toBe(2);
    expect(result.metrics.unrecovered_at_horizon).toBe(false);
    expect(result.metrics.periods.map(row => row.liquidity_gap)).toEqual([50, 150, 0]);
  });

  test('fails closed when opening balance is missing', () => {
    const result = runFinancialEngine('cash_flow_analysis', {
      periods: [
        { period: 'M1', inflows: { sales: 100 }, outflows: { payroll: 80 } }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs).toContain('opening_balance');
    expect(result.metrics).toEqual({});
  });

  test('fails closed on non-numeric period cash inputs', () => {
    const result = runFinancialEngine('cash_flow_analysis', {
      opening_balance: 100,
      periods: [
        { period: 'M1', inflows: { sales: 'not-a-number' }, outflows: { payroll: 80 } }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs).toContain('periods[0].inflows_numeric');
    expect(result.metrics).toEqual({});
  });
});
