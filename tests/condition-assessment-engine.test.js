/**
 * Tests for BONDS Condition Assessment Engine
 */

const BondsConditionStandards = require('../valuation/condition-assessment-standards.js');
const BondsConditionAssessmentEngine = require('../valuation/condition-assessment-engine.js');

describe('Condition Assessment Standards', () => {
  test('has 120 master inspection points', () => {
    expect(BondsConditionStandards.MASTER_POINTS.length).toBe(120);
  });

  test('covers all 35 asset classes', () => {
    const classes = BondsConditionStandards.listAssetClasses();
    expect(classes.length).toBe(35);
    classes.forEach(cls => {
      const std = BondsConditionStandards.resolveStandards(cls);
      expect(std).toBeTruthy();
      expect(std.points.length).toBeGreaterThan(0);
    });
  });

  test('each asset class has point weights that sum to approximately 1', () => {
    BondsConditionStandards.listAssetClasses().forEach(cls => {
      const std = BondsConditionStandards.resolveStandards(cls);
      const totalWeight = std.points.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
      expect(totalWeight).toBeGreaterThan(0.95);
      expect(totalWeight).toBeLessThanOrEqual(1.05);
    });
  });

  test('all points reference valid categories', () => {
    const categoryIds = new Set(BondsConditionStandards.CATEGORIES.map(c => c.id));
    BondsConditionStandards.MASTER_POINTS.forEach(p => {
      expect(categoryIds.has(p.category)).toBe(true);
    });
  });
});

describe('Condition Assessment Engine', () => {
  function perfectAnswers(std) {
    const answers = {};
    std.points.forEach(p => {
      if (p.type === 'yes/no' || p.type === 'pass/fail') {
        answers[p.id] = 'yes';
      } else if (p.type === '0-10') {
        answers[p.id] = 10;
      } else {
        answers[p.id] = 5;
      }
    });
    return answers;
  }

  test('perfect answers yield 100 score and grade A', () => {
    const std = BondsConditionStandards.resolveStandards('realEstate');
    const answers = perfectAnswers(std);
    const result = BondsConditionAssessmentEngine.calculate('realEstate', answers, { standards: std });

    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.confidenceScore).toBe(100);
    expect(result.criticalFailures.length).toBe(0);
    expect(result.capped).toBe(false);
    expect(result.valuationInputs.conditionScore).toBe(10);
    expect(result.valuationInputs.maintenanceLevel).toBeGreaterThanOrEqual(1);
  });

  test('critical failure caps the score', () => {
    const std = BondsConditionStandards.resolveStandards('realEstate');
    const answers = perfectAnswers(std);
    const criticalPoint = std.points.find(p => p.critical);
    expect(criticalPoint).toBeTruthy();

    answers[criticalPoint.id] = criticalPoint.type === 'yes/no' || criticalPoint.type === 'pass/fail' ? 'no' : 0;
    const result = BondsConditionAssessmentEngine.calculate('realEstate', answers, { standards: std });

    expect(result.capped).toBe(true);
    expect(result.score).toBeLessThanOrEqual(60);
    expect(result.criticalFailures.length).toBeGreaterThan(0);
  });

  test('partial answers reduce confidence but still compute score', () => {
    const std = BondsConditionStandards.resolveStandards('factory');
    const answers = {};
    std.points.slice(0, 5).forEach(p => {
      answers[p.id] = p.type === 'yes/no' || p.type === 'pass/fail' ? 'yes' : 4;
    });

    const result = BondsConditionAssessmentEngine.calculate('factory', answers, { standards: std });
    expect(result.answeredCount).toBe(5);
    expect(result.confidenceScore).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
  });

  test('missing standards returns error result', () => {
    const result = BondsConditionAssessmentEngine.calculate('nonexistentClass', {});
    expect(result.success).toBeFalsy();
    expect(result.error).toMatch(/No condition assessment standards/);
  });

  test('valuation inputs map condition score to 1-10 scale', () => {
    const std = BondsConditionStandards.resolveStandards('machineryEquipment');
    const answers = {};
    std.points.forEach(p => {
      answers[p.id] = p.type === 'yes/no' || p.type === 'pass/fail' ? 'yes' : 3;
    });

    const result = BondsConditionAssessmentEngine.calculate('machineryEquipment', answers, { standards: std });
    expect(result.valuationInputs.conditionScore).toBeGreaterThanOrEqual(1);
    expect(result.valuationInputs.conditionScore).toBeLessThanOrEqual(10);
    expect(result.valuationInputs.maintenanceNeglect).toBeGreaterThanOrEqual(0);
    expect(result.valuationInputs.maintenanceNeglect).toBeLessThanOrEqual(1);
  });

  test('grade boundaries are respected', () => {
    expect(BondsConditionAssessmentEngine.getGrade(95)).toBe('A');
    expect(BondsConditionAssessmentEngine.getGrade(85)).toBe('B');
    expect(BondsConditionAssessmentEngine.getGrade(75)).toBe('C');
    expect(BondsConditionAssessmentEngine.getGrade(65)).toBe('D');
    expect(BondsConditionAssessmentEngine.getGrade(55)).toBe('E');
  });
});
