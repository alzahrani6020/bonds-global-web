const { DecisionTimeline } = require('../../lib/timeline/decision-timeline');

describe('Decision Timeline', () => {
  it('records an event in memory', async () => {
    const timeline = new DecisionTimeline(null);
    const event = await timeline.record('prj-1', 'valuation', { value: 1000 });
    expect(event.project_id).toBe('prj-1');
    expect(event.event_type).toBe('valuation');
    expect(event.payload.value).toBe(1000);
  });

  it('returns empty timeline without supabase', async () => {
    const timeline = new DecisionTimeline(null);
    const events = await timeline.getTimeline('prj-1');
    expect(events).toEqual([]);
  });
});
