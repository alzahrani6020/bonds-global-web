const { EvidenceRegistry } = require('../../lib/ucp/evidence-registry');

describe('UCP Evidence Registry', () => {
  test('collects evidence items', () => {
    const registry = new EvidenceRegistry();
    registry.addFormula('net_profit', 'revenue - total_costs', 400);
    registry.addRule('rule_dscr_minimum', { pass: true });
    registry.addInput('revenue', 1000);
    expect(registry.list().length).toBe(3);
    expect(registry.list()[0].evidence_type).toBe('formula');
  });
});
