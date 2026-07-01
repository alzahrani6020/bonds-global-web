const { VersionRegistry, isActive } = require('../../lib/ucp/version-registry');

describe('UCP Version Registry', () => {
  test('finds active version', () => {
    const registry = new VersionRegistry({
      versions: [
        { entity_type: 'formula', entity_code: 'net_profit', version: 1, status: 'active', approval_status: 'approved', effective_from: '2020-01-01' },
        { entity_type: 'formula', entity_code: 'net_profit', version: 2, status: 'active', approval_status: 'approved', effective_from: '2030-01-01' }
      ]
    });
    const active = registry.find('formula', 'net_profit', new Date('2025-01-01'));
    expect(active.version).toBe(1);
  });

  test('isActive respects effective dates', () => {
    expect(isActive({ status: 'active', effective_from: '2030-01-01' }, new Date('2025-01-01'))).toBe(false);
    expect(isActive({ status: 'active' }, new Date())).toBe(true);
  });
});
