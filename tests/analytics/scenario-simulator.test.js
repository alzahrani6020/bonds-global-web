const { validateAndRunScenario } = require('../../lib/analytics/scenario-simulator');

describe('Scenario Simulator adapter', () => {
  test('runs and normalizes an explicit forecast scenario', () => {
    const result = validateAndRunScenario({
      name: 'Base 2027',
      scenario_type: 'forecast',
      inputs: {
        annual_revenue: 1000000,
        annual_costs: 700000,
        growth_rate_pct: 5,
        cost_growth_rate_pct: 3,
        years: 3,
        initial_investment: 500000,
        annual_net_cash_flow: 180000,
        discount_rate_pct: 10
      },
      assumptions: {
        iterations: 1000,
        revenue_volatility_pct: 15,
        cost_volatility_pct: 10,
        shock_correlation: 0.35,
        seed: 12345
      }
    });

    expect(result.name).toBe('Base 2027');
    expect(result.scenario_type).toBe('forecast');
    expect(result.outputs.engine).toBe('scenario_forecast');
    expect(result.outputs.forecast).toHaveLength(3);
    expect(result.outputs.simulation).not.toBeNull();
    expect(result.outputs.simulation.method).toBe('monte_carlo');
    expect(result.inputs.growth_rate_pct).toBe(5);
    expect(result.assumptions.source).toBe('manual_explicit');
    expect(['low','medium','high']).toContain(result.confidence);
  });

  test('fails closed when no forecast or simulation inputs exist', () => {
    expect(() => validateAndRunScenario({
      name: 'Empty',
      scenario_type: 'what_if',
      inputs: {}
    })).toThrow(/scenario requires/);
  });

  test('fails closed when simulation inputs are incomplete and no forecast exists', () => {
    expect(() => validateAndRunScenario({
      name: 'Broken simulation',
      inputs: {
        initial_investment: 500000
      }
    })).toThrow(/scenario requires/);
  });

  test('rejects invalid scenario type and unsafe numeric ranges', () => {
    expect(() => validateAndRunScenario({
      name: 'Invalid',
      scenario_type: 'magic',
      inputs: { annual_revenue: 100 }
    })).toThrow(/invalid scenario_type/);

    expect(() => validateAndRunScenario({
      name: 'Invalid growth',
      inputs: {
        annual_revenue: 100,
        growth_rate_pct: 5000
      }
    })).toThrow(/growth_rate_pct out of range/);
  });

  test('forecast-only input remains valid but simulation is honestly unavailable', () => {
    const result = validateAndRunScenario({
      name: 'Forecast only',
      inputs: {
        annual_revenue: 100000,
        annual_costs: 80000,
        growth_rate_pct: 2,
        years: 2
      }
    });

    expect(result.outputs.forecast).toHaveLength(2);
    expect(result.outputs.simulation).toBeNull();
    expect(result.outputs.simulation_status).toBe('insufficient_inputs');
    expect(result.confidence).toBe('low');
  });
});
