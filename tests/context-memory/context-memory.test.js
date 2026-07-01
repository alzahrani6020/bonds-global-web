const { ContextMemory } = require('../../lib/context-memory/context-memory');

describe('Context Memory', () => {
  it('updates and retrieves context without supabase', async () => {
    const memory = new ContextMemory(null);
    const updated = await memory.update('p1', {
      lastReportId: 'r1',
      lastAssumptions: { growth: 0.05 }
    });
    expect(updated.last_report_id).toBe('r1');
    expect(updated.last_assumptions.growth).toBe(0.05);
  });

  it('remembers recent entities', async () => {
    const memory = new ContextMemory(null);
    await memory.rememberEntity('p1', 'report', 'r1');
    const result = await memory.rememberEntity('p1', 'valuation', 'v1');
    expect(result.recent_entities).toHaveLength(2);
    expect(result.recent_entities[0].type).toBe('valuation');
  });
});
