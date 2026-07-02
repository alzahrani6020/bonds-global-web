const { ApprovalEngine } = require('../../lib/enterprise-lifecycle/approval-engine');
const { MemoryLifecycleStore } = require('../../lib/enterprise-lifecycle/store/memory-store');

describe('ApprovalEngine', () => {
  let store;
  let engine;

  beforeEach(() => {
    store = new MemoryLifecycleStore();
    engine = new ApprovalEngine();
  });

  test('single approval approves on first approval', async () => {
    const approval = await engine.createApproval({
      instanceId: 'i1', transitionId: 't1', stageId: 's1',
      rule: { type: 'single', approverRoles: ['manager'] },
      requestedBy: 'u1', store
    });
    const result = await engine.submitDecision({ approvalId: approval.id, userId: 'u2', role: 'manager', decision: 'approved', reason: 'ok', store });
    expect(result.status).toBe('approved');
  });

  test('single approval rejects on first rejection', async () => {
    const approval = await engine.createApproval({
      instanceId: 'i1', transitionId: 't1', stageId: 's1',
      rule: { type: 'single', approverRoles: ['manager'] },
      requestedBy: 'u1', store
    });
    const result = await engine.submitDecision({ approvalId: approval.id, userId: 'u2', role: 'manager', decision: 'rejected', reason: 'no', store });
    expect(result.status).toBe('rejected');
  });

  test('committee requires min approvals', async () => {
    const approval = await engine.createApproval({
      instanceId: 'i1', transitionId: 't1', stageId: 's1',
      rule: { type: 'committee', approverRoles: ['a', 'b', 'c'], minApprovals: 2 },
      requestedBy: 'u1', store
    });
    await engine.submitDecision({ approvalId: approval.id, userId: 'u2', role: 'a', decision: 'approved', reason: 'ok', store });
    let a2 = await engine.submitDecision({ approvalId: approval.id, userId: 'u3', role: 'b', decision: 'approved', reason: 'ok', store });
    expect(a2.status).toBe('approved');
  });

  test('sequential approval respects order', async () => {
    const approval = await engine.createApproval({
      instanceId: 'i1', transitionId: 't1', stageId: 's1',
      rule: { type: 'sequential', approverRoles: ['a', 'b'] },
      requestedBy: 'u1', store
    });
    await engine.submitDecision({ approvalId: approval.id, userId: 'u2', role: 'a', decision: 'approved', reason: 'ok', store });
    const result = await engine.submitDecision({ approvalId: approval.id, userId: 'u3', role: 'b', decision: 'approved', reason: 'ok', store });
    expect(result.status).toBe('approved');
  });
});
