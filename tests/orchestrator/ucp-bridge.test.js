const { createUcpRunner, mapValuesToUcpInputs, deriveEngineResults } = require('../../lib/orchestrator/ucp-bridge');

describe('UCP Bridge', () => {
  test('maps semantic values to UCP inputs', () => {
    const inputs = mapValuesToUcpInputs({
      annual_revenue: 1000000,
      net_profit: 200000,
      total_assets: 500000,
      total_liabilities: 100000
    }, 'company');
    expect(inputs.revenue).toBe(1000000);
    expect(inputs.asset_value).toBe(500000);
    expect(inputs.loan_amount).toBe(100000);
  });

  test('derives engine results from UCP output', () => {
    const ucpResult = {
      confidence: 0.85,
      outputs: {
        net_profit: { value: 200000 },
        asset_value: { value: 500000 },
        dscr: { value: 1.5 },
        ltv: { value: 60 },
        roi: { value: 20 },
        payback_period: { value: 3 }
      }
    };
    const engines = deriveEngineResults(ucpResult);
    expect(engines.valuation.value).toBe(500000);
    expect(engines.financing.dscr).toBe(1.5);
    expect(engines.risk.risk_grade).toBe('B');
  });

  test('flags high risk when DSCR is low', () => {
    const engines = deriveEngineResults({
      confidence: 0.6,
      outputs: { dscr: { value: 1.1 }, ltv: { value: 85 } }
    });
    expect(engines.risk.risk_grade).toBe('C');
  });

  test('runs UCP end-to-end for restaurant feasibility', async () => {
    const runner = createUcpRunner({});
    const result = await runner({
      sector: 'restaurant',
      country: 'SA',
      inputs: {
        monthly_revenue: 100000,
        food_cost_percentage: 35,
        labor_cost: 25000,
        rent: 15000
      },
      intent: 'feasibility'
    });
    expect(result.templateCode).toBeDefined();
    expect(result.outputs.net_profit.value).toBeGreaterThan(0);
    expect(result.engineResults.feasibility.confidence).toBeGreaterThan(0);
  });
});
