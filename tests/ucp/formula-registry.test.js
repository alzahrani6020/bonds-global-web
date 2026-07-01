const { FormulaRegistry } = require('../../lib/ucp/formula-registry');

describe('UCP Formula Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new FormulaRegistry({ preferStatic: true });
  });

  test('loads static formulas', () => {
    expect(registry.get('net_profit')).toBeDefined();
    expect(registry.get('dscr')).toBeDefined();
  });

  test('evaluates a formula', () => {
    const result = registry.evaluate('net_profit', { revenue: 1000, total_costs: 600 });
    expect(result.value).toBe(400);
  });

  test('evaluates dependency chain', () => {
    const { results } = registry.evaluateAll(['net_profit_margin'], { revenue: 1000, total_costs: 600 });
    expect(results.net_profit_margin.value).toBe(40);
  });

  test('resolves topological order', () => {
    const order = registry.resolveOrder(['net_profit_margin']);
    expect(order).toEqual(['total_costs', 'net_profit', 'net_profit_margin']);
  });

  test('detects circular dependency', () => {
    registry.register({ code: 'a', expression: 'b + 1' });
    registry.register({ code: 'b', expression: 'a + 1' });
    expect(() => registry.resolveOrder(['a'])).toThrow('Circular dependency');
  });
});
