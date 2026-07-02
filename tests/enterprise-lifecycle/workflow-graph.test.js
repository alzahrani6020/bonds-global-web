const { WorkflowGraph } = require('../../lib/enterprise-lifecycle/workflow-graph');
const { LifecycleRegistry } = require('../../lib/enterprise-lifecycle/lifecycle-registry');

describe('WorkflowGraph', () => {
  let workflow;

  beforeAll(async () => {
    const registry = new LifecycleRegistry({ preferStatic: true });
    await registry.load();
    workflow = registry.getWorkflow('project-investment-lifecycle');
  });

  test('next stages from idea', () => {
    const graph = new WorkflowGraph(workflow);
    expect(graph.nextStages('idea')).toContain('feasibility');
  });

  test('previous stages from feasibility', () => {
    const graph = new WorkflowGraph(workflow);
    expect(graph.previousStages('feasibility')).toContain('idea');
  });

  test('exit is reachable from idea', () => {
    const graph = new WorkflowGraph(workflow);
    expect(graph.isReachable('idea', 'exit')).toBe(true);
  });

  test('idea is not reachable from exit', () => {
    const graph = new WorkflowGraph(workflow);
    expect(graph.isReachable('exit', 'idea')).toBe(false);
  });

  test('critical path includes first and last stages', () => {
    const graph = new WorkflowGraph(workflow);
    const path = graph.criticalPath();
    expect(path[0]).toBe('idea');
    expect(path[path.length - 1]).toBe('exit');
  });

  test('blocked paths from idea excludes reachable stages', () => {
    const graph = new WorkflowGraph(workflow);
    const blocked = graph.blockedPaths('idea');
    expect(blocked).not.toContain('feasibility');
  });

  test('parallelBranches returns parallel transitions', () => {
    const parallelWorkflow = {
      id: 'parallel-test',
      stages: ['start', 'a', 'b', 'join', 'end'],
      transitions: [
        { id: 't1', from: 'start', to: 'a', parallel: true, joinTo: 'join' },
        { id: 't2', from: 'start', to: 'b', parallel: true, joinTo: 'join' },
        { id: 't3', from: 'a', to: 'join' },
        { id: 't4', from: 'b', to: 'join' },
        { id: 't5', from: 'join', to: 'end' }
      ]
    };
    const graph = new WorkflowGraph(parallelWorkflow);
    const branches = graph.parallelBranches('start');
    expect(branches.length).toBe(2);
    expect(branches.map(b => b.to)).toEqual(['a', 'b']);
    expect(graph.hasParallelBranches('start')).toBe(true);
    expect(graph.joinStage('start')).toBe('join');
  });

  test('parallelBranches returns empty when no parallel transitions', () => {
    const graph = new WorkflowGraph(workflow);
    expect(graph.parallelBranches('idea')).toEqual([]);
    expect(graph.hasParallelBranches('idea')).toBe(false);
    expect(graph.joinStage('idea')).toBeNull();
  });
});
