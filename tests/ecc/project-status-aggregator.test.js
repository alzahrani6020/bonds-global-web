const {
  deriveNextBestAction,
  deriveCriticalAlerts,
  computeFundingScore,
  computeValuationStatus
} = require('../../lib/ecc/project-status-aggregator');

describe('ECC Project Status Aggregator Helpers', () => {
  test('computeFundingScore uses DSCR from financing object', () => {
    expect(computeFundingScore({ dscr: 1.6 }, null)).toBe(90);
    expect(computeFundingScore({ dscr: 1.3 }, null)).toBe(75);
    expect(computeFundingScore({ dscr: 1.1 }, null)).toBe(60);
    expect(computeFundingScore({ dscr: 0.8 }, null)).toBe(40);
  });

  test('computeFundingScore uses UCP financing result when financing object missing DSCR', () => {
    const ucpResult = { engineResults: { financing: { dscr: 1.4 } } };
    expect(computeFundingScore({}, ucpResult)).toBe(75);
  });

  test('computeValuationStatus returns missing when no valuation', () => {
    const result = computeValuationStatus(null);
    expect(result.status).toBe('missing');
    expect(result.score).toBe(0);
  });

  test('computeValuationStatus returns complete for final status', () => {
    const result = computeValuationStatus({ status: 'final', confidence_score: 82 });
    expect(result.status).toBe('complete');
    expect(result.score).toBe(82);
  });

  test('deriveNextBestAction suggests feasibility at idea stage', () => {
    const result = deriveNextBestAction({ currentStage: 'idea' }, null, {}, null, null);
    expect(result.priority).toBe('critical');
    expect(result.action).toContain('feasibility');
  });

  test('deriveNextBestAction suggests readiness gaps when score low', () => {
    const lifecycle = { currentStage: 'investment_readiness', allowedTransitions: [] };
    const readiness = { readinessScore: 50, missing_items: ['financials', 'team'] };
    const result = deriveNextBestAction(lifecycle, readiness, { status: 'complete' }, null, null);
    expect(result.priority).toBe('critical');
    expect(result.action).toContain('gaps');
  });

  test('deriveCriticalAlerts includes DSCR warning', () => {
    const alerts = deriveCriticalAlerts({}, null, { status: 'complete' }, { dscr: 1.1 }, null);
    const dscrAlert = alerts.find(a => a.type === 'financing');
    expect(dscrAlert).toBeDefined();
    expect(dscrAlert.priority).toBe('critical');
  });

  test('deriveCriticalAlerts includes missing valuation', () => {
    const alerts = deriveCriticalAlerts({}, null, { status: 'missing' }, null, null);
    expect(alerts.some(a => a.type === 'valuation')).toBe(true);
  });
});
