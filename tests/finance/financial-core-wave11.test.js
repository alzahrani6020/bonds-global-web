const { runFinancialEngine } = require('../../lib/finance/financial-engine-registry');

describe('Financial core wave 11', () => {
  test('requires exactly 13 explicit periods for the 13-week cash forecast', () => {
    const result = runFinancialEngine('cash_flow_analysis', {
      opening_balance: 1000,
      periods: Array.from({ length: 12 }, (_, i) => ({
        period: `W${i + 1}`,
        inflows: { collections: 100 },
        outflows: { operating: 120 }
      }))
    }, { serviceCode: 'thirteen_week_cash_forecast' });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('periods_exactly_13_weeks');
  });

  test('computes threshold-aware runway from explicit forecast burn', () => {
    const periods = Array.from({ length: 13 }, (_, i) => ({
      period: `W${i + 1}`,
      inflows: { collections: 80 },
      outflows: { payroll: 100, other: 20 }
    }));
    const result = runFinancialEngine('cash_flow_analysis', {
      opening_balance: 1000,
      minimum_cash_threshold: 200,
      periods
    }, { serviceCode: 'cash_runway_analysis' });

    expect(result.ok).toBe(true);
    expect(result.metrics.average_net_burn).toBe(40);
    expect(result.metrics.available_opening_cash_above_threshold).toBe(800);
    expect(result.metrics.cash_runway_periods).toBe(20);
    expect(result.diagnostics.runway_method)
      .toBe('opening_cash_above_threshold_divided_by_average_net_burn');
  });

  test('builds an equal-principal debt schedule deterministically', () => {
    const result = runFinancialEngine('debt_schedule', {
      facilities: [{
        id: 'F1',
        principal: 1200,
        annual_rate_pct: 12,
        term_periods: 12,
        periods_per_year: 12,
        amortization_method: 'equal_principal'
      }]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.facility_count).toBe(1);
    expect(result.metrics.total_principal).toBe(1200);
    expect(result.metrics.combined_schedule).toHaveLength(12);
    expect(result.metrics.combined_schedule[0].principal_payment).toBe(100);
    expect(result.metrics.combined_schedule[0].interest_payment).toBe(12);
    expect(result.metrics.combined_schedule[11].closing_principal).toBe(0);
  });

  test('supports bullet debt without inventing intermediate principal repayments', () => {
    const result = runFinancialEngine('debt_schedule', {
      facilities: [{
        principal: 1000,
        annual_rate_pct: 12,
        term_periods: 4,
        periods_per_year: 4,
        amortization_method: 'bullet'
      }]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.combined_schedule.slice(0, 3)
      .every(row => row.principal_payment === 0)).toBe(true);
    expect(result.metrics.combined_schedule[3].principal_payment).toBe(1000);
  });

  test('measures portfolio debt maturity concentration from scheduled principal due', () => {
    const result = runFinancialEngine('debt_schedule', {
      facilities: [
        {
          id: 'F1',
          principal: 600,
          annual_rate_pct: 10,
          term_periods: 4,
          periods_per_year: 4,
          amortization_method: 'bullet'
        },
        {
          id: 'F2',
          principal: 300,
          annual_rate_pct: 8,
          term_periods: 4,
          periods_per_year: 4,
          amortization_method: 'bullet'
        },
        {
          id: 'F3',
          principal: 100,
          annual_rate_pct: 6,
          term_periods: 2,
          periods_per_year: 4,
          amortization_method: 'bullet'
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.total_principal).toBe(1000);
    expect(result.metrics.peak_principal_due).toBe(900);
    expect(result.metrics.peak_principal_due_period).toBe(4);
    expect(result.metrics.peak_principal_due_concentration_pct).toBe(90);
    expect(result.metrics.principal_due_period_count).toBe(2);
    expect(result.metrics.principal_due_profile).toEqual([
      { period: 2, principal_due: 100, share_of_total_principal_pct: 10 },
      { period: 4, principal_due: 900, share_of_total_principal_pct: 90 }
    ]);
    expect(result.diagnostics.maturity_concentration_method)
      .toBe('scheduled_principal_due_share_of_total_principal');
  });

  test('stresses interest only on floating-rate debt when a basis-point shock is requested', () => {
    const result = runFinancialEngine('debt_schedule', {
      interest_rate_shock_bps: 200,
      facilities: [
        {
          id: 'FLOAT',
          principal: 1000,
          annual_rate_pct: 8,
          rate_type: 'floating',
          term_periods: 4,
          periods_per_year: 4,
          amortization_method: 'bullet'
        },
        {
          id: 'FIXED',
          principal: 1000,
          annual_rate_pct: 8,
          rate_type: 'fixed',
          term_periods: 4,
          periods_per_year: 4,
          amortization_method: 'bullet'
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.interest_rate_sensitivity).toMatchObject({
      shock_bps: 200,
      floating_rate_principal: 1000,
      fixed_rate_principal: 1000,
      floating_rate_principal_pct: 50,
      baseline_interest: 160,
      stressed_interest: 180,
      incremental_interest: 20,
      incremental_debt_service: 20
    });
    expect(result.metrics.facilities[0].stressed_annual_rate_pct).toBe(10);
    expect(result.metrics.facilities[1].stressed_annual_rate_pct).toBe(8);
    expect(result.diagnostics.interest_rate_sensitivity_method)
      .toBe('static_existing_principal_schedule_floating_rate_shock');
  });

  test('fails closed when interest-rate sensitivity is requested without facility rate types', () => {
    const result = runFinancialEngine('debt_schedule', {
      interest_rate_shock_bps: 150,
      facilities: [{
        principal: 1000,
        annual_rate_pct: 8,
        term_periods: 4,
        periods_per_year: 4,
        amortization_method: 'bullet'
      }]
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs)
      .toContain('facilities[0].rate_type_fixed_or_floating');
  });

  test('measures refinancing coverage and first uncovered maturity within an explicit horizon', () => {
    const result = runFinancialEngine('debt_schedule', {
      refinancing_horizon_periods: 4,
      available_refinancing_capacity: 500,
      available_liquidity_for_refinancing: 100,
      facilities: [
        {
          id: 'F1',
          principal: 100,
          annual_rate_pct: 6,
          term_periods: 2,
          periods_per_year: 4,
          amortization_method: 'bullet'
        },
        {
          id: 'F2',
          principal: 900,
          annual_rate_pct: 8,
          term_periods: 4,
          periods_per_year: 4,
          amortization_method: 'bullet'
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.refinancing_risk).toMatchObject({
      horizon_periods: 4,
      principal_due_within_horizon: 1000,
      available_refinancing_capacity: 500,
      available_liquidity_for_refinancing: 100,
      total_refinancing_resources: 600,
      refinancing_coverage_ratio: 0.6,
      refinancing_gap: 400,
      surplus_resources: 0,
      first_uncovered_maturity_period: 4,
      status: 'shortfall'
    });
    expect(result.metrics.refinancing_risk.principal_due_profile).toEqual([
      { period: 2, principal_due: 100 },
      { period: 4, principal_due: 900 }
    ]);
    expect(result.diagnostics.refinancing_risk_method)
      .toBe('cumulative_scheduled_principal_due_vs_explicit_resources');
  });

  test('fails closed when refinancing analysis is requested without explicit resources', () => {
    const result = runFinancialEngine('debt_schedule', {
      refinancing_horizon_periods: 4,
      facilities: [{
        principal: 1000,
        annual_rate_pct: 8,
        term_periods: 4,
        periods_per_year: 4,
        amortization_method: 'bullet'
      }]
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs)
      .toContain('available_refinancing_capacity_or_liquidity');
  });

  test('evaluates covenant headroom and forecast breach periods', () => {
    const result = runFinancialEngine('covenant_monitoring', {
      covenants: [
        { id: 'DSCR', metric: 'dscr', operator: '>=', threshold: 1.25 },
        { id: 'LEV', metric: 'debt_to_ebitda', operator: '<=', threshold: 3.5 }
      ],
      actuals: { dscr: 1.4, debt_to_ebitda: 3.0 },
      forecasts: [
        { period: 'Q1', metrics: { dscr: 1.3, debt_to_ebitda: 3.2 } },
        { period: 'Q2', metrics: { dscr: 1.1, debt_to_ebitda: 3.7 } }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.overall_status).toBe('compliant');
    expect(result.metrics.forecast_breach_count).toBe(2);
    expect(result.metrics.covenants[0].headroom).toBeCloseTo(0.15, 8);
    expect(result.metrics.covenants[0].first_forecast_breach_period).toBe('Q2');
    expect(result.metrics.covenants[1].first_forecast_breach_period).toBe('Q2');
  });

  test('derives actual and forecast DSCR from explicit cash flow or EBITDA and debt service', () => {
    const result = runFinancialEngine('covenant_monitoring', {
      derive_dscr: true,
      covenants: [
        { id: 'DSCR', metric: 'dscr', operator: '>=', threshold: 1.25 }
      ],
      actuals: {
        operating_cash_flow: 140,
        debt_service: 100
      },
      forecasts: [
        {
          period: 'Q1',
          metrics: { ebitda: 130, debt_service: 100 }
        },
        {
          period: 'Q2',
          metrics: { operating_cash_flow: 110, debt_service: 100 }
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.covenants[0].actual).toBeCloseTo(1.4, 8);
    expect(result.metrics.covenants[0].actual_source)
      .toBe('derived_operating_cash_flow_over_debt_service');
    expect(result.metrics.covenants[0].first_forecast_breach_period).toBe('Q2');
    expect(result.metrics.covenants[0].forecast_evaluations).toEqual([
      {
        period: 'Q1',
        value: 1.3,
        source: 'derived_ebitda_over_debt_service',
        headroom: 0.050000000000000044,
        status: 'compliant'
      },
      {
        period: 'Q2',
        value: 1.1,
        source: 'derived_operating_cash_flow_over_debt_service',
        headroom: -0.1499999999999999,
        status: 'breach'
      }
    ]);
    expect(result.diagnostics.derived_dscr_method)
      .toBe('operating_cash_flow_or_ebitda_over_positive_debt_service');
  });

  test('fails closed when derived DSCR is requested without positive debt service', () => {
    const result = runFinancialEngine('covenant_monitoring', {
      derive_dscr: true,
      covenants: [
        { id: 'DSCR', metric: 'dscr', operator: '>=', threshold: 1.25 }
      ],
      actuals: { operating_cash_flow: 140 },
      forecasts: [
        { period: 'Q1', metrics: { operating_cash_flow: 130, debt_service: 100 } }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs).toContain('actuals.debt_service_positive');
  });

  test('covenant engine fails closed on malformed covenant definitions', () => {
    const result = runFinancialEngine('covenant_monitoring', {
      covenants: [{ metric: 'dscr', operator: 'approximately', threshold: 1.25 }],
      actuals: { dscr: 1.4 }
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs).toContain('covenants[0].operator_supported');
  });
});
