'use strict';

const {
  getPreset,
  normalizeScenario,
  scaleRiskScoreDelta
} = require('../../v3/engine/ScenarioEngine');

describe('V3 preset riskScoreDelta', () => {
  test('defines the designed risk deltas for ready-made scenarios', () => {
    expect(getPreset('recession').riskScoreDelta).toBe(10);
    expect(getPreset('high_inflation').riskScoreDelta).toBe(5);
    expect(getPreset('labor_shortage').riskScoreDelta).toBe(8);
    expect(getPreset('rent_boom').riskScoreDelta).toBe(4);
    expect(getPreset('sales_drop').riskScoreDelta).toBe(7);
  });

  test('scales recession risk by severity: mild 5, moderate 10, severe 15', () => {
    expect(scaleRiskScoreDelta(10, 'mild')).toBe(5);
    expect(scaleRiskScoreDelta(10, 'moderate')).toBe(10);
    expect(scaleRiskScoreDelta(10, 'severe')).toBe(15);
  });

  test('applies designed recession delta when the UI sends sourcePreset and scaled shocks', () => {
    const uiPayload = {
      name: 'سيناريو الركود — متوسط',
      shocks: [
        { code: 'revenue', type: 'relative', value: -0.15 },
        { code: 'revenue_growth_rate', type: 'relative', value: -0.50 },
        { code: 'marketing_ratio', type: 'relative', value: 0.10 }
      ],
      sourcePreset: 'recession',
      severity: 'moderate'
    };

    const normalized = normalizeScenario(uiPayload);
    expect(normalized.riskScoreDelta).toBe(10);
    expect(normalized.shocks).toEqual(uiPayload.shocks);
    expect(normalized.preset).toBe('recession');
  });

  test('does not drop riskScoreDelta to zero when only sourcePreset is present', () => {
    const normalized = normalizeScenario({
      name: 'سيناريو الركود — متوسط',
      shocks: [{ code: 'revenue', type: 'relative', value: -0.15 }],
      sourcePreset: 'recession',
      severity: 'moderate'
    });
    expect(normalized.riskScoreDelta).not.toBe(0);
    expect(normalized.riskScoreDelta).toBe(10);
  });

  test('scales a severe inflation preset without replacing client shocks', () => {
    const shocks = [{ code: 'interest_rate', type: 'relative', value: 0.375 }];
    const normalized = normalizeScenario({
      name: 'سيناريو التضخم المرتفع — شديد',
      shocks,
      sourcePreset: 'high_inflation',
      severity: 'severe'
    });
    expect(normalized.riskScoreDelta).toBe(7.5);
    expect(normalized.shocks).toEqual(shocks);
  });

  test('still accepts the engine-native preset field', () => {
    const normalized = normalizeScenario({ preset: 'recession' });
    expect(normalized.riskScoreDelta).toBe(10);
    expect(normalized.shocks).toEqual(getPreset('recession').shocks);
  });
});
