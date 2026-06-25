/**
 * @jest-environment node
 */

const InvestmentEngine = require('../calculators/investment-center/investment-engine');

describe('InvestmentEngine', () => {
  const baseInputs = {
    totalInvestment: 100000,
    monthlyFixedCosts: 5000,
    monthlyVariableCosts: 3000,
    monthlyRevenue: 20000,
    unitPrice: 100,
    unitVariableCost: 40,
    projectMonths: 60
  };

  test('calculates basic metrics correctly', () => {
    const result = InvestmentEngine.analyze(baseInputs);
    expect(result.success).toBe(true);
    expect(result.metrics.monthlyNetCashFlow).toBe(12000);
    expect(result.metrics.roi).toBeGreaterThan(0);
    expect(result.metrics.irr).toBeGreaterThan(0);
    expect(result.metrics.npv).toBeGreaterThan(0);
    expect(result.metrics.profitMargin).toBe(60);
    expect(result.metrics.breakEvenUnits).toBe(84);
  });

  test('recommends investment for excellent project', () => {
    const result = InvestmentEngine.analyze({
      totalInvestment: 100000,
      monthlyFixedCosts: 2000,
      monthlyVariableCosts: 3000,
      monthlyRevenue: 25000,
      unitPrice: 100,
      unitVariableCost: 40,
      projectMonths: 60
    });
    expect(result.recommendation.decisionKey).toBe('recommended');
    expect(result.metrics.paybackMonths).toBeLessThanOrEqual(24);
  });

  test('flags not recommended for losing project', () => {
    const result = InvestmentEngine.analyze({
      totalInvestment: 100000,
      monthlyFixedCosts: 8000,
      monthlyVariableCosts: 5000,
      monthlyRevenue: 10000,
      unitPrice: 100,
      unitVariableCost: 80,
      projectMonths: 60
    });
    expect(result.recommendation.decisionKey).toBe('not_recommended');
    expect(result.metrics.npv).toBeLessThanOrEqual(0);
  });

  test('handles break-even with zero contribution margin', () => {
    const be = InvestmentEngine.calculateBreakEven(1000, 100, 100);
    expect(be.units).toBe(Infinity);
  });

  test('handles zero investment gracefully', () => {
    const result = InvestmentEngine.analyze({
      ...baseInputs,
      totalInvestment: 0
    });
    expect(result.success).toBe(true);
    expect(result.metrics.roi).toBe(0);
  });

  test('analyzeEn returns English recommendation labels', () => {
    const result = InvestmentEngine.analyzeEn(baseInputs);
    expect(result.success).toBe(true);
    expect(result.recommendation.decision).toBe('Recommended for Investment');
  });

  test('IRR calculation is reasonable', () => {
    const irr = InvestmentEngine.calculateIRR([-1000, 500, 500, 500]);
    expect(irr).toBeGreaterThan(0.20);
    expect(irr).toBeLessThan(0.30);
  });

  test('NPV calculation is correct', () => {
    const npv = InvestmentEngine.calculateNPV([-1000, 500, 500, 500], 0.1);
    expect(npv).toBeGreaterThan(200);
    expect(npv).toBeLessThan(300);
  });
});
