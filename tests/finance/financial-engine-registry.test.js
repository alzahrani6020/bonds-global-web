const {
  runFinancialEngine,
  listFinancialEngines
} = require('../../lib/finance/financial-engine-registry');

const generated = require('../../lib/capabilities/generated-service-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');

describe('BONDS deterministic financial engine registry', () => {
  test('registers the governed deterministic financial engines', () => {
    expect(listFinancialEngines().map(x => x.code)).toEqual([
      'financial_analysis',
      'cash_flow_analysis',
      'funding_readiness',
      'creditworthiness',
      'feasibility',
      'valuation',
      'risk_analysis',
      'scenario_forecast',
      'debt_schedule',
      'covenant_monitoring',
      'credit_risk',
      'treasury_liquidity',
      'profitability_intelligence',
      'unit_economics',
      'management_reporting',
      'consolidation',
      'fx_translation',
      'planning_budgeting'
    ]);
  });

  test('computes core financial analysis ratios deterministically', () => {
    const result = runFinancialEngine('financial_analysis', {
      revenue: 1000,
      cogs: 400,
      operating_expenses: 300,
      net_income: 180,
      current_assets: 500,
      current_liabilities: 250,
      cash: 100,
      inventory: 100,
      total_assets: 1200,
      total_liabilities: 500,
      total_debt: 350,
      interest_expense: 50
    });

    expect(result.ok).toBe(true);
    expect(result.provenance.deterministic).toBe(true);
    expect(result.provenance.ai_generated).toBe(false);
    expect(result.metrics.gross_profit).toBe(600);
    expect(result.metrics.ebitda).toBe(300);
    expect(result.metrics.current_ratio).toBe(2);
    expect(result.metrics.quick_ratio).toBe(1.6);
    expect(result.metrics.interest_coverage).toBe(6);
    expect(result.metrics.working_capital).toBe(250);
    expect(result.metrics.asset_turnover).toBeCloseTo(1000 / 1200, 8);
    expect(result.metrics.net_debt).toBe(250);
    expect(result.metrics.net_debt_to_ebitda).toBeCloseTo(250 / 300, 8);
  });


  test('uses service-scoped input requirements for exact financial metrics', () => {
    const workingCapital = runFinancialEngine('financial_analysis', {
      current_assets: 500,
      current_liabilities: 250
    }, { serviceCode: 'working_capital_analysis' });
    expect(workingCapital.ok).toBe(true);
    expect(workingCapital.metrics.working_capital).toBe(250);
    expect(workingCapital.required_inputs).toEqual([]);

    const grossMargin = runFinancialEngine('financial_analysis', {
      revenue: 1000,
      cogs: 400
    }, { serviceCode: 'gross_margin_analysis' });
    expect(grossMargin.ok).toBe(true);
    expect(grossMargin.metrics.gross_margin_pct).toBe(60);

    const netDebt = runFinancialEngine('financial_analysis', {
      total_debt: 350,
      cash: 100
    }, { serviceCode: 'net_debt_analysis' });
    expect(netDebt.ok).toBe(true);
    expect(netDebt.metrics.net_debt).toBe(250);
  });

  test('fails closed on missing metric-specific inputs instead of inventing values', () => {
    const grossMargin = runFinancialEngine('financial_analysis', {
      revenue: 1000
    }, { serviceCode: 'gross_margin_analysis' });
    expect(grossMargin.ok).toBe(false);
    expect(grossMargin.executed).toBe(false);
    expect(grossMargin.metrics.gross_margin_pct).toBeNull();
    expect(grossMargin.required_inputs).toContain('cogs');

    const netDebt = runFinancialEngine('financial_analysis', {
      total_debt: 350
    }, { serviceCode: 'net_debt_analysis' });
    expect(netDebt.ok).toBe(false);
    expect(netDebt.metrics.net_debt).toBeNull();
    expect(netDebt.required_inputs).toContain('cash');
  });

  test('rejects zero denominators for ratio-scoped services', () => {
    const assetTurnover = runFinancialEngine('financial_analysis', {
      revenue: 1000,
      total_assets: 0
    }, { serviceCode: 'asset_turnover_analysis' });
    expect(assetTurnover.ok).toBe(false);
    expect(assetTurnover.required_inputs).toContain('non_zero_total_assets');

    const debtToEquity = runFinancialEngine('financial_analysis', {
      total_debt: 500,
      equity: 0
    }, { serviceCode: 'debt_to_equity_analysis' });
    expect(debtToEquity.ok).toBe(false);
    expect(debtToEquity.required_inputs).toContain('non_zero_equity');
  });


  test('computes batch 5 exact financial metrics with scoped inputs', () => {
    const cases = [
      {
        serviceCode: 'ebitda_analysis',
        input: { ebitda: 300 },
        metric: 'ebitda',
        expected: 300
      },
      {
        serviceCode: 'operating_margin_analysis',
        input: { revenue: 1000, operating_income: 220 },
        metric: 'operating_margin_pct',
        expected: 22
      },
      {
        serviceCode: 'inventory_turnover_analysis',
        input: { cogs: 400, inventory: 100 },
        metric: 'inventory_turnover',
        expected: 4
      },
      {
        serviceCode: 'receivables_turnover_analysis',
        input: { revenue: 1000, receivables: 200 },
        metric: 'receivables_turnover',
        expected: 5
      },
      {
        serviceCode: 'cost_of_debt_analysis',
        input: { total_debt: 500, interest_expense: 50 },
        metric: 'cost_of_debt_pct',
        expected: 10
      },
      {
        serviceCode: 'revenue_growth_analysis',
        input: { revenue: 1200, prior_revenue: 1000 },
        metric: 'revenue_growth_pct',
        expected: 20
      },
      {
        serviceCode: 'earnings_growth_analysis',
        input: { net_income: 180, prior_net_income: 150 },
        metric: 'earnings_growth_pct',
        expected: 20
      },
      {
        serviceCode: 'wacc_analysis',
        input: {
          total_debt: 400,
          equity: 600,
          cost_of_equity_pct: 12,
          cost_of_debt_pct: 6,
          tax_rate_pct: 20
        },
        metric: 'wacc_pct',
        expected: 9.12
      }
    ];

    for (const item of cases) {
      const result = runFinancialEngine(
        'financial_analysis',
        item.input,
        { serviceCode: item.serviceCode }
      );
      expect(result.ok).toBe(true);
      expect(result.executed).toBe(true);
      expect(result.metrics[item.metric]).toBeCloseTo(item.expected, 8);
      expect(result.diagnostics.service_scope).toBe(item.serviceCode);
    }
  });

  test('batch 5 metrics fail closed on missing or invalid critical inputs', () => {
    const growth = runFinancialEngine('financial_analysis', {
      prior_revenue: 1000
    }, { serviceCode: 'revenue_growth_analysis' });
    expect(growth.ok).toBe(false);
    expect(growth.metrics.revenue_growth_pct).toBeNull();
    expect(growth.required_inputs).toContain('revenue');

    const wacc = runFinancialEngine('financial_analysis', {
      total_debt: 400,
      equity: 600,
      cost_of_equity_pct: 12,
      cost_of_debt_pct: 6,
      tax_rate_pct: 120
    }, { serviceCode: 'wacc_analysis' });
    expect(wacc.ok).toBe(false);
    expect(wacc.metrics.wacc_pct).toBeNull();
    expect(wacc.required_inputs).toContain('tax_rate_pct_0_to_100');
  });

  test('computes cash-flow trajectory and liquidity stress', () => {
    const result = runFinancialEngine('cash_flow_analysis', {
      opening_balance: 100,
      periods: [
        { period: 1, inflows: { sales: 200 }, outflows: { rent: 100, salaries: 50 } },
        { period: 2, inflows: { sales: 50 }, outflows: { rent: 100, salaries: 100 } }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.total_inflows).toBe(250);
    expect(result.metrics.total_outflows).toBe(350);
    expect(result.metrics.closing_balance).toBe(0);
    expect(result.metrics.periods).toHaveLength(2);
  });

  test('computes funding readiness and creditworthiness from debt capacity inputs', () => {
    const input = {
      ebitda: 300,
      operating_cash_flow: 280,
      annual_debt_service: 140,
      current_assets: 500,
      current_liabilities: 250,
      total_debt: 300,
      equity: 600,
      requested_amount: 500,
      revenue: 1000,
      net_income: 150
    };

    const readiness = runFinancialEngine('funding_readiness', input);
    const credit = runFinancialEngine('creditworthiness', input);

    expect(readiness.ok).toBe(true);
    expect(readiness.metrics.dscr).toBe(2);
    expect(readiness.metrics.readiness_score).toBeGreaterThan(0);
    expect(credit.ok).toBe(true);
    expect(credit.metrics.credit_score).toBeGreaterThan(0);
    expect(['A','B','C','D','E']).toContain(credit.metrics.rating_band);
  });


  test('computes debt service capacity headroom from an explicit minimum DSCR', () => {
    const result = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      minimum_dscr: 1.5
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.debt_service_capacity).toEqual({
      minimum_dscr: 1.5,
      cash_flow_basis: 300,
      current_annual_debt_service: 150,
      maximum_annual_debt_service: 200,
      annual_debt_service_headroom: 50,
      annual_debt_service_excess: 0,
      status: 'capacity_available'
    });
    expect(result.diagnostics.debt_service_capacity_method)
      .toBe('cash_flow_basis_divided_by_minimum_dscr_less_current_debt_service');
  });

  test('reports debt service capacity excess and fails closed on invalid minimum DSCR', () => {
    const exceeded = runFinancialEngine('funding_readiness', {
      ebitda: 180,
      annual_debt_service: 150,
      minimum_dscr: 1.5
    });

    expect(exceeded.ok).toBe(true);
    expect(exceeded.metrics.debt_service_capacity.maximum_annual_debt_service).toBe(120);
    expect(exceeded.metrics.debt_service_capacity.annual_debt_service_headroom).toBe(0);
    expect(exceeded.metrics.debt_service_capacity.annual_debt_service_excess).toBe(30);
    expect(exceeded.metrics.debt_service_capacity.status).toBe('capacity_exceeded');

    const invalid = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      minimum_dscr: 0
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.executed).toBe(false);
    expect(invalid.required_inputs).toContain('minimum_dscr_positive');
  });


  test('sizes maximum additional debt from explicit DSCR headroom and loan terms', () => {
    const result = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      minimum_dscr: 1.5,
      borrowing_annual_rate_pct: 12,
      borrowing_term_years: 5,
      borrowing_payments_per_year: 12,
      requested_amount: 175
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.loan_sizing.annual_debt_service_headroom).toBe(50);
    expect(result.metrics.loan_sizing.periodic_payment_capacity).toBeCloseTo(50 / 12, 8);
    expect(result.metrics.loan_sizing.maximum_additional_debt).toBeCloseTo(187.31266, 5);
    expect(result.metrics.loan_sizing.requested_amount_headroom).toBeCloseTo(12.31266, 5);
    expect(result.metrics.loan_sizing.requested_amount_status).toBe('within_capacity');
    expect(result.diagnostics.loan_sizing_method)
      .toBe('level_payment_annuity_from_annual_debt_service_headroom');
  });

  test('flags requested borrowing above capacity and supports zero-rate sizing', () => {
    const exceeded = runFinancialEngine('funding_readiness', {
      ebitda: 300,
      annual_debt_service: 150,
      minimum_dscr: 1.5,
      borrowing_annual_rate_pct: 12,
      borrowing_term_years: 5,
      borrowing_payments_per_year: 12,
      requested_amount: 250
    });

    expect(exceeded.ok).toBe(true);
    expect(exceeded.metrics.loan_sizing.requested_amount_status).toBe('exceeds_capacity');
    expect(exceeded.metrics.loan_sizing.requested_amount_headroom).toBeLessThan(0);

    const zeroRate = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      minimum_dscr: 1.5,
      borrowing_annual_rate_pct: 0,
      borrowing_term_years: 4,
      borrowing_payments_per_year: 4
    });

    expect(zeroRate.ok).toBe(true);
    expect(zeroRate.metrics.loan_sizing.maximum_additional_debt).toBe(200);
  });

  test('fails closed when loan sizing terms are incomplete or invalid', () => {
    const result = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      minimum_dscr: 1.5,
      borrowing_annual_rate_pct: 10,
      borrowing_term_years: 5
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs)
      .toContain('borrowing_payments_per_year_positive_integer');
  });


  test('computes collateral capacity from explicit collateral value and maximum LTV', () => {
    const result = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      collateral_value: 1000,
      maximum_ltv_pct: 60,
      existing_secured_debt: 350
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.collateral_capacity).toEqual({
      collateral_value: 1000,
      maximum_ltv_pct: 60,
      existing_secured_debt: 350,
      maximum_secured_debt: 600,
      collateral_headroom: 250,
      collateral_excess: 0,
      current_ltv_pct: 35,
      status: 'collateral_capacity_available'
    });
    expect(result.diagnostics.collateral_capacity_method)
      .toBe('collateral_value_times_maximum_ltv_less_existing_secured_debt');
  });

  test('uses the lower of debt-service and collateral limits as borrowing capacity', () => {
    const result = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      minimum_dscr: 1.5,
      borrowing_annual_rate_pct: 12,
      borrowing_term_years: 5,
      borrowing_payments_per_year: 12,
      collateral_value: 300,
      maximum_ltv_pct: 60,
      existing_secured_debt: 40,
      requested_amount: 150
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.loan_sizing.maximum_additional_debt).toBeCloseTo(187.31266, 5);
    expect(result.metrics.collateral_capacity.collateral_headroom).toBe(140);
    expect(result.metrics.borrowing_capacity.maximum_additional_debt).toBe(140);
    expect(result.metrics.borrowing_capacity.binding_constraint).toBe('collateral');
    expect(result.metrics.borrowing_capacity.requested_amount_status).toBe('exceeds_capacity');
    expect(result.metrics.borrowing_capacity.requested_amount_headroom).toBe(-10);
    expect(result.diagnostics.borrowing_capacity_method)
      .toBe('minimum_of_debt_service_limit_and_collateral_headroom');
  });

  test('reports collateral excess and fails closed on invalid collateral inputs', () => {
    const exceeded = runFinancialEngine('funding_readiness', {
      ebitda: 300,
      annual_debt_service: 150,
      collateral_value: 500,
      maximum_ltv_pct: 50,
      existing_secured_debt: 300
    });

    expect(exceeded.ok).toBe(true);
    expect(exceeded.metrics.collateral_capacity.maximum_secured_debt).toBe(250);
    expect(exceeded.metrics.collateral_capacity.collateral_headroom).toBe(0);
    expect(exceeded.metrics.collateral_capacity.collateral_excess).toBe(50);
    expect(exceeded.metrics.collateral_capacity.status).toBe('collateral_capacity_exceeded');

    const invalid = runFinancialEngine('funding_readiness', {
      operating_cash_flow: 300,
      annual_debt_service: 150,
      collateral_value: 1000,
      maximum_ltv_pct: 120,
      existing_secured_debt: 0
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.executed).toBe(false);
    expect(invalid.required_inputs)
      .toContain('maximum_ltv_pct_between_0_and_100');
  });


  test('computes net leverage capacity from debt, cash, EBITDA and an explicit leverage limit', () => {
    const result = runFinancialEngine('funding_readiness', {
      ebitda: 200,
      annual_debt_service: 80,
      total_debt: 500,
      cash_and_equivalents: 100,
      maximum_net_leverage: 3
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.leverage_capacity).toEqual({
      total_debt: 500,
      cash_and_equivalents: 100,
      net_debt: 400,
      ebitda: 200,
      net_debt_to_ebitda: 2,
      maximum_net_leverage: 3,
      maximum_net_debt: 600,
      maximum_total_debt: 700,
      leverage_headroom: 200,
      leverage_excess: 0,
      status: 'leverage_capacity_available'
    });
    expect(result.diagnostics.leverage_capacity_method)
      .toBe('maximum_net_leverage_times_ebitda_plus_cash_less_total_debt');
  });

  test('uses net leverage as the binding borrowing constraint when it is lowest', () => {
    const result = runFinancialEngine('funding_readiness', {
      ebitda: 200,
      operating_cash_flow: 300,
      annual_debt_service: 100,
      minimum_dscr: 1.5,
      borrowing_annual_rate_pct: 10,
      borrowing_term_years: 5,
      borrowing_payments_per_year: 12,
      collateral_value: 1000,
      maximum_ltv_pct: 70,
      existing_secured_debt: 100,
      total_debt: 500,
      cash_and_equivalents: 100,
      maximum_net_leverage: 2.25,
      requested_amount: 75
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.leverage_capacity.leverage_headroom).toBe(50);
    expect(result.metrics.borrowing_capacity.net_leverage_limit).toBe(50);
    expect(result.metrics.borrowing_capacity.maximum_additional_debt).toBe(50);
    expect(result.metrics.borrowing_capacity.binding_constraint).toBe('net_leverage');
    expect(result.metrics.borrowing_capacity.requested_amount_status).toBe('exceeds_capacity');
    expect(result.metrics.borrowing_capacity.requested_amount_headroom).toBe(-25);
    expect(result.diagnostics.borrowing_capacity_method)
      .toBe('minimum_of_available_debt_service_collateral_and_net_leverage_limits');
  });

  test('reports leverage excess and fails closed on invalid leverage capacity inputs', () => {
    const exceeded = runFinancialEngine('funding_readiness', {
      ebitda: 100,
      annual_debt_service: 50,
      total_debt: 500,
      cash_and_equivalents: 50,
      maximum_net_leverage: 3
    });

    expect(exceeded.ok).toBe(true);
    expect(exceeded.metrics.leverage_capacity.net_debt).toBe(450);
    expect(exceeded.metrics.leverage_capacity.net_debt_to_ebitda).toBe(4.5);
    expect(exceeded.metrics.leverage_capacity.leverage_headroom).toBe(0);
    expect(exceeded.metrics.leverage_capacity.leverage_excess).toBe(150);
    expect(exceeded.metrics.leverage_capacity.status).toBe('leverage_capacity_exceeded');

    const invalid = runFinancialEngine('funding_readiness', {
      annual_debt_service: 50,
      total_debt: 500,
      cash_and_equivalents: 50,
      maximum_net_leverage: 3
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.executed).toBe(false);
    expect(invalid.required_inputs).toContain('ebitda_positive_for_net_leverage');
  });

  test('computes feasibility NPV, IRR and payback without AI', () => {
    const result = runFinancialEngine('feasibility', {
      initial_investment: 1000,
      cash_flows: [300, 350, 400, 450],
      discount_rate: 0.10
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.npv).toBeGreaterThan(0);
    expect(result.metrics.irr).toBeGreaterThan(0.10);
    expect(result.metrics.payback_periods).toBeGreaterThan(2);
    expect(result.metrics.payback_periods).toBeLessThan(4);
  });

  test('computes deterministic DCF valuation', () => {
    const result = runFinancialEngine('valuation', {
      free_cash_flows: [100, 110, 120, 130, 140],
      discount_rate: 0.12,
      terminal_growth_rate: 0.03,
      net_debt: 200
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.enterprise_value).toBeGreaterThan(0);
    expect(result.metrics.equity_value).toBe(
      result.metrics.enterprise_value - 200
    );
  });

  test('computes financial risk factors', () => {
    const result = runFinancialEngine('risk_analysis', {
      current_assets: 400,
      current_liabilities: 300,
      total_debt: 500,
      equity: 400,
      operating_cash_flow: 180,
      annual_debt_service: 160,
      customer_concentration_pct: 45,
      cash_buffer_months: 2
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.risk_score).toBeGreaterThanOrEqual(0);
    expect(result.metrics.risk_score).toBeLessThanOrEqual(100);
    expect(result.metrics.factors.length).toBeGreaterThanOrEqual(4);
  });

  test('runs deterministic forecast and simulation engine together', () => {
    const result = runFinancialEngine('scenario_forecast', {
      revenue: 1000,
      costs: 700,
      growth_rate: 0.05,
      cost_growth_rate: 0.03,
      years: 3,
      initial_investment: 900,
      annual_net_cash_flow: 250,
      discount_rate: 0.10,
      simulation_config: { iterations: 200, seed: 42 }
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.forecast).toHaveLength(3);
    expect(result.metrics.simulation).toBeTruthy();
    expect(result.metrics.simulation.iterations).toBe(200);
  });

  test('returns explicit insufficient-input state instead of inventing results', () => {
    const result = runFinancialEngine('valuation', {});
    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.status).toBe('insufficient_inputs');
    expect(result.required_inputs).toContain('free_cash_flows');
    expect(result.required_inputs).toContain('discount_rate');
  });

  test('capabilities are compiled and have governed runtime adapters', () => {
    const actions = [
      'financial_analysis_run',
      'cash_flow_analysis_run',
      'funding_readiness_run',
      'creditworthiness_run',
      'feasibility_run',
      'valuation_run',
      'risk_analysis_run',
      'scenario_forecast_run',
      'debt_schedule_run',
      'covenant_monitoring_run',
      'credit_risk_run',
      'treasury_liquidity_run',
      'profitability_intelligence_run',
      'unit_economics_run',
      'management_reporting_run',
      'consolidation_run',
      'planning_budgeting_run'
    ];

    for (const action of actions) {
      const capability = generated.capabilities[action];
      expect(capability).toBeTruthy();
      expect(capability.serviceCode).toBe('financial-engine');
      expect(capability.sideEffect).toBe('compute');
      expect(capability.active).toBe(true);
      expect(getRuntimeAdapter(capability.runtime.adapter)).toEqual(expect.any(Function));
    }
  });
});
