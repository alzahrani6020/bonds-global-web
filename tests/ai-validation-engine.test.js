/**
 * Tests for BondsAiValidationEngine
 */
const { validate } = require('../valuation/ai-validation-engine.js');

describe('BondsAiValidationEngine', () => {
  const baseInputs = {
    assetName: 'فيلا تجريبية',
    country: 'SA',
    city: 'الرياض',
    yearBuilt: 2015,
    areaSqm: 300,
    purchasePrice: 1_000_000,
    comparablePricePerSqm: 3500
  };

  const baseResult = {
    bookValue: 900_000,
    marketValue: 1_050_000,
    fairValue: 1_000_000,
    investmentValue: 1_100_000,
    liquidationValue: 850_000,
    replacementValue: 1_200_000
  };

  const marketData = {
    averageSellingPrice: 1_000_000,
    transactionCount: 12,
    dataQualityScore: 90,
    confidence: 0.9,
    riskScore: 4
  };

  const conditionAssessment = {
    score: 78,
    grade: 'B',
    confidenceScore: 80,
    categoryScores: {},
    criticalFailures: []
  };

  const riskAssessment = {
    riskIndex: 35,
    riskGrade: 'B',
    riskLevel: 'medium',
    confidenceScore: 70,
    categoryScores: {},
    criticalRisks: [],
    topRisks: []
  };

  test('returns passed=true when data is complete and consistent', () => {
    const result = validate({
      assetClass: 'realEstate',
      inputs: baseInputs,
      result: baseResult,
      marketData,
      conditionAssessment,
      riskAssessment
    });

    expect(result.passed).toBe(true);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(result.dataQualityScore).toBeGreaterThanOrEqual(80);
    expect(result.missingFields.length).toBe(0);
  });

  test('fails when critical fields are missing', () => {
    const inputs = { ...baseInputs };
    delete inputs.comparablePricePerSqm;
    delete inputs.areaSqm;

    const result = validate({
      assetClass: 'realEstate',
      inputs,
      result: baseResult,
      marketData,
      conditionAssessment,
      riskAssessment
    });

    expect(result.passed).toBe(false);
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(80);
  });

  test('detects outlier when fair value differs significantly from market value', () => {
    const outlierResult = { ...baseResult, fairValue: 5_000_000 };

    const result = validate({
      assetClass: 'realEstate',
      inputs: baseInputs,
      result: outlierResult,
      marketData,
      conditionAssessment,
      riskAssessment
    });

    expect(result.outliers.length).toBeGreaterThan(0);
  });

  test('detects conflict when fair value deviates far from market average', () => {
    const market = { ...marketData, averageSellingPrice: 200_000 };

    const result = validate({
      assetClass: 'realEstate',
      inputs: baseInputs,
      result: baseResult,
      marketData: market,
      conditionAssessment,
      riskAssessment
    });

    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  test('uses default rule for unknown asset class', () => {
    const result = validate({
      assetClass: 'unknownClass',
      inputs: baseInputs,
      result: baseResult,
      marketData,
      conditionAssessment,
      riskAssessment
    });

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('confidenceScore');
    expect(result.missingFields).toBeInstanceOf(Array);
  });

  test('scores drop when market data quality is poor', () => {
    const poorMarket = { ...marketData, dataQualityScore: 30, confidence: 0.2 };

    const result = validate({
      assetClass: 'realEstate',
      inputs: baseInputs,
      result: baseResult,
      marketData: poorMarket,
      conditionAssessment,
      riskAssessment
    });

    expect(result.marketScore).toBeLessThan(60);
  });
});
