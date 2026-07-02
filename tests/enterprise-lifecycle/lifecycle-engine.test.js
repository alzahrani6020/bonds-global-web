const { LifecycleEngine } = require('../../lib/enterprise-lifecycle');

describe('LifecycleEngine', () => {
  let engine;

  beforeEach(async () => {
    engine = await new LifecycleEngine({ adapters: [] }).initialize();
  });

  test('creates project instance at initial stage', async () => {
    const { instance, tasks } = await engine.createInstance({
      entityType: 'project', entityId: 'p1', userId: 'u1'
    });
    expect(instance.current_stage).toBe('idea');
    expect(instance.workflow_code).toBe('project-investment-lifecycle');
    expect(tasks.length).toBeGreaterThan(0);
  });

  test('transitions through gates with sufficient context', async () => {
    const { instance } = await engine.createInstance({
      entityType: 'project', entityId: 'p2', userId: 'u1'
    });
    const result = await engine.transition(instance.id, 'feasibility', {
      userId: 'u1',
      reason: 'info complete',
      context: {
        project: { name: 'Cafe', sector: 'restaurant', city_id: 'c1', capital: 200000 }
      }
    });
    expect(result.success).toBe(true);
    expect(result.instance.current_stage).toBe('feasibility');
  });

  test('getState returns allowed transitions and critical path', async () => {
    const { instance } = await engine.createInstance({
      entityType: 'project', entityId: 'p3', userId: 'u1'
    });
    const state = await engine.getState(instance.id);
    expect(state.currentStage).toBe('idea');
    expect(state.allowedTransitions.some(t => t.to === 'feasibility')).toBe(true);
    expect(state.criticalPath[0]).toBe('idea');
  });

  test('request and submit approval enables transition', async () => {
    const { instance } = await engine.createInstance({
      entityType: 'project', entityId: 'p4', userId: 'u1'
    });
    await engine.transition(instance.id, 'feasibility', {
      userId: 'u1',
      context: { project: { name: 'X', sector: 'retail', city_id: 'c1', capital: 100000 } }
    });
    await engine.transition(instance.id, 'valuation', {
      userId: 'u1',
      context: { ucp: { confidence: 75 } }
    });
    await engine.transition(instance.id, 'funding', {
      userId: 'u1',
      context: { valuation: { confidence: 80 }, financing: { loan_amount: 50000, interest_rate: 5 } }
    });
    await engine.transition(instance.id, 'investment_readiness', {
      userId: 'u1',
      context: { financing: { loan_amount: 50000, interest_rate: 5 } }
    });

    const approval = await engine.requestApproval(instance.id, {
      transitionKey: 'investment_readiness->investment_memorandum',
      requestedBy: 'u1'
    });
    await engine.submitApproval(approval.id, {
      userId: 'u2', role: 'advisor', decision: 'approved', reason: 'ok'
    });

    const result = await engine.transition(instance.id, 'investment_memorandum', {
      userId: 'u1',
      context: { readiness: { readinessScore: 80 } },
      approvalId: approval.id
    });
    expect(result.success).toBe(true);
    expect(result.instance.current_stage).toBe('investment_memorandum');
  });

  test('rollback returns to previous stage', async () => {
    const { instance } = await engine.createInstance({
      entityType: 'project', entityId: 'p5', userId: 'u1'
    });
    await engine.transition(instance.id, 'feasibility', {
      userId: 'u1',
      context: { project: { name: 'Y', sector: 'retail', city_id: 'c1', capital: 100000 } }
    });
    const result = await engine.rollback(instance.id, { userId: 'u1', reason: 'needs rework' });
    expect(result.success).toBe(true);
    expect(result.instance.current_stage).toBe('idea');
  });

  test('timeline aggregates entries', async () => {
    const { instance } = await engine.createInstance({
      entityType: 'project', entityId: 'p6', userId: 'u1'
    });
    await engine.transition(instance.id, 'feasibility', {
      userId: 'u1',
      context: { project: { name: 'Z', sector: 'retail', city_id: 'c1', capital: 100000 } }
    });
    const timeline = await engine.getTimeline(instance.id);
    expect(timeline.length).toBeGreaterThan(0);
  });
});
