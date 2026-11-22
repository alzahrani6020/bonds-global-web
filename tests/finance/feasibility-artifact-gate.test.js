'use strict';

const { feasibilityAnalysis } = require('../../lib/finance/engines/feasibility-engine');
const { assessFeasibilityArtifact } = require('../../lib/finance/feasibility-artifact-gate');

const wrap = (feasibility) => ({
  executed: true,
  result: { engineResults: { feasibility } }
});

describe('feasibility archive eligibility and independently calculated financial reference', () => {
  test('NPV and IRR match the fixed five-period ordinary-annuity reference', () => {
    // Independently verified by the closed-form ordinary-annuity NPV:
    // 30000 * (1 - (1 + .10)^(-5)) / .10 - 100000
    // IRR is the root of 100000 = 30000 * sum((1+r)^(-t), t=1..5).
    const actual = feasibilityAnalysis({
      initial_investment: 100000,
      cash_flows: [30000, 30000, 30000, 30000, 30000],
      discount_rate: 0.10,
      years: 5
    });
    expect(actual.executed).toBe(true);
    expect(actual.metrics.npv).toBeCloseTo(13723.60308225351, 5);
    expect(actual.metrics.irr).toBeCloseTo(0.15238237116630649, 7);
    expect(actual.metrics.irr_pct).toBeCloseTo(15.238237116630648, 5);
    expect(assessFeasibilityArtifact(wrap(actual)).complete).toBe(true);
  });

  test('partial response cannot be archived even when orchestration says executed', () => {
    const incomplete = feasibilityAnalysis({
      initial_investment: 100000,
      cash_flows: [30000, 30000],
      discount_rate: null,
      years: 2
    });
    expect(incomplete.executed).toBe(false);
    expect(assessFeasibilityArtifact(wrap(incomplete)).complete).toBe(false);
    expect(assessFeasibilityArtifact({executed:true,result:{engineResults:{feasibility:{executed:false}}}}).complete).toBe(false);
    expect(assessFeasibilityArtifact({executed:true,result:{}}).complete).toBe(false);
  });

  test('no IRR exists for all-negative cash flows and archive eligibility stays closed', () => {
    const actual = feasibilityAnalysis({
      initial_investment: 100000,
      cash_flows: [-10000, -20000],
      discount_rate: 0.10,
      years: 2
    });
    expect(actual.metrics.irr).toBeNull();
    expect(assessFeasibilityArtifact(wrap(actual)).complete).toBe(false);
  });

  test('archive gate runs before the persistence insert in the execution handler', () => {
    const fs=require('fs'),path=require('path');
    const api=fs.readFileSync(path.join(__dirname,'../../v3/api/services.js'),'utf8');
    const assessed=api.indexOf('assessFeasibilityArtifact(result.body)');
    const save=api.indexOf(".from('bonds_investment_artifacts').insert(");
    expect(assessed).toBeGreaterThan(-1);
    expect(save).toBeGreaterThan(assessed);
    expect(api).toContain('(!feasibilityGate || feasibilityGate.complete)');
    expect(api).toContain('FEASIBILITY_NOT_CALCULATED');
  });
});
