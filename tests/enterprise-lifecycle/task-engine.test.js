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

  test('completeTask validates requiredFields rule', async () => {
    const task = await store.createTask({
      instance_id: 'i1',
      stage_id: 'idea',
      task_code: 't1',
      title: 'Task 1',
      status: 'pending',
      completion_rules: { requiredFields: ['project.name'] }
    });

    const fail = await engine.completeTask({ taskId: task.id, store, completedBy: 'u1', context: {} });
    expect(fail.success).toBe(false);
    expect(fail.failures.length).toBeGreaterThan(0);

    const pass = await engine.completeTask({ taskId: task.id, store, completedBy: 'u1', context: { project: { name: 'X' } } });
    expect(pass.success).toBe(true);
    expect(pass.task.status).toBe('completed');
  });

  test('completeTask validates expression rule', async () => {
    const task = await store.createTask({
      instance_id: 'i1',
      stage_id: 'idea',
      task_code: 't2',
      title: 'Task 2',
      status: 'pending',
      completion_rules: { expression: 'readiness.score >= 70' }
    });

    const fail = await engine.completeTask({ taskId: task.id, store, completedBy: 'u1', context: { readiness: { score: 50 } } });
    expect(fail.success).toBe(false);

    const pass = await engine.completeTask({ taskId: task.id, store, completedBy: 'u1', context: { readiness: { score: 80 } } });
    expect(pass.success).toBe(true);
  });

  test('completeTask validates minEvidence rule', async () => {
    const task = await store.createTask({
      instance_id: 'i1',
      stage_id: 'idea',
      task_code: 't3',
      title: 'Task 3',
      status: 'pending',
      completion_rules: { minEvidence: 2 }
    });

    const fail = await engine.completeTask({ taskId: task.id, store, completedBy: 'u1', evidence: ['one'] });
    expect(fail.success).toBe(false);

    const pass = await engine.completeTask({ taskId: task.id, store, completedBy: 'u1', evidence: ['one', 'two'] });
    expect(pass.success).toBe(true);
  });
});
