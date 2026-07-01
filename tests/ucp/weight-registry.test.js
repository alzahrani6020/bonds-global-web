const { WeightRegistry } = require('../../lib/ucp/weight-registry');

describe('UCP Weight Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new WeightRegistry({ preferStatic: true });
  });

  test('finds weights by context', () => {
    const weights = registry.findByContext('intent', 'request_financing');
    expect(weights.length).toBeGreaterThan(0);
    expect(weights[0].weights.dscr).toBeGreaterThan(0);
  });

  test('computes weighted score', () => {
    const result = registry.score('wgt_financing', { dscr: 1.5, ltv: 60, roi: 20, payback_period: 3 });
    expect(result.weightSum).toBeCloseTo(1);
    expect(result.score).toBeCloseTo((1.5 * 0.4) + (60 * 0.3) + (20 * 0.2) + (3 * 0.1));
  });
});
