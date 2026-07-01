const { DecisionProfile } = require('../../lib/decision-profile');

describe('Decision Profile', () => {
  it('records decision patterns', () => {
    const profile = new DecisionProfile({ user_id: 'u1' });
    profile.recordDecision('feasibility', 2);
    profile.recordDecision('request_financing');
    expect(profile.decisionPatterns.feasibility).toBe(2);
    expect(profile.decisionPatterns.request_financing).toBe(1);
  });

  it('records sectors and formulas', () => {
    const profile = new DecisionProfile({});
    profile.recordSector('restaurant', 3);
    profile.recordFormula('npv');
    expect(profile.topSectors(1)[0].item).toBe('restaurant');
    expect(profile.formulas).toContain('npv');
  });

  it('computes expertise score', () => {
    const profile = new DecisionProfile({});
    profile.recordDecision('feasibility', 5);
    profile.recordSector('manufacturing');
    profile.recordValuationMethod('income');
    profile.recordReportType('valuation');
    const score = profile.computeExpertise();
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('serializes to JSON', () => {
    const profile = new DecisionProfile({ user_id: 'u1' });
    const json = profile.toJSON();
    expect(json.user_id).toBe('u1');
    expect(json.expertise_score).toBe(0);
  });
});
