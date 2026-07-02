const { ValuationAdapter } = require('../../lib/enterprise-lifecycle/integrations/valuation-adapter');

function createMockSupabase(rows) {
  return {
    from() { return this; },
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: rows, error: null }); }
  };
}

describe('ValuationAdapter', () => {
  test('enriches project context with bonds_valuations', async () => {
    const rows = [{
      id: 'v1',
      value: 1200000,
      confidence_score: 82,
      data_quality_score: 88,
      method: 'income',
      status: 'final',
      valuation_date: '2026-07-01',
      created_at: '2026-07-01T00:00:00Z'
    }];
    const adapter = new ValuationAdapter({ supabase: createMockSupabase(rows) });
    const context = await adapter.enrich({
      instance: { entity_type: 'project', entity_id: 'p1' },
      context: {}
    });
    expect(context.valuation).toBeDefined();
    expect(context.valuation.confidence).toBe(82);
    expect(context.valuation.value).toBe(1200000);
  });

  test('returns context unchanged when no valuation exists', async () => {
    const adapter = new ValuationAdapter({ supabase: createMockSupabase([]) });
    const context = await adapter.enrich({
      instance: { entity_type: 'project', entity_id: 'p2' },
      context: { existing: true }
    });
    expect(context.existing).toBe(true);
    expect(context.valuation).toBeUndefined();
  });
});
