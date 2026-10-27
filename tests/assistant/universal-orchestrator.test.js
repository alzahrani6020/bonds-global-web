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

  test('routes clear person lookup through deterministic research without ai_reason', async () => {
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') {
        throw new Error('AI_REASON_MUST_NOT_RUN_FOR_CLEAR_RESEARCH');
      }
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{
            query:input.query,
            results:[
              { title:'الدكتور طلال حسن الزهراني | بوندز', url:'https://bonds-global.com/', snippet:'طلال حسن الزهراني مستشار وخبير مالي.' }
            ]
          }
        };
      }
      if (action === 'web_explore') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{
            pages:[{
              url:'https://bonds-global.com/',
              evidence:{ content_type:'text/html', headers:{} },
              extracted:{ format:'html', title:'الدكتور طلال حسن الزهراني | بوندز', text:'طلال حسن الزهراني مستشار وخبير مالي.' }
            }]
          }
        };
      }
      if (action === 'evidence_verify') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'compute' },
          result:{
            verification_state:'SUPPORTED',
            source_count:1,
            independent_publisher_count:1,
            supported_claims:[],
            contradictions:[],
            residual_uncertainty:[],
            sources:input.sources
          }
        };
      }
      if (action === 'research_synthesize') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'compute' },
          result:{ verification_state:'SUPPORTED', known:[], unknown:[], contradictions:[] }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'من هو الدكتور طلال حسن الزهراني؟' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    const webSearchCalls = executeGovernedAction.mock.calls
      .filter(call => call[0].action === 'web_search');
    expect(webSearchCalls.length).toBeGreaterThan(0);
    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-research');
    expect(result.toolUsed).toBe(true);
    expect(result.research.decision_eligible).toBe(true);
    expect(result.research.answer_synthesis_ms).toBe(0);
    const actions = result.trace.map(item => item.action);
    expect(actions).toContain('web_search');
    expect(actions).toContain('web_explore');
    expect(actions).toContain('evidence_verify');
    expect(actions).toContain('research_synthesize');
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);
  });

  test('routes exact production official URL question through deterministic research without ai_reason', async () => {
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') {
        throw new Error('AI_REASON_MUST_NOT_RUN_FOR_OFFICIAL_URL');
      }
      if (action === 'web_search') {
        throw new Error('WEB_SEARCH_MUST_NOT_RUN_FOR_REGISTERED_OFFICIAL_URL');
      }
      if (action === 'web_explore') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{
            pages:[{
              url:'https://www.mof.gov.sa/',
              evidence:{ content_type:'text/html', headers:{} },
              extracted:{ format:'html', title:'وزارة المالية', text:'الموقع الرسمي لوزارة المالية السعودية' }
            }]
          }
        };
      }
      if (action === 'evidence_verify') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'compute' },
          result:{
            verification_state:'SUPPORTED',
            source_count:1,
            independent_publisher_count:1,
            supported_claims:[],
            contradictions:[],
            residual_uncertainty:[],
            sources:input.sources
          }
        };
      }
      if (action === 'research_synthesize') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'compute' },
          result:{ verification_state:'SUPPORTED', known:[], unknown:[], contradictions:[] }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-research');
    expect(result.reply).toContain('mof.gov.sa');
    expect(result.research.answer_synthesis_ms).toBe(0);
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'web_search')).toBe(false);
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);
  });

  test('resolves the exact production prior-link follow-up without invoking the planner', async () => {
    executeGovernedAction.mockImplementation(async () => {
      throw new Error('NO_ACTION_MUST_RUN_FOR_PRIOR_URL_FOLLOWUP');
    });

    const result = await runUniversalOrchestrator(
      [
        { role:'user', content:'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.' },
        { role:'assistant', content:'وزارة المالية السعودية\nhttps://www.mof.gov.sa/' },
        { role:'user', content:'ما الرابط الرسمي الذي وجدته في الإجابة السابقة؟ أجب بالرابط فقط.' }
      ],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.reply).toBe('https://www.mof.gov.sa/');
    expect(result.planner).toBe('universal-v2-deterministic-followup');
    expect(result.steps).toBe(0);
    expect(result.toolUsed).toBe(false);
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });

  test('does not invent a prior URL when the assistant never provided one', () => {
    const { previousAssistantUrlFollowUp } = require('../../lib/assistant/universal-orchestrator');
    expect(previousAssistantUrlFollowUp([
      { role:'assistant', content:'لم أذكر رابطاً موثقاً.' },
      { role:'user', content:'ما الرابط الذي ذكرته سابقاً؟ أجب بالرابط فقط.' }
    ])).toBeNull();
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
