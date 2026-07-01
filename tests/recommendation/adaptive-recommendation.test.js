const { generateRecommendations } = require('../../lib/recommendation/adaptive-recommendation');
const { DecisionProfile } = require('../../lib/decision-profile');

describe('Adaptive Recommendation', () => {
  it('generates sector recommendation for restaurant', () => {
    const result = generateRecommendations({ sector: 'restaurant', decisionType: 'feasibility', language: 'ar' });
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].grade).toBeDefined();
    expect(result.explanation.language).toBe('ar');
  });

  it('generates financing recommendation', () => {
    const result = generateRecommendations({
      sector: 'company',
      decisionType: 'request_financing',
      liveData: { dscr: 1.1, ltv: 0.75 },
      language: 'en'
    });
    const financingRec = result.recommendations.find(r => r.source === 'business_rules');
    expect(financingRec).toBeDefined();
    expect(financingRec.confidence).toBeGreaterThan(0);
  });

  it('uses decision profile data source preference', () => {
    const profile = new DecisionProfile({ user_id: 'u1' });
    profile.recordDataSource('market_data', 5);
    const result = generateRecommendations({
      sector: 'hotel',
      decisionType: 'market_analysis',
      decisionProfile: profile,
      language: 'en'
    });
    const sourceRec = result.recommendations.find(r => r.source === 'decision_profile');
    expect(sourceRec).toBeDefined();
  });

  it('filters out invalid recommendations', () => {
    const result = generateRecommendations({
      sector: 'unknown',
      decisionType: 'unknown',
      language: 'en'
    });
    expect(result.recommendations.length).toBe(0);
  });
});
