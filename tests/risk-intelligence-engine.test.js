/**
 * Tests for BONDS Risk Intelligence Engine
 */

const BondsRiskIntelligenceStandards = require('../valuation/risk-intelligence-standards.js');
const BondsRiskIntelligenceEngine = require('../valuation/risk-intelligence-engine.js');

describe('Risk Intelligence Standards', () => {
  test('has 8 risk categories', () => {
    expect(BondsRiskIntelligenceStandards.CATEGORIES.length).toBe(8);
  });

  test('has risk factors covering all 8 categories', () => {
    const categoryIds = new Set(BondsRiskIntelligenceStandards.CATEGORIES.map(c => c.id));
    const factorCategories = new Set(BondsRiskIntelligenceStandards.RISK_FACTORS.map(f => f.category));
    categoryIds.forEach(id => expect(factorCategories.has(id)).toBe(true));
  });

  test('covers all 35 asset classes with weights summing to 1', () => {
    BondsRiskIntelligenceStandards.listAssetClasses().forEach(cls => {
      const weights = BondsRiskIntelligenceStandards.resolveCategoryWeights(cls);
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 4);
    });
  });

  test('default category weights sum to 1', () => {
    const total = Object.values(BondsRiskIntelligenceStandards.DEFAULT_CATEGORY_WEIGHTS)
      .reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 4);
  });
});

describe('Risk Intelligence Engine', () => {
  function lowRiskAnswers() {
    const answers = {};
    BondsRiskIntelligenceStandards.RISK_FACTORS.forEach(f => {
      if (f.type === 'yes/no') {
        answers[f.id] = 'no';
      } else if (f.type === '0-10') {
        answers[f.id] = 0;
      } else {
        answers[f.id] = 0;
      }
    });
    return answers;
  }

  function highRiskAnswers() {
    const answers = {};
    BondsRiskIntelligenceStandards.RISK_FACTORS.forEach(f => {
      if (f.type === 'yes/no') {
        answers[f.id] = 'yes';
      } else if (f.type === '0-10') {
        answers[f.id] = 10;
      } else {
        answers[f.id] = 5;
      }
    });
    return answers;
  }

  test('low risk answers produce a low Risk Index and grade A', () => {
    const result = BondsRiskIntelligenceEngine.calculate('realEstate', lowRiskAnswers());
    expect(result.success).toBe(true);
    expect(result.riskIndex).toBeLessThanOrEqual(25);
    expect(result.riskGrade).toBe('A');
    expect(result.confidenceScore).toBe(100);
  });

  test('high risk answers produce a high Risk Index and grade E', () => {
    const result = BondsRiskIntelligenceEngine.calculate('realEstate', highRiskAnswers());
    expect(result.success).toBe(true);
    expect(result.riskIndex).toBeGreaterThanOrEqual(75);
    expect(result.riskGrade).toBe('E');
  });

  test('critical risk factors raise category score floor', () => {
    const answers = lowRiskAnswers();
    const criticalFactor = BondsRiskIntelligenceStandards.RISK_FACTORS
      .find(f => f.critical && f.type !== 'yes/no');
    expect(criticalFactor).toBeTruthy();
    answers[criticalFactor.id] = 5;
    const result = BondsRiskIntelligenceEngine.calculate('realEstate', answers);
    const catScore = result.categoryScores[criticalFactor.category].score;
    expect(catScore).toBeGreaterThanOrEqual(60);
  });

  test('condition assessment integration increases asset risk when condition is poor', () => {
    const answers = lowRiskAnswers();
    const result = BondsRiskIntelligenceEngine.calculate('realEstate', answers, {
      externalData: {
        conditionAssessment: { conditionScore: 2 }
      }
    });
    expect(result.externalAdjustments.conditionAssessment).toBe(true);
    expect(result.categoryScores.asset.conditionAdjustment).toBeGreaterThan(0);
  });

  test('market data integration increases market risk when outlook is negative', () => {
    const answers = lowRiskAnswers();
    const result = BondsRiskIntelligenceEngine.calculate('realEstate', answers, {
      externalData: {
        marketData: { riskScore: 8, outlook: 'negative' }
      }
    });
    expect(result.externalAdjustments.marketData).toBe(true);
    expect(result.categoryScores.market.marketAdjustment).toBeGreaterThan(0);
  });

  test('valuation inputs integration increases technological risk', () => {
    const answers = lowRiskAnswers();
    const result = BondsRiskIntelligenceEngine.calculate('softwareTechnology', answers, {
      externalData: {
        valuationInputs: { techObsolescenceRate: 0.8 }
      }
    });
    expect(result.externalAdjustments.valuationInputs).toBe(true);
    expect(result.categoryScores.technological.valuationAdjustment).toBeGreaterThan(0);
  });

  test('top risks are sorted descending by score', () => {
    const answers = highRiskAnswers();
    const result = BondsRiskIntelligenceEngine.calculate('realEstate', answers);
    expect(result.topRisks.length).toBeGreaterThan(0);
    expect(result.topRisks[0].score).toBeGreaterThanOrEqual(result.topRisks[1]?.score || 0);
  });

  test('unknown asset class falls back to default weights and computes', () => {
    const result = BondsRiskIntelligenceEngine.calculate('nonexistentClass', {});
    expect(result.success).toBe(true);
    expect(result.confidenceScore).toBe(0);
    expect(result.riskIndex).toBeGreaterThanOrEqual(0);
    expect(result.riskIndex).toBeLessThanOrEqual(100);
  });

  test('valuation adjustments scale with risk index', () => {
    const low = BondsRiskIntelligenceEngine.calculate('realEstate', lowRiskAnswers());
    const high = BondsRiskIntelligenceEngine.calculate('realEstate', highRiskAnswers());
    expect(high.valuationAdjustments.riskPremiumRate)
      .toBeGreaterThan(low.valuationAdjustments.riskPremiumRate);
    expect(high.valuationAdjustments.valueHaircutRate)
      .toBeGreaterThan(low.valuationAdjustments.valueHaircutRate);
  });

  test('grade boundaries are respected', () => {
    expect(BondsRiskIntelligenceEngine.getGrade(15)).toBe('A');
    expect(BondsRiskIntelligenceEngine.getGrade(35)).toBe('B');
    expect(BondsRiskIntelligenceEngine.getGrade(55)).toBe('C');
    expect(BondsRiskIntelligenceEngine.getGrade(75)).toBe('D');
    expect(BondsRiskIntelligenceEngine.getGrade(95)).toBe('E');
  });

  test('report is generated in Arabic and English', () => {
    const result = BondsRiskIntelligenceEngine.calculate('realEstate', highRiskAnswers());
    const arReport = BondsRiskIntelligenceEngine.generateReport(result, 'ar');
    const enReport = BondsRiskIntelligenceEngine.generateReport(result, 'en');
    expect(arReport).toContain('تقرير ذكاء المخاطر');
    expect(enReport).toContain('Risk Intelligence Report');
    expect(arReport).toContain(String(result.riskIndex));
  });
});
