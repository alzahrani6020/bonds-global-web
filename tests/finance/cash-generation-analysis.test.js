const {
  ENGINE_VERSION,
  runFinancialEngine
} = require('../../lib/finance/financial-engine-registry');

const {
  getRuntimeAdapter
} = require('../../lib/capabilities/runtime-adapters');

describe('Batch 6A-2 cash generation analysis', () => {
  const input = {
    opening_balance: 100,
    periods: [
      { period: 'P1', inflows: 300, outflows: 200 },
      { period: 'P2', inflows: 250, outflows: 300 },
      { period: 'P3', inflows: 400, outflows: 250 },
      { period: 'P4', inflows: 200, outflows: 200 }
    ]
  };

  test('uses financial engine contract version 1.6.0', () => {
    expect(ENGINE_VERSION).toBe('1.6.0');
  });

  test('computes deterministic cash generation metrics', () => {
    const result = runFinancialEngine(
      'cash_flow_analysis',
      input,
      { serviceCode: 'cash_generation_analysis' }
    );

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.diagnostics.service_scope).toBe('cash_generation_analysis');
    expect(result.diagnostics.cash_generation_method)
      .toBe('period_net_cash_generation');

    expect(result.metrics.total_cash_generated).toBe(250);
    expect(result.metrics.total_cash_consumed).toBe(50);
    expect(result.metrics.net_cash_generated).toBe(200);
    expect(result.metrics.average_net_cash_generation).toBe(50);
    expect(result.metrics.positive_cash_generation_period_count).toBe(2);
    expect(result.metrics.negative_cash_generation_period_count).toBe(1);
    expect(result.metrics.zero_cash_generation_period_count).toBe(1);
    expect(result.metrics.positive_cash_generation_period_ratio).toBe(0.5);
    expect(result.metrics.longest_positive_cash_generation_run).toBe(1);
    expect(result.metrics.cash_generation_coverage_ratio).toBe(5);
    expect(result.metrics.closing_balance).toBe(300);

    expect(result.metrics.periods.map(row => row.cash_generated))
      .toEqual([100, 0, 150, 0]);
    expect(result.metrics.periods.map(row => row.cash_consumed))
      .toEqual([0, 50, 0, 0]);
  });

  test('runtime adapter preserves service scope', async () => {
    const adapter = getRuntimeAdapter('cash_flow_analysis_engine');

    const result = await adapter({
      service_code: 'cash_generation_analysis',
      inputs: input
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics.service_scope).toBe('cash_generation_analysis');
    expect(result.metrics.total_cash_generated).toBe(250);
  });

  test('fails closed when opening balance is missing', () => {
    const result = runFinancialEngine(
      'cash_flow_analysis',
      {
        periods: [
          { period: 'P1', inflows: 100, outflows: 80 }
        ]
      },
      { serviceCode: 'cash_generation_analysis' }
    );

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.metrics).toEqual({});
    expect(result.required_inputs).toContain('opening_balance');
  });

  test('fails closed on non-numeric inputs', () => {
    const result = runFinancialEngine(
      'cash_flow_analysis',
      {
        opening_balance: 100,
        periods: [
          { period: 'P1', inflows: 'abc', outflows: 80 }
        ]
      },
      { serviceCode: 'cash_generation_analysis' }
    );

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.metrics).toEqual({});
    expect(result.required_inputs)
      .toContain('periods[0].inflows_numeric');
  });
});
