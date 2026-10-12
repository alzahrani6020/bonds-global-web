/**
 * @jest-environment node
 */

const { adapt, loadValuationEngine } = require('../../lib/enterprise-intelligence/engine-adapter');

describe('EnterpriseIntelligenceAdapters', () => {
  test('valuation adapter falls back to provided market value', async () => {
    const result = await adapt('valuation', { market_value: 1_000_000, currency: 'SAR' });
    expect(result.engine).toBe('valuation');
    expect(result.output.value).toBe(1_000_000);
    expect(result.status).toBe('ok');
  });

  test('risk adapter with asset class and answers', async () => {
    const result = await adapt('risk', {
      asset_class: 'realEstate',
      riskAnswers: { physical_condition: 2, market_liquidity: 3 },
      riskExternalData: {}
    });
    expect(result.engine).toBe('risk');
    expect(result.output.riskGrade).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('recommendation adapter returns actions', async () => {
    const result = await adapt('recommendation', {
      sector: 'restaurant',
      country: 'SA',
      intent: 'feasibility',
      language: 'ar'
    });
    expect(result.engine).toBe('recommendation');
    expect(Array.isArray(result.output.recommendations)).toBe(true);
  });

  test('blind spot adapter analyzes engine results', async () => {
    const result = await adapt('blind_spot', {
      intent: 'feasibility',
      engineResults: {
        valuation: { confidence: 80, output: { value: 1000000 } },
        risk: { confidence: 30, output: { riskGrade: 'D' } }
      }
    });
    expect(result.engine).toBe('blind_spot');
    expect(Array.isArray(result.output.blindSpots)).toBe(true);
  });

  test('decision graph adapter builds graph', async () => {
    const result = await adapt('decision_graph', {
      intent: 'feasibility',
      engineResults: {
        valuation: { confidence: 80 },
        risk: { confidence: 70 }
      }
    });
    expect(result.engine).toBe('decision_graph');
    expect(result.output.nodes.length).toBeGreaterThan(0);
  });

  test('recommendation synthesizer merges actions', async () => {
    const result = await adapt('recommendation_synthesizer', {
      intent: 'feasibility',
      sector: 'restaurant',
      country: 'SA',
      language: 'ar',
      engineResults: {
        recommendation: {
          confidence: 70,
          output: { recommendations: [{ title: 'Reduce food cost', action: 'Check menu', confidence: 70, source: 'sector_benchmark' }] }
        },
        blind_spot: {
          confidence: 80,
          output: { blindSpots: [{ type: 'missing_input', severity: 'warning', message: 'x', action: 'y' }] }
        }
      }
    });
    expect(result.engine).toBe('recommendation_synthesizer');
    expect(Array.isArray(result.output.actions)).toBe(true);
  });

  test('loads valuation engine without polluting global scope', () => {
    const engine = loadValuationEngine();
    expect(engine).toBeDefined();
    expect(typeof engine).toBe('function');
    expect(typeof engine.prototype.calculate).toBe('function');
  });

  test('risk adapter does not invent a default risk grade without evidence', async () => {
    const result = await adapt('risk', {});
    expect(result.status).toBe('insufficient_inputs');
    expect(result.executed).toBe(false);
    expect(result.output).toBeNull();
  });

  test('market adapter does not invent demand index when UCP market engine did not execute', async () => {
    const result = await adapt('market', {
      ucpResult: {
        engineResults: {
          market: {
            status: 'insufficient_inputs',
            executed: false,
            reason: 'no_market_demand_output_from_ucp'
          }
        }
      }
    });
    expect(result.status).toBe('insufficient_inputs');
    expect(result.executed).toBe(false);
    expect(result.output?.demand_index).toBeUndefined();
  });

  test('live market adapter exposes source type freshness and live status', async () => {
    const result = await adapt('live_market', {
      country: 'SA',
      city: 'Riyadh',
      liveDataRecords: [{
        code: 'inflation_rate',
        value: 2.2,
        source: 'GASTAT official',
        sourceType: 'OFFICIAL_OBSERVED',
        observedAt: new Date().toISOString(),
        confidence: 95
      }]
    });
    expect(result.engine).toBe('live_market');
    expect(result.status).toBe('live');
    expect(result.output.liveMetricCount).toBe(1);
  });

  test('simulation adapter executes probabilistic analysis without replacing scenario engine', async () => {
    const result = await adapt('simulation', {
      values: {
        initial_investment: 1000000,
        annual_revenue: 800000,
        net_profit: 220000
      },
      ucpResult: { confidence: 0.8 },
      simulationConfig: { iterations: 500, seed: 7 }
    });
    expect(result.engine).toBe('simulation');
    expect(result.status).toBe('computed');
    expect(result.output.method).toBe('monte_carlo');
  });


  test('unavailable UCP valuation facade is not treated as executed valuation', async () => {
    const result = await adapt('valuation', {
      ucpResult: {
        engineResults: {
          valuation: { status: 'insufficient_inputs', executed: false, value: null, confidence: null }
        }
      }
    });
    expect(result.status).toBe('insufficient_inputs');
    expect(result.executed).toBe(false);
    expect(result.output).toBeNull();
  });

  test('unavailable UCP risk facade is not converted into a synthetic grade', async () => {
    const result = await adapt('risk', {
      ucpResult: {
        engineResults: {
          risk: { status: 'insufficient_inputs', executed: false, risk_grade: null, confidence: null }
        }
      }
    });
    expect(result.status).toBe('insufficient_inputs');
    expect(result.executed).toBe(false);
    expect(result.output).toBeNull();
  });


  test('decision graph preserves zero confidence for an unavailable engine', async () => {
    const result = await adapt('decision_graph', {
      intent: 'feasibility',
      engineResults: {
        feasibility: {
          confidence: 0,
          executed: false,
          status: 'insufficient_inputs'
        }
      }
    });
    const node = result.output.nodes.find(item => item.id === 'feasibility');
    expect(node.confidence).toBe(0);
    expect(node.executed).toBe(false);
  });

});
