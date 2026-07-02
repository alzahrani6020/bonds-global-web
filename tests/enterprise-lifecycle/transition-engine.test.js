const { LifecycleRegistry } = require('../../lib/enterprise-lifecycle/lifecycle-registry');
const { GateEngine } = require('../../lib/enterprise-lifecycle/gate-engine');
const { ApprovalEngine } = require('../../lib/enterprise-lifecycle/approval-engine');
const { TaskEngine } = require('../../lib/enterprise-lifecycle/task-engine');
const { EventBus } = require('../../lib/enterprise-lifecycle/event-bus');
const { TimelineEngine } = require('../../lib/enterprise-lifecycle/timeline-engine');
const { TransitionEngine } = require('../../lib/enterprise-lifecycle/transition-engine');
const { MemoryLifecycleStore } = require('../../lib/enterprise-lifecycle/store/memory-store');

describe('TransitionEngine', () => {
  let registry;
  let engine;
  let store;

  beforeAll(async () => {
    registry = new LifecycleRegistry({ preferStatic: true });
    await registry.load();
  });

  beforeEach(() => {
    store = new MemoryLifecycleStore();
    engine = new TransitionEngine({
      registry,
      gateEngine: new GateEngine(),
      approvalEngine: new ApprovalEngine(),
      taskEngine: new TaskEngine(registry),
      eventBus: new EventBus(),
      timelineEngine: new TimelineEngine()
    });
  });

  test('evaluateTransition allows idea->feasibility with complete context', async () => {
    const instance = { id: 'i1', workflow_code: 'project-investment-lifecycle', current_stage: 'idea', previous_stage: null, context: {} };
    const context = {
      project: { name: 'Test', sector: 'restaurant', city_id: 'c1', capital: 100000 }
    };
    const result = await engine.evaluateTransition({ instance, toStage: 'feasibility', context, userId: 'u1', reason: 'ready' });
    expect(result.allowed).toBe(true);
    expect(result.gateResult.passed).toBe(true);
  });

  test('evaluateTransition blocks when gate fails', async () => {
    const instance = { id: 'i1', workflow_code: 'project-investment-lifecycle', current_stage: 'idea', previous_stage: null, context: {} };
    const result = await engine.evaluateTransition({ instance, toStage: 'feasibility', context: {}, userId: 'u1' });
    expect(result.allowed).toBe(false);
    expect(result.gateResult.passed).toBe(false);
  });

  test('executeTransition moves state and creates tasks/events', async () => {
    const instance = await store.createInstance({
      entity_id: 'e1', entity_type: 'project', workflow_code: 'project-investment-lifecycle',
      current_stage: 'idea', previous_stage: null
    });
    const context = {
      project: { name: 'Test', sector: 'restaurant', city_id: 'c1', capital: 100000 }
    };
    const result = await engine.executeTransition({
      instance, toStage: 'feasibility', context, userId: 'u1', reason: 'ready', store
    });
    expect(result.success).toBe(true);
    expect(result.instance.current_stage).toBe('feasibility');
    expect(result.tasks.length).toBeGreaterThan(0);
    const events = await store.listEvents(instance.id);
    expect(events.some(e => e.event_type === 'ProjectEnteredStage')).toBe(true);
  });

  test('executeTransition creates approval when required', async () => {
    const instance = await store.createInstance({
      entity_id: 'e1', entity_type: 'project', workflow_code: 'project-investment-lifecycle',
      current_stage: 'investment_readiness', previous_stage: 'funding'
    });
    const context = { readiness: { readinessScore: 80 } };
    const result = await engine.executeTransition({
      instance, toStage: 'investment_memorandum', context, userId: 'u1', reason: 'ready', store
    });
    expect(result.success).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalId).toBeDefined();
  });
});
