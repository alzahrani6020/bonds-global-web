const {
  runFinancialEngine,
  listFinancialEngines
} = require('../../lib/finance/financial-engine-registry');

const generated = require('../../lib/capabilities/generated-service-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');

describe('BONDS deterministic financial engine registry', () => {
  test('registers the eight initial financial engines', () => {
    expect(listFinancialEngines().map(x => x.code)).toEqual([
      'financial_analysis',
      'cash_flow_analysis',
      'funding_readiness',
      'creditworthiness',
      'feasibility',
      'valuation',
      'risk_analysis',
      'scenario_forecast'
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
      'scenario_forecast_run'
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
