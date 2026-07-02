const { TaskEngine } = require('../../lib/enterprise-lifecycle/task-engine');
const { MemoryLifecycleStore } = require('../../lib/enterprise-lifecycle/store/memory-store');
const { LifecycleRegistry } = require('../../lib/enterprise-lifecycle/lifecycle-registry');

describe('TaskEngine', () => {
  let store;
  let engine;
  let registry;

  beforeAll(async () => {
    registry = new LifecycleRegistry({ preferStatic: true });
    await registry.load();
  });

  beforeEach(() => {
    store = new MemoryLifecycleStore();
    engine = new TaskEngine(registry);
  });

  test('generates tasks for a stage', async () => {
    const tasks = await engine.generateTasks({
      instanceId: 'i1', stageCode: 'idea', workflowCode: 'project-investment-lifecycle', store
    });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].stage_id).toBe('idea');
    expect(tasks[0].status).toBe('pending');
  });

  test('completes pending stage tasks', async () => {
    await engine.generateTasks({
      instanceId: 'i1', stageCode: 'idea', workflowCode: 'project-investment-lifecycle', store
    });
    const completed = await engine.completeStageTasks({ instanceId: 'i1', stageCode: 'idea', store, completedBy: 'u1' });
    expect(completed.length).toBeGreaterThan(0);
    expect(completed[0].status).toBe('completed');
  });
});
