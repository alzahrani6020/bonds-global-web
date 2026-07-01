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
});
