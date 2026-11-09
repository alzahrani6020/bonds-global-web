/**
 * @jest-environment node
 */

const { runUniversalOrchestrator } = require('../../lib/assistant/universal-orchestrator');
const {
  ensureSingleEdgeGoalWorkflow,
  grantGoalWorkflowMandate,
  nextGoalWorkflowEdge
} = require('../../lib/assistant/goal-workflow');

jest.mock('../../lib/services/service-execution-router', () => ({
  executeGovernedAction: jest.fn()
}));

const { executeGovernedAction } = require('../../lib/services/service-execution-router');

function plannerTool(action, input = {}) {
  return {
    ok:true,
    result:{ result:{ text: JSON.stringify({ mode:'tool', action, input }) } }
  };
}

describe('universal orchestrator durable goal workflow gate', () => {
  beforeEach(() => {
    executeGovernedAction.mockReset();
  });

  test('does not bind free chat to a goal workflow', async () => {
    executeGovernedAction.mockResolvedValueOnce(plannerTool('web_search', { query:'hello' }));
    executeGovernedAction.mockResolvedValueOnce({
      ok:true,
      executed:true,
      action:'web_search',
      result:{ results:[] }
    });
    executeGovernedAction.mockResolvedValueOnce({
      ok:true,
      result:{ result:{ text: JSON.stringify({ mode:'answer', answer:'بحث عام بدون رحلة هدف.' }) } }
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'مرحبا' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.goal_workflow).toBeUndefined();
  });

  test('blocks a write on the current edge until the mandate is granted', async () => {
    const workflow = ensureSingleEdgeGoalWorkflow(null, {
      action:'accounting_journal_post',
      effect:'database_write',
      from:'execution',
      to:'review'
    });
    executeGovernedAction.mockResolvedValueOnce({
      ok:true,
      result:{ result:{ text:'{"mode":"tool","action":"accounting_journal_post","input":{"entry_id":"x"}}' } }
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'جهز القيد المحاسبي نفذ الآن' }],
      {},
      {
        req:{ headers:{} },
        user:{ id:'u1' },
        supabase:{},
        goalWorkflow: workflow,
        goalWorkflowBinding:{
          workflow_key:'assistant-case:test',
          boundary:'page:/ledger|service:accounting',
          expected_version:3
        }
      }
    );

    expect(result.failure).toBe('GOAL_WORKFLOW_MANDATE_REQUIRED');
    expect(result.confirmationRequired).toBe(true);
    expect(result.actions[0].workflow_binding).toMatchObject({
      workflow_key:'assistant-case:test',
      expected_version:3
    });
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'accounting_journal_post')).toBe(false);
  });

  test('executes a mandated write and completes the current edge', async () => {
    const pending = ensureSingleEdgeGoalWorkflow(null, {
      action:'accounting_journal_post',
      effect:'database_write',
      from:'execution',
      to:'review'
    });
    const authorized = grantGoalWorkflowMandate(pending, {
      edgeId: nextGoalWorkflowEdge(pending).id,
      capability:'accounting_journal_post',
      actionFingerprint:'fp-journal'
    });

    executeGovernedAction.mockImplementation(async ({ action }) => {
      if (action === 'accounting_journal_post') {
        return { ok:true, executed:true, action, result:{ posted:true } };
      }
      const alreadyPosted = executeGovernedAction.mock.calls.some(call => call[0].action === 'accounting_journal_post');
      const text = alreadyPosted
        ? '{"mode":"answer","answer":"تم ترحيل القيد."}'
        : '{"mode":"tool","action":"accounting_journal_post","input":{"entry_id":"x"}}';
      return { ok:true, result:{ result:{ text } } };
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'جهز القيد المحاسبي نفذ الآن' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{}, goalWorkflow: authorized }
    );

    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'accounting_journal_post')).toBe(true);
    expect(result.goal_workflow.status).toBe('completed');
    expect(result.goal_workflow.edges[0].status).toBe('completed');
  });
});
