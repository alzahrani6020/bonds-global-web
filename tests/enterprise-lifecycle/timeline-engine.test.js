const { TimelineEngine } = require('../../lib/enterprise-lifecycle/timeline-engine');
const { MemoryLifecycleStore } = require('../../lib/enterprise-lifecycle/store/memory-store');

describe('TimelineEngine', () => {
  test('builds timeline from transitions and events', async () => {
    const store = new MemoryLifecycleStore();
    const instance = await store.createInstance({
      entity_id: 'e1', entity_type: 'project', workflow_code: 'project-investment-lifecycle',
      current_stage: 'feasibility', previous_stage: 'idea'
    });
    const transition = await store.createTransition({
      instance_id: instance.id, from_stage: 'idea', to_stage: 'feasibility',
      triggered_by: 'u1', reason: 'ready', confidence_score: 80
    });
    await store.createEvent({ instance_id: instance.id, event_type: 'ProjectEnteredStage', payload: { stage: 'feasibility' } });

    const engine = new TimelineEngine();
    const timeline = await engine.buildTimeline(instance.id, store);
    expect(timeline.length).toBeGreaterThanOrEqual(3);
    expect(timeline.some(e => e.entry_type === 'transition')).toBe(true);
  });
});
