const { runFinancialEngine } = require('../../lib/finance/financial-engine-registry');

describe('Treasury and liquidity core wave 14', () => {
  test('computes institutional cash position, liquidity headroom and funding gap', () => {
    const result = runFinancialEngine('treasury_liquidity', {
      currency: 'SAR',
      accounts: [
        {
          id: 'A1',
          bank: 'Bank A',
          balance: 700000,
          restricted_cash: 100000,
          minimum_operating_cash: 150000
        },
        {
          id: 'A2',
          bank: 'Bank B',
          balance: 300000,
          restricted_cash: 0,
          minimum_operating_cash: 50000
        }
      ],
      minimum_liquidity_buffer: 400000,
      expected_short_term_inflows: 250000,
      expected_short_term_outflows: 900000,
      available_short_term_facilities: 200000
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.gross_cash).toBe(1000000);
    expect(result.metrics.restricted_cash).toBe(100000);
    expect(result.metrics.available_cash).toBe(900000);
    expect(result.metrics.sweepable_cash).toBe(700000);
    expect(result.metrics.projected_cash_before_facilities).toBe(250000);
    expect(result.metrics.liquidity_headroom).toBe(-150000);
    expect(result.metrics.funding_gap).toBe(150000);
    expect(result.metrics.facility_coverage_of_gap).toBeCloseTo(4 / 3, 8);
    expect(result.metrics.post_facility_liquidity).toBe(450000);
    expect(result.metrics.investable_surplus).toBe(0);
  });

  test('builds a multi-period liquidity maturity ladder and identifies the first buffer breach', () => {
    const result = runFinancialEngine('treasury_liquidity', {
      currency: 'SAR',
      accounts: [
        { id: 'A1', bank: 'Bank A', balance: 500000, restricted_cash: 50000 }
      ],
      minimum_liquidity_buffer: 200000,
      liquidity_periods: [
        { period: 'W1', inflows: 100000, outflows: 150000 },
        { period: 'W2', inflows: 50000, outflows: 300000, facilities: 100000 },
        { period: 'W3', inflows: 250000, outflows: 50000 }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.liquidity_ladder).toHaveLength(3);
    expect(result.metrics.liquidity_ladder[0]).toEqual(expect.objectContaining({
      period: 'W1',
      opening_liquidity: 450000,
      projected_liquidity_before_facilities: 400000,
      funding_gap: 0
    }));
    expect(result.metrics.liquidity_ladder[1]).toEqual(expect.objectContaining({
      period: 'W2',
      projected_liquidity_before_facilities: 150000,
      funding_gap: 50000,
      facilities: 100000,
      projected_liquidity_after_facilities: 250000
    }));
    expect(result.metrics.first_buffer_breach_period).toBe('W2');
    expect(result.metrics.maximum_funding_gap).toBe(50000);
    expect(result.metrics.lowest_projected_liquidity).toBe(150000);
    expect(result.metrics.ending_projected_liquidity).toBe(450000);
    expect(result.provenance.method).toBe('cash_position_plus_maturity_ladder');
  });

  test('fails closed on invalid liquidity ladder flows', () => {
    const result = runFinancialEngine('treasury_liquidity', {
      accounts: [{ id: 'A1', balance: 1000 }],
      minimum_liquidity_buffer: 100,
      liquidity_periods: [
        { period: 'D1', inflows: -1, outflows: 10 },
        { period: 'D2', inflows: 10 }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('liquidity_periods[0].inflows_non_negative');
    expect(result.required_inputs)
      .toContain('liquidity_periods[1].outflows_non_negative');
  });

  test('computes bank concentration and forecast-versus-actual variance', () => {
    const result = runFinancialEngine('treasury_liquidity', {
      accounts: [
        { id: 'A1', bank: 'Bank A', balance: 800 },
        { id: 'A2', bank: 'Bank B', balance: 200 }
      ],
      minimum_liquidity_buffer: 100,
      forecast_cash_balance: 900,
      actual_cash_balance: 1000,
      treasury_limits: {
        max_bank_concentration_pct: 70
      }
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.largest_bank.bank).toBe('Bank A');
    expect(result.metrics.largest_bank.concentration_pct).toBe(80);
    expect(result.metrics.forecast_variance).toBe(100);
    expect(result.metrics.forecast_variance_pct).toBeCloseTo(100 / 9, 8);
    expect(result.metrics.limit_breach_count).toBe(1);
    expect(result.metrics.limits_status).toBe('breach');
  });

  test('fails closed on impossible restricted cash and missing liquidity buffer', () => {
    const result = runFinancialEngine('treasury_liquidity', {
      accounts: [
        { id: 'A1', balance: 100, restricted_cash: 150 }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs).toContain('accounts[0].restricted_cash_lte_balance');
    expect(result.required_inputs).toContain('minimum_liquidity_buffer_non_negative');
  });

  test('rejects invalid treasury concentration limits', () => {
    const result = runFinancialEngine('treasury_liquidity', {
      accounts: [{ id: 'A1', bank: 'Bank A', balance: 1000 }],
      minimum_liquidity_buffer: 100,
      treasury_limits: {
        max_bank_concentration_pct: 120
      }
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('treasury_limits.max_bank_concentration_pct_0_to_100');
  });
});
