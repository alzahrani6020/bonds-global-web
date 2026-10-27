const {
  capabilityCatalog,
  totalBudgetMs,
  plannerCallBudgetMs,
  parseDecision,
  explicitMutationConfirmation,
  runUniversalOrchestrator
} = require('../../lib/assistant/universal-orchestrator');

jest.mock('../../lib/services/service-execution-router', () => ({
  executeGovernedAction: jest.fn()
}));

const { executeGovernedAction } = require('../../lib/services/service-execution-router');

describe('BONDS planner-first universal orchestrator', () => {
  beforeEach(() => {
    executeGovernedAction.mockReset();
  });

  test('budgets allow the measured native planner latency and remain bounded', () => {
    const originalTotal = process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS;
    const originalPlanner = process.env.ASSISTANT_PLANNER_TIMEOUT_MS;
    try {
      delete process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS;
      delete process.env.ASSISTANT_PLANNER_TIMEOUT_MS;
      expect(totalBudgetMs()).toBe(55000);
      expect(plannerCallBudgetMs(55000)).toBe(22000);

      process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS = '999999';
      process.env.ASSISTANT_PLANNER_TIMEOUT_MS = '999999';
      expect(totalBudgetMs()).toBe(60000);
      expect(plannerCallBudgetMs(60000)).toBe(25000);
    } finally {
      if (originalTotal === undefined) delete process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS;
      else process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS = originalTotal;
      if (originalPlanner === undefined) delete process.env.ASSISTANT_PLANNER_TIMEOUT_MS;
      else process.env.ASSISTANT_PLANNER_TIMEOUT_MS = originalPlanner;
    }
  });

  test('exposes registered read/compute capabilities to the planner and marks mutations as confirmation-required', () => {
    const catalog = capabilityCatalog();
    expect(catalog.some(item => item.action === 'web_search' && item.autonomous === true)).toBe(true);
    expect(catalog.some(item => item.action === 'financial_analysis_run' && item.autonomous === true)).toBe(true);
    expect(catalog.some(item => item.confirmation_required === true)).toBe(true);
  });

  test('parses only registered planner decisions', () => {
    expect(parseDecision('{"mode":"tool","action":"web_search","input":{"query":"test"}}'))
      .toEqual({ mode:'tool', action:'web_search', input:{ query:'test' } });
    expect(parseDecision('{"mode":"tool","action":"invented_action","input":{}}')).toBeNull();
  });

  test('uses planner first and can replan after an empty/failed search instead of failing the turn', async () => {
    executeGovernedAction
      .mockResolvedValueOnce({
        ok:true,
        result:{ result:{ text:'{"mode":"tool","action":"web_search","input":{"query":"طلال حسن الزهراني"}}' } }
      })
      .mockResolvedValueOnce({
        ok:false,
        executed:true,
        action:'web_search',
        action_fabric:{ side_effect:'network_read' },
        error:{ code:'SEARCH_NO_RESULTS' }
      })
      .mockResolvedValueOnce({
        ok:true,
        result:{ result:{ text:'{"mode":"tool","action":"web_search","input":{"query":"طلال حسن الزهراني بوندز"}}' } }
      })
      .mockResolvedValueOnce({
        ok:true,
        action:'web_search',
        action_fabric:{ side_effect:'network_read' },
        result:{ results:[{ title:'BONDS', url:'https://bonds-global.com/', snippet:'طلال حسن الزهراني' }] }
      })
      .mockResolvedValueOnce({
        ok:true,
        result:{ result:{ text:'{"mode":"answer","answer":"وجدت نتيجة موثقة مرتبطة بالاسم."}' } }
      });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'من هو الدكتور طلال حسن الزهراني؟' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.reply).toBe('وجدت نتيجة موثقة مرتبطة بالاسم.');
    expect(result.trace.map(item => item.action)).toEqual(['web_search','web_search']);
    expect(executeGovernedAction.mock.calls[0][0].action).toBe('ai_reason');
    expect(executeGovernedAction.mock.calls[1][0].action).toBe('web_search');
    expect(executeGovernedAction.mock.calls[2][0].action).toBe('ai_reason');
  });

  test('does not execute a mutating action without explicit confirmation', async () => {
    executeGovernedAction.mockResolvedValueOnce({
      ok:true,
      result:{ result:{ text:'{"mode":"tool","action":"accounting_journal_post","input":{"entry_id":"x"}}' } }
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'جهز القيد المحاسبي' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.confirmationRequired).toBe(true);
    expect(result.pendingAction.action).toBe('accounting_journal_post');
    expect(executeGovernedAction).toHaveBeenCalledTimes(1);
  });

  test('recognizes explicit execution confirmation text', () => {
    expect(explicitMutationConfirmation([{ role:'user', content:'نفذ الآن' }], 'accounting_journal_post')).toBe(true);
    expect(explicitMutationConfirmation([{ role:'user', content:'جهزه فقط' }], 'accounting_journal_post')).toBe(false);
  });
});
