const { evaluateExpression, getVariables } = require('../../lib/ucp/expression-evaluator');

describe('UCP Expression Evaluator', () => {
  test('evaluates basic arithmetic', () => {
    expect(evaluateExpression('2 + 3 * 4', {})).toBe(14);
  });

  test('respects parentheses', () => {
    expect(evaluateExpression('(2 + 3) * 4', {})).toBe(20);
  });

  test('uses variables', () => {
    expect(evaluateExpression('revenue - costs', { revenue: 1000, costs: 250 })).toBe(750);
  });

  test('supports power operator', () => {
    expect(evaluateExpression('2 ^ 3 + 1', {})).toBe(9);
  });

  test('supports functions', () => {
    expect(evaluateExpression('pow(2, 3) + sqrt(16)', {})).toBe(12);
  });

  test('detects unknown variable', () => {
    expect(() => evaluateExpression('x + y', { x: 1 })).toThrow('Unknown variable: y');
  });

  test('detects division by zero', () => {
    expect(() => evaluateExpression('1 / 0', {})).toThrow('Division by zero');
  });

  test('extracts variables', () => {
    expect(getVariables('revenue - cogs * 2 + min(a, b)')).toEqual(['revenue', 'cogs', 'a', 'b']);
  });
});
