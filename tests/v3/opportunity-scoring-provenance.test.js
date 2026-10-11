'use strict';

const OpportunityScoringEngine = require('../../v3/engine/OpportunityScoringEngine');

describe('Opportunity scoring provenance', () => {
  const engine = new OpportunityScoringEngine(null);

  test('does not fabricate neutral 50 scores for missing dimensions', () => {
    const result = engine._computeScore(
      {
        confidence: 80,
        annual_growth_rate: 12,
        market_size: 1000000,
        market_saturation_score: null,
        labor_availability_score: null,
        avg_rent_per_sqm: null,
        risk_score: null,
        competitors_count: 10,
        avg_salary: 7000
      },
      {
        population: 100000,
        purchasing_power_index: null
      },
      {
        per_capita_market_spend: 10
      },
      { median: 0, count: 0 }
    );

    expect(result.breakdown.growth).toBe(40);
    expect(result.breakdown.perCapitaMarket).toBe(50);
    expect(result.breakdown.lowSaturation).toBeNull();
    expect(result.breakdown.laborAvailability).toBeNull();
    expect(result.breakdown.purchasingPower).toBeNull();
    expect(result.breakdown.rentAffordability).toBeNull();
    expect(result.breakdown.lowRisk).toBeNull();
    expect(result.breakdown.missingComponents).toEqual(
      expect.arrayContaining(['lowSaturation', 'laborAvailability', 'purchasingPower', 'rentAffordability', 'lowRisk'])
    );
    expect(result.breakdown.metricCoverage).toBeLessThan(100);
  });

  test('population zero blocks per-capita score instead of substituting population=1', () => {
    const result = engine._computeScore(
      {
        confidence: 80,
        annual_growth_rate: 10,
        market_size: 5000000,
        competitors_count: 20,
        market_saturation_score: 40,
        avg_salary: 8000
      },
      {
        population: 0,
        purchasing_power_index: 100
      },
      {
        per_capita_market_spend: 100
      },
      { median: 100, count: 5 }
    );

    expect(result.breakdown.perCapitaMarket).toBeNull();
    expect(result.breakdown.missingComponents).toContain('perCapitaMarket');
    expect(result.decisionStatus).toBe('insufficient_evidence');
  });

  test('effective weights renormalize only across calculable dimensions', () => {
    const result = engine._computeScore(
      {
        confidence: 85,
        annual_growth_rate: 15,
        market_size: 1000000,
        per_capita_spending: 10,
        market_saturation_score: 30,
        labor_availability_score: 70,
        avg_rent_per_sqm: 100,
        risk_score: 20,
        competitors_count: 20,
        avg_salary: 8000
      },
      {
        population: 100000,
        purchasing_power_index: 120
      },
      {
        per_capita_market_spend: 10,
        avg_rent_per_sqm: 100
      },
      { median: 10, count: 5 }
    );

    const sum = Object.values(result.breakdown.effectiveWeights)
      .reduce((total, value) => total + value, 0);
    expect(sum).toBeCloseTo(1, 1);
    expect(result.breakdown.metricCoverage).toBe(100);
  });
});
