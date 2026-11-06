const {
  computeBusinessHealth,
  evaluateAlertRules,
  simulateScenario
} = require('../../lib/analytics/command-center-engine');

describe('command center engine', () => {
  test('business health is UNKNOWN when approved targets are absent', () => {
    expect(computeBusinessHealth({ monthly_revenue: 100 }, [])).toEqual(
      expect.objectContaining({ status: 'unknown', score: null, confidence: 'unknown' })
    );
  });

  test('business health computes only from measurable configured targets', () => {
    const result = computeBusinessHealth(
      { monthly_revenue: 120, conversion_rate: 4 },
      [
        { metric_key: 'monthly_revenue', target_value: 100, comparison: 'gte' },
        { metric_key: 'conversion_rate', target_value: 5, comparison: 'gte' },
        { metric_key: 'missing_metric', target_value: 1, comparison: 'gte' }
      ]
    );
    expect(result.status).toBe('computed');
    expect(result.score).toBe(90);
    expect(result.components).toHaveLength(2);
    expect(result.confidence).toBe('low');
  });

  test('alerts remain unknown when metric or historical context is unavailable', () => {
    const results = evaluateAlertRules(
      { monthly_revenue: 90 },
      [
        { id: 'a', enabled: true, metric_key: 'monthly_revenue', operator: 'lt', threshold: 100 },
        { id: 'b', enabled: true, metric_key: 'traffic', operator: 'gt', threshold: 10 },
        { id: 'c', enabled: true, metric_key: 'monthly_revenue', operator: 'pct_drop', threshold: 10 }
      ]
    );
    expect(results[0]).toEqual(expect.objectContaining({ status: 'evaluated', triggered: true }));
    expect(results[1]).toEqual(expect.objectContaining({ status: 'unknown', triggered: null }));
    expect(results[2]).toEqual(expect.objectContaining({ status: 'unknown', triggered: null }));
  });

  test('what-if simulator is mechanical and does not claim causal confidence', () => {
    const result = simulateScenario(
      { traffic: 1000, conversionRatePct: 5, closeRatePct: 20, averageRevenuePerClient: 10000 },
      { traffic: { pct: 20 }, conversionRatePct: { absolute: 6 } }
    );
    expect(result.outputs.traffic).toBe(1200);
    expect(result.outputs.leads).toBe(72);
    expect(result.outputs.clients).toBeCloseTo(14.4);
    expect(result.outputs.revenue).toBeCloseTo(144000);
    expect(result.confidence).toBe('low');
    expect(result.disclaimer).toContain('no causal inference');
  });
});
