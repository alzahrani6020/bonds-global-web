/**
 * @jest-environment node
 */
const DecisionIntelligence = require('../calculators/investment-center/decision-intelligence');

describe('DecisionIntelligence market semantics', () => {
  test('uses canonical revenue for market share and treats missing competition level as unknown', () => {
    const result = DecisionIntelligence.analyze(
      {
        marketSize: 100000000,
        competitorCount: 20,
        marketGrowthRate: 8
      },
      {
        metrics: {
          monthlyRevenue: 1000000,
          monthlyNetCashFlow: 100000,
          monthlyFixedCosts: 500000,
          monthlyVariableCosts: 400000,
          totalInvestment: 5000000,
          projectMonths: 60,
          profitMargin: 10,
          paybackMonths: 50,
          roi: 20,
          irr: 15,
          npv: 100000
        },
        recommendation: { decisionKey: 'conditional', decision: 'Suitable with Conditions' }
      },
      'en'
    );

    expect(result.marketAnalysis.marketShare).toBeCloseTo(12, 6);
    expect(result.marketAnalysis.competitionLevel).toBeNull();
    expect(result.marketAnalysis.competitorCount).toBe(20);
    expect(result.marketAnalysis.competitionAssessment).toBe('high');
  });
});
