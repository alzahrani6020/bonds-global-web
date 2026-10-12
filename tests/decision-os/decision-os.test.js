/**
 * @jest-environment node
 */

const {
  LiveMarketIntelligenceEngine,
  SimulationEngine,
  SectorDigitalTwinRegistry,
  DecisionRecommendationEngine,
  EvidenceGraphEngine,
  DecisionMemoryEngine,
  CalibrationEngine,
  EventMonitorEngine
} = require('../../lib/decision-os');

describe('Decision Operating System', () => {
  test('live market engine distinguishes fresh observed evidence from estimates', () => {
    const engine = new LiveMarketIntelligenceEngine({ maxLiveAgeDays: 90 });
    const now = new Date().toISOString();
    const result = engine.analyze({
      country: 'SA',
      city: 'Riyadh',
      liveDataRecords: [
        {
          code: 'inflation_rate',
          value: 2.1,
          source: 'GASTAT official',
          sourceType: 'OFFICIAL_OBSERVED',
          observedAt: now,
          confidence: 95
        },
        {
          code: 'avg_rent_per_sqm',
          value: 1200,
          source: 'country benchmark',
          sourceType: 'BENCHMARK',
          observedAt: now,
          confidence: 80,
          isEstimated: true
        }
      ]
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe('live');
    expect(result.output.liveMetricCount).toBe(1);
    expect(result.output.metricMap.inflation_rate.sourceType).toBe('OFFICIAL_OBSERVED');
    expect(result.output.metricMap.avg_rent_per_sqm.isEstimated).toBe(true);
  });

  test('live market engine does not claim execution without evidence', () => {
    const result = new LiveMarketIntelligenceEngine().analyze({});
    expect(result.executed).toBe(false);
    expect(result.status).toBe('insufficient_inputs');
    expect(result.warnings).toContain('no_market_evidence');
  });

  test('simulation engine produces reproducible probability outputs with a fixed seed', () => {
    const engine = new SimulationEngine();
    const input = {
      values: {
        initial_investment: 1_000_000,
        annual_revenue: 900_000,
        net_profit: 250_000,
        total_debt_service: 150_000
      },
      ucpResult: { confidence: 0.8 },
      simulationConfig: {
        iterations: 1000,
        seed: 42,
        years: 5,
        discountRate: 0.10,
        revenueVolatility: 0.15,
        costVolatility: 0.10
      }
    };

    const a = engine.run(input);
    const b = engine.run(input);

    expect(a.executed).toBe(true);
    expect(a.output.method).toBe('monte_carlo');
    expect(a.output.iterations).toBe(1000);
    expect(a.output.expectedNpv).toBeCloseTo(b.output.expectedNpv, 10);
    expect(a.output.probabilityPositiveNpv).toBeGreaterThanOrEqual(0);
    expect(a.output.probabilityPositiveNpv).toBeLessThanOrEqual(1);
    expect(a.output.percentiles.npv.p05).toBeLessThanOrEqual(a.output.percentiles.npv.p50);
    expect(a.output.percentiles.npv.p50).toBeLessThanOrEqual(a.output.percentiles.npv.p95);
  });

  test('simulation engine blocks decision-grade output when required inputs are absent', () => {
    const result = new SimulationEngine().run({ values: {} });
    expect(result.executed).toBe(false);
    expect(result.status).toBe('insufficient_inputs');
    expect(result.decisionEligible).toBe(false);
  });

  test('sector digital twin preserves generic capability while exposing sector-specific drivers', () => {
    const registry = new SectorDigitalTwinRegistry();

    const restaurant = registry.evaluate('restaurant', {
      revenue: 1_000_000,
      rent: 120_000,
      labor_cost: 250_000,
      seats: 80,
      table_turns: 2.5,
      average_ticket: 65
    });
    expect(restaurant.output.twin).toBe('restaurant');
    expect(restaurant.output.derived.theoreticalDailyRevenue).toBe(13000);
    expect(restaurant.decisionEligible).toBe(true);

    const unknown = registry.evaluate('new_sector', {
      revenue: 1_000_000,
      operating_expenses: 600_000
    });
    expect(unknown.output.twin).toBe('generic');
    expect(unknown.output.genericFallback).toBe(true);
    expect(unknown.executed).toBe(true);
  });

  test('decision engine cannot override a blocked integrity gate', () => {
    const result = new DecisionRecommendationEngine().decide({
      confidence: 90,
      decisionIntegrity: { status: 'blocked' },
      simulation: { output: { probabilityPositiveNpv: 0.95, expectedNpv: 5_000_000 } },
      engineResults: {
        feasibility: { npv: 5_000_000, irr: 0.30 },
        financing: { dscr: 2.0 },
        risk: { risk_grade: 'A' }
      }
    });

    expect(result.output.primary).toBe('WAIT');
    expect(result.output.decisionStatus).toBe('blocked');
    expect(result.output.risks).toContain('decision_integrity_blocked');
  });

  test('decision engine can recommend invest when probability, finance, risk and integrity support it', () => {
    const result = new DecisionRecommendationEngine().decide({
      confidence: 85,
      decisionIntegrity: { status: 'decision_ready' },
      simulation: { output: { probabilityPositiveNpv: 0.82, expectedNpv: 2_000_000 } },
      engineResults: {
        feasibility: { npv: 2_000_000, irr: 0.24 },
        financing: { dscr: 1.6 },
        risk: { risk_grade: 'B' },
        live_market: { confidence: 80 }
      }
    });

    expect(result.output.primary).toBe('INVEST');
    expect(result.output.decisionStatus).toBe('decision_ready');
    expect(result.output.alternatives).toContain('WAIT');
  });

  test('evidence graph links evidence to engines and engines to the decision', () => {
    const result = new EvidenceGraphEngine().build({
      decision: { primary: 'INVEST' },
      engineResults: {
        feasibility: {
          confidence: 80,
          status: 'computed',
          evidence: [{
            source: 'ucp',
            evidence_code: 'npv',
            value: 100,
            confidence: 80
          }]
        }
      }
    });

    expect(result.executed).toBe(true);
    expect(result.output.nodes.some(node => node.id === 'decision')).toBe(true);
    expect(result.output.edges.some(edge => edge.to === 'decision')).toBe(true);
    expect(result.output.orphanEvidence).toHaveLength(0);
  });

  test('decision memory compares expected and actual outcomes without inventing missing metrics', () => {
    const engine = new DecisionMemoryEngine();
    const comparison = engine.compareOutcome(
      { expectedOutcome: { revenue: 100, irr: 20, missing_metric: null } },
      { revenue: 90, irr: 18, other_metric: 5 }
    );

    expect(comparison.metrics.revenue.absoluteError).toBe(-10);
    expect(comparison.metrics.irr.percentageError).toBeCloseTo(-0.1);
    expect(comparison.metrics.missing_metric).toBeUndefined();
    expect(comparison.metrics.other_metric).toBeUndefined();
    expect(comparison.calibrated).toBe(true);
  });

  test('calibration engine computes bias and error from observed outcomes without mutating models', () => {
    const engine = new CalibrationEngine();
    const summary = engine.summarizeComparisons([
      { metrics: { revenue: { expected: 100, actual: 90 } } },
      { metrics: { revenue: { expected: 100, actual: 110 } } }
    ]);

    expect(summary.metrics.revenue.observations).toBe(2);
    expect(summary.metrics.revenue.signedBias).toBeCloseTo(0, 10);
    expect(summary.metrics.revenue.meanAbsolutePercentageError).toBeCloseTo(0.1, 10);
    expect(summary.calibratedMetrics).toBe(1);
  });

  test('event monitor stays side-effect free unless explicitly requested', async () => {
    const engine = new EventMonitorEngine({ supabase: {} });
    const result = await engine.evaluate({});
    expect(result.executed).toBe(false);
    expect(result.status).toBe('available_not_requested');
    expect(result.output.alerts).toEqual([]);
  });

});
