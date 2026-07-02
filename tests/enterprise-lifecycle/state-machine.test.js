const { StateMachine } = require('../../lib/enterprise-lifecycle/state-machine');
const { LifecycleRegistry } = require('../../lib/enterprise-lifecycle/lifecycle-registry');

describe('StateMachine', () => {
  let registry;
  let workflow;

  beforeAll(async () => {
    registry = new LifecycleRegistry({ preferStatic: true });
    await registry.load();
    workflow = registry.getWorkflow('project-investment-lifecycle');
  });

  test('current state returns initial stage', () => {
    const instance = { current_stage: 'idea', previous_stage: null };
    const sm = new StateMachine({ instance, workflow });
    expect(sm.currentState()).toBe('idea');
  });

  test('allowed transitions from idea include feasibility', () => {
    const instance = { current_stage: 'idea', previous_stage: null };
    const sm = new StateMachine({ instance, workflow });
    const transitions = sm.allowedTransitions(registry);
    expect(transitions.some(t => t.to === 'feasibility')).toBe(true);
  });

  test('cannot transition to invalid stage', () => {
    const instance = { current_stage: 'idea', previous_stage: null };
    const sm = new StateMachine({ instance, workflow });
    const check = sm.canTransition('exit', registry);
    expect(check.allowed).toBe(false);
  });

  test('move updates state and previous stage', () => {
    const instance = { current_stage: 'idea', previous_stage: null };
    const sm = new StateMachine({ instance, workflow });
    sm.move('feasibility');
    expect(instance.current_stage).toBe('feasibility');
    expect(instance.previous_stage).toBe('idea');
  });

  test('rollback transition appears when previous stage exists and enabled', () => {
    const instance = { current_stage: 'feasibility', previous_stage: 'idea' };
    const sm = new StateMachine({ instance, workflow });
    const transitions = sm.allowedTransitions(registry);
    expect(transitions.some(t => t.isRollback && t.to === 'idea')).toBe(true);
  });

  test('final stage detection works', () => {
    const instance = { current_stage: 'exit', previous_stage: 'expansion' };
    const sm = new StateMachine({ instance, workflow });
    expect(sm.isFinal()).toBe(true);
  });
});
