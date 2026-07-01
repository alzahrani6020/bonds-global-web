const { buildExperienceConfig } = require('../../lib/adaptive-experience/adaptive-experience-engine');
const { DecisionProfile } = require('../../lib/decision-profile');

describe('Adaptive Experience Engine', () => {
  it('simplifies UI for novice users', () => {
    const profile = new DecisionProfile({ user_id: 'u1' });
    const config = buildExperienceConfig(profile);
    expect(config.simplifiedMode).toBe(true);
    expect(config.showAdvancedOptions).toBe(false);
    expect(config.helpLevel).toBe('high');
  });

  it('shows advanced options for experts', () => {
    const profile = new DecisionProfile({ user_id: 'u2' });
    for (let i = 0; i < 35; i++) profile.recordDecision('feasibility');
    for (let i = 0; i < 10; i++) profile.recordSector('restaurant');
    profile.recordValuationMethod('income');
    profile.recordReportType('valuation');
    profile.computeExpertise();
    const config = buildExperienceConfig(profile);
    expect(config.showAdvancedOptions).toBe(true);
    expect(config.fieldDensity).toBe('full');
  });

  it('orders fields by decision patterns', () => {
    const profile = new DecisionProfile({ user_id: 'u3' });
    profile.recordDecision('request_financing', 5);
    const config = buildExperienceConfig(profile);
    expect(config.fieldOrdering).toContain('dscr');
    expect(config.fieldOrdering).toContain('ltv');
  });
});
