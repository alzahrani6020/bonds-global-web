/**
 * @jest-environment node
 */

const {
  run,
  createDefaultRegistry,
  normalizeEvidence,
  aggregateConfidence
} = require('../../lib/enterprise-intelligence/runner');

describe('EnterpriseIntelligenceRunner', () => {
  test('runs meta engines without UCP', async () => {
    const result = await run({
      intent: 'unknown',
      engines: ['recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
      sector: 'restaurant',
      country: 'SA',
      language: 'ar',
      skipFabric: true
    });

    expect(result.engines.recommendation).toBeDefined();
    expect(result.engines.blind_spot).toBeDefined();
    expect(result.engines.decision_graph).toBeDefined();
    expect(result.engines.recommendation_synthesizer).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(result.blindSpots).toBeDefined();
    expect(result.decisionGraph).toBeDefined();
    expect(result.trace.engines).toEqual(['recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer']);
  });

  test('aggregates confidence using registry weights', () => {
    const registry = createDefaultRegistry();
    const results = {
      valuation: { confidence: 80 },
      risk: { confidence: 70 },
      market: { confidence: 60 }
    };
    const confidence = aggregateConfidence(results, registry);
    expect(confidence).toBeGreaterThan(60);
    expect(confidence).toBeLessThanOrEqual(80);
  });

  test('normalizes evidence to canonical schema', () => {
    const raw = [
      { source: 'x', value: 10, confidence: 80, reason: 'because' }
    ];
    const normalized = normalizeEvidence('demo', raw);
    expect(normalized[0].engine).toBe('demo');
    expect(normalized[0].evidence_type).toBe('engine_output');
    expect(normalized[0].confidence).toBe(80);
    expect(normalized[0].timestamp).toBeDefined();
  });

  test('blind spot engine detects missing intent', async () => {
    const result = await run({
      engines: ['blind_spot'],
      engineResults: {},
      skipFabric: true
    });
    const spots = result.engines.blind_spot.output.blindSpots;
    expect(spots.some(s => s.type === 'missing_intent')).toBe(true);
  });

  test('decision graph returns critical path', async () => {
    const result = await run({
      intent: 'feasibility',
      engines: ['decision_graph'],
      skipFabric: true
    });
    const graph = result.engines.decision_graph.output;
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.criticalPath).toContain('start');
    expect(graph.bottleneck).toBeDefined();
  });
});
