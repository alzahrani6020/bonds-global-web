'use strict';

const { assessOpportunityRow } = require('../../lib/truth/opportunity-reliability');

describe('Opportunity reliability layer', () => {
  test('preserves raw potential but sharply separates a zero-confidence decision', () => {
    const result = assessOpportunityRow({
      opportunity_score: 85,
      confidence: 65,
      opportunity_breakdown: { confidence: 0 },
      market_size: 1000000,
      competitors_count: 20,
      market_saturation_score: 40,
      annual_growth_rate: 6,
      avg_salary: 8000,
      cities: { population: 1000000 }
    });
    expect(result.rawPotential).toBe(85);
    expect(result.reliability).toBeLessThan(50);
    expect(result.decisionScore).toBeLessThan(result.rawPotential);
    expect(result.warnings).toContain('zero_breakdown_confidence');
    expect(result.uncertainty.basis).toBe('decision_score');
    expect(result.uncertainty.low).toBeLessThanOrEqual(result.decisionScore);
    expect(result.uncertainty.high).toBeGreaterThanOrEqual(result.decisionScore);
  });

  test('blocks decision-grade interpretation when city population is zero', () => {
    const result = assessOpportunityRow({
      opportunity_score: 84,
      confidence: 50,
      opportunity_breakdown: {},
      market_size: 9000000,
      competitors_count: 200,
      market_saturation_score: 60,
      avg_salary: 11825,
      cities: { population: 0 }
    });
    expect(result.reliability).toBeLessThanOrEqual(25);
    expect(result.decisionStatus).toBe('insufficient_evidence');
  });

  test('country-average estimate is explicitly benchmark evidence', () => {
    const result = assessOpportunityRow({
      opportunity_score: 85,
      confidence: 65,
      opportunity_breakdown: { source: 'country_average_estimate', estimated: true },
      market_size: 1000000,
      competitors_count: 20,
      market_saturation_score: 40,
      annual_growth_rate: 4,
      avg_salary: 8000,
      cities: { population: 1000000 }
    });
    expect(result.sourceType).toBe('BENCHMARK');
    expect(result.reliability).toBeLessThanOrEqual(55);
    expect(result.scoringCoverage).toBeNull();
    expect(result.scoringCoverageSource).toBe('unknown');
    expect(result.warnings).toContain('estimated_data');
    expect(result.warnings).toContain('scoring_coverage_unknown');
  });

  test('scoring coverage independently reduces reliability when score dimensions are sparse', () => {
    const result = assessOpportunityRow({
      opportunity_score: 80,
      confidence: 90,
      opportunity_breakdown: { confidence: 90, metricCoverage: 30 },
      market_size: 1000000,
      competitors_count: 20,
      market_saturation_score: 40,
      annual_growth_rate: 6,
      avg_salary: 8000,
      cities: { population: 1000000 }
    });
    expect(result.scoringCoverage).toBe(30);
    expect(result.reliability).toBeLessThanOrEqual(35);
    expect(result.warnings).toContain('low_scoring_coverage');
  });

  test('infers scoring coverage from legacy metric breakdown components', () => {
    const result = assessOpportunityRow({
      opportunity_score: 85,
      confidence: 65,
      opportunity_breakdown: {
        confidence: 70,
        growth: 10,
        perCapitaMarket: 66.7,
        lowSaturation: 30,
        laborAvailability: 75,
        purchasingPower: 72,
        rentAffordability: 77.8,
        lowRisk: 50
      },
      market_size: 1000000,
      competitors_count: 20,
      market_saturation_score: 40,
      annual_growth_rate: 6,
      avg_salary: 8000,
      cities: { population: 1000000 }
    });
    expect(result.scoringCoverage).toBe(100);
    expect(result.scoringCoverageSource).toBe('inferred');
    expect(result.warnings).not.toContain('scoring_coverage_unknown');
  });

});
