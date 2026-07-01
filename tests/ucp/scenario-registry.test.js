const { ScenarioRegistry, applyModifier } = require('../../lib/ucp/scenario-registry');

describe('UCP Scenario Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new ScenarioRegistry({ preferStatic: true });
  });

  test('applies optimistic scenario', () => {
    const { inputs } = registry.apply('scn_optimistic', { revenue: 1000, cogs: 400 });
    expect(inputs.revenue).toBe(1200);
    expect(inputs.cogs).toBe(380);
  });

  test('expected scenario leaves inputs unchanged', () => {
    const { inputs } = registry.apply('scn_expected', { revenue: 1000 });
    expect(inputs.revenue).toBe(1000);
  });

  test('apply modifier parses absolute number', () => {
    expect(applyModifier(100, 150)).toBe(150);
  });

  test('apply modifier handles relative', () => {
    expect(applyModifier(100, '*1.1')).toBeCloseTo(110);
    expect(applyModifier(100, '+5')).toBe(105);
  });
});
