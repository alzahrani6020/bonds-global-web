const { EventBus } = require('../../lib/enterprise-lifecycle/event-bus');
const { MemoryLifecycleStore } = require('../../lib/enterprise-lifecycle/store/memory-store');

describe('EventBus', () => {
  test('subscriber receives emitted event', async () => {
    const bus = new EventBus();
    const handler = jest.fn();
    bus.subscribe('ProjectEnteredStage', handler);
    await bus.emit('ProjectEnteredStage', { stage: 'idea' });
    expect(handler).toHaveBeenCalledWith({ stage: 'idea' });
  });

  test('emitAndStore creates event record', async () => {
    const bus = new EventBus();
    const store = new MemoryLifecycleStore();
    const event = await bus.emitAndStore({
      instanceId: 'i1',
      eventType: 'ApprovalGranted',
      payload: { approvalId: 'a1' },
      source: 'test',
      store
    });
    expect(event.event_type).toBe('ApprovalGranted');
    const events = await store.listEvents('i1');
    expect(events.length).toBe(1);
  });
});
