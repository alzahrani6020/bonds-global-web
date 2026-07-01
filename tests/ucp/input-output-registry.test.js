const { InputDefinitionRegistry, OutputDefinitionRegistry } = require('../../lib/ucp/input-output-registry');

describe('UCP Input/Output Definition Registry', () => {
  test('loads default input definitions', () => {
    const registry = new InputDefinitionRegistry({ preferStatic: true });
    expect(registry.get('revenue')).toBeDefined();
    expect(registry.get('revenue').required).toBe(true);
  });

  test('loads default output definitions', () => {
    const registry = new OutputDefinitionRegistry({ preferStatic: true });
    expect(registry.get('net_profit')).toBeDefined();
    expect(registry.get('net_profit').formula_codes).toContain('net_profit');
  });
});
