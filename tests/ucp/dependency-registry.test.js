const { DependencyRegistry } = require('../../lib/ucp/dependency-registry');

describe('UCP Dependency Registry', () => {
  test('tracks dependencies and reverse dependencies', () => {
    const registry = new DependencyRegistry();
    registry.add({ source_type: 'formula', source_code: 'gross_margin', depends_on_type: 'formula', depends_on_code: 'gross_profit' });
    registry.add({ source_type: 'output', source_code: 'gross_margin', depends_on_type: 'formula', depends_on_code: 'gross_margin' });

    expect(registry.getDependencies('formula', 'gross_margin').length).toBe(1);
    expect(registry.getDependents('formula', 'gross_profit').length).toBe(1);
  });

  test('infers formula dependencies', () => {
    const registry = new DependencyRegistry();
    registry.inferFromFormula('formula', 'net_profit', 'revenue - total_costs', new Set(['revenue', 'total_costs']), new Set());
    expect(registry.getDependencies('formula', 'net_profit')[0].code).toBe('revenue');
  });

  test('impact analysis returns downstream', () => {
    const registry = new DependencyRegistry();
    registry.add({ source_type: 'formula', source_code: 'b', depends_on_type: 'input', depends_on_code: 'a' });
    registry.add({ source_type: 'formula', source_code: 'c', depends_on_type: 'formula', depends_on_code: 'b' });
    const impacted = registry.impacted('input', 'a');
    expect(impacted.map(d => d.code)).toEqual(['b', 'c']);
  });
});
