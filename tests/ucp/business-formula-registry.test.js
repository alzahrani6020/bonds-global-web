const { BusinessFormulaRegistry, evaluateBusinessExpression } = require('../../lib/ucp/business-formula-registry');

describe('UCP Business Formula Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new BusinessFormulaRegistry({ preferStatic: true });
  });

  test('evaluates logical business expression', () => {
    const result = registry.evaluate('bf_recommendation', { dscr: 1.5, ltv: 70 });
    expect(result.value).toBe(true);
  });

  test('evaluates risk flag', () => {
    const result = registry.evaluate('bf_risk_flag', { dscr: 1.1, ltv: 60 });
    expect(result.value).toBe(true);
  });

  test('evaluates custom expression helper', () => {
    expect(evaluateBusinessExpression('a > 1 AND b < 5', { a: 2, b: 3 })).toBe(true);
  });
});
