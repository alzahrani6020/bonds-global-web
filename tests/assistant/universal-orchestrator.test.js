const {
  capabilityCatalog,
  plannerCapabilityCatalog,
  plannerDiscoveryLimit,
  totalBudgetMs,
  plannerCallBudgetMs,
  plannerInferenceOptions,
  plannerInferenceIdentity,
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
      expect(totalBudgetMs()).toBe(240000);
      expect(plannerCallBudgetMs(240000)).toBe(115000);

      process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS = '999999';
      process.env.ASSISTANT_PLANNER_TIMEOUT_MS = '999999';
      expect(totalBudgetMs()).toBe(280000);
      expect(plannerCallBudgetMs(280000)).toBe(120000);
    } finally {
      if (originalTotal === undefined) delete process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS;
      else process.env.ASSISTANT_ORCHESTRATOR_BUDGET_MS = originalTotal;
      if (originalPlanner === undefined) delete process.env.ASSISTANT_PLANNER_TIMEOUT_MS;
      else process.env.ASSISTANT_PLANNER_TIMEOUT_MS = originalPlanner;
    }
  });

  test('planner keeps recoverable retry inside the single call budget', () => {
    const originalRetries = process.env.BONDS_NATIVE_RECOVERABLE_GENERATE_RETRIES;
    const originalDelay = process.env.BONDS_NATIVE_RECOVERABLE_RETRY_DELAY_MS;
    try {
      process.env.BONDS_NATIVE_RECOVERABLE_GENERATE_RETRIES = '1';
      process.env.BONDS_NATIVE_RECOVERABLE_RETRY_DELAY_MS = '750';

      const options = plannerInferenceOptions({}, 240000);

      expect(options.recoverableGenerateRetries).toBe(1);
      expect(options.recoverableGenerateRetryDelayMs).toBe(750);
      expect(options.timeoutMs).toBe(57125);
      expect(
        (options.timeoutMs * (options.recoverableGenerateRetries + 1)) +
        options.recoverableGenerateRetryDelayMs
      ).toBeLessThanOrEqual(plannerCallBudgetMs(240000));
    } finally {
      if (originalRetries === undefined) delete process.env.BONDS_NATIVE_RECOVERABLE_GENERATE_RETRIES;
      else process.env.BONDS_NATIVE_RECOVERABLE_GENERATE_RETRIES = originalRetries;
      if (originalDelay === undefined) delete process.env.BONDS_NATIVE_RECOVERABLE_RETRY_DELAY_MS;
      else process.env.BONDS_NATIVE_RECOVERABLE_RETRY_DELAY_MS = originalDelay;
    }
  });

  test('exposes registered read/compute capabilities to the planner and marks mutations as confirmation-required', () => {
    const catalog = capabilityCatalog();
    expect(catalog.some(item => item.action === 'web_search' && item.autonomous === true)).toBe(true);
    expect(catalog.some(item => item.action === 'financial_analysis_run' && item.autonomous === true)).toBe(true);
    expect(catalog.some(item => item.confirmation_required === true)).toBe(true);
  });

  test('planner prompt keeps every registered capability while minimizing Native prefill payload', () => {
    const full = capabilityCatalog();
    const compact = plannerCapabilityCatalog();

    expect(compact).toHaveLength(full.length);
    expect(compact.map(item => item.a)).toEqual(full.map(item => item.action));
    expect(compact.some(item => item.a === 'web_search')).toBe(true);
    expect(compact.some(item => item.a === 'financial_analysis_run')).toBe(true);
    expect(compact.some(item => item.c === 1)).toBe(true);
    expect(compact.every(item => !Object.prototype.hasOwnProperty.call(item, 'p'))).toBe(true);
    expect(JSON.stringify(compact).length).toBeLessThan(7000);
  });

  test('discovers a bounded planner capability subset for a concrete request', () => {
    const compact = plannerCapabilityCatalog('حلل المخاطر والتمويل للشركة', []);

    expect(compact.length).toBeGreaterThan(0);
    expect(compact.length).toBeLessThanOrEqual(plannerDiscoveryLimit());
    expect(compact.some(item => /risk|credit|funding/.test(item.a))).toBe(true);
    expect(compact.some(item => item.a === 'ai_reason')).toBe(false);
    expect(compact.some(item => item.a === 'native_generate')).toBe(false);
    expect(compact.some(item => item.a === 'native_health')).toBe(false);
  });

  test('discovers accounting journal capability from Arabic accounting language', () => {
    const compact = plannerCapabilityCatalog('جهز القيد المحاسبي', []);

    expect(compact.some(item => item.a === 'accounting_journal_post')).toBe(true);
  });

  test('planner discovery keeps previous action context available for replanning', () => {
    const compact = plannerCapabilityCatalog(
      'تحقق من النتيجة ثم أكمل',
      [{ action:'web_search', ok:false }]
    );

    expect(compact.some(item => item.a === 'web_search' || /web|research|evidence/.test(item.a))).toBe(true);
  });

  test('planner discovery limit remains bounded and configurable', () => {
    const original = process.env.ASSISTANT_PLANNER_CAPABILITY_LIMIT;
    try {
      delete process.env.ASSISTANT_PLANNER_CAPABILITY_LIMIT;
      expect(plannerDiscoveryLimit()).toBe(24);

      process.env.ASSISTANT_PLANNER_CAPABILITY_LIMIT = '999';
      expect(plannerDiscoveryLimit()).toBe(40);

      process.env.ASSISTANT_PLANNER_CAPABILITY_LIMIT = '1';
      expect(plannerDiscoveryLimit()).toBe(8);
    } finally {
      if (original === undefined) delete process.env.ASSISTANT_PLANNER_CAPABILITY_LIMIT;
      else process.env.ASSISTANT_PLANNER_CAPABILITY_LIMIT = original;
    }
  });

  test('binds default planner identity to the certified BONDS Native model', () => {
    expect(plannerInferenceIdentity({
      inferenceProviderId:'BONDS_NATIVE'
    }, 240000)).toMatchObject({
      provider_id:'BONDS_NATIVE',
      model_id:'bonds-native',
      runtime_model:'bonds-native'
    });

    const compact = plannerCapabilityCatalog(
      'حلل المخاطر والتمويل للشركة',
      [],
      { modelId:'bonds-native', enforceModelPassport:true }
    );

    expect(compact.length).toBeGreaterThan(0);
    expect(compact.some(item => /risk|credit|funding/.test(item.a))).toBe(true);
  });

  test('fails closed when planner model identity has no registered passport', () => {
    const compact = plannerCapabilityCatalog(
      'حلل المخاطر والتمويل للشركة',
      [{ action:'web_search', ok:true }],
      { modelId:'qwen-local-unqualified', enforceModelPassport:true }
    );

    expect(compact).toEqual([]);
  });

  test('fails closed when model binding is enforced but model identity is missing', () => {
    expect(plannerCapabilityCatalog(
      'حلل البيانات',
      [],
      { modelId:null, enforceModelPassport:true }
    )).toEqual([]);

    expect(plannerCapabilityCatalog(
      '',
      [],
      { modelId:null, enforceModelPassport:true }
    )).toEqual([]);
  });

  test('Ollama without model certification receives no site capabilities in planner prompt', async () => {
    executeGovernedAction.mockResolvedValueOnce({
      ok:true,
      result:{
        result:{
          text:'{"mode":"answer","answer":"إجابة مباشرة"}'
        }
      }
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'اشرح لي مفهوم التدفق النقدي' }],
      {},
      {
        req:{ headers:{} },
        user:{ id:'u1' },
        supabase:{},
        inferenceProviderId:'OLLAMA',
        ollamaModel:'qwen3:8b',
        ollamaModelId:'qwen-local-unqualified'
      }
    );

    expect(result.ok).toBe(true);
    expect(result.reply).toContain('إجابة مباشرة');
    expect(executeGovernedAction).toHaveBeenCalledTimes(1);

    const call = executeGovernedAction.mock.calls[0][0];
    expect(call.action).toBe('ai_reason');
    expect(call.input.prompt).toContain('CAPABILITY_DISCOVERY_COUNT=0');
    expect(call.input.prompt).toContain('CAPABILITIES=[]');
    expect(call.input.prompt).toContain('"model_id":"qwen-local-unqualified"');
    expect(call.runtimeContext).toMatchObject({
      providerId:'OLLAMA',
      ollamaModel:'qwen3:8b',
      ollamaModelId:'qwen-local-unqualified'
    });
  });

  test('parses only registered planner decisions', () => {
    expect(parseDecision('{"mode":"tool","action":"web_search","input":{"query":"test"}}'))
      .toEqual({ mode:'tool', action:'web_search', input:{ query:'test' } });
    expect(parseDecision('{"mode":"tool","action":"invented_action","input":{}}')).toBeNull();
  });

  test('rejects a registered action when it was not exposed by discovery for that planner turn', () => {
    const allowed = new Set(['web_search']);

    expect(parseDecision(
      '{"mode":"tool","action":"financial_analysis_run","input":{}}',
      allowed
    )).toBeNull();

    expect(parseDecision(
      '{"mode":"tool","action":"web_search","input":{"query":"test"}}',
      allowed
    )).toEqual({ mode:'tool', action:'web_search', input:{ query:'test' } });
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
      if (action === 'web_fetch') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{
            text:'<p>طلال حسن الزهراني أكاديمي ومستشار مالي، وهو رئيس مجلس إدارة بوندز منذ 2019.</p>',
            content_type:'text/html'
          }
        };
      }
      if (action === 'evidence_verify') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'compute' },
          result:{ verification_state:'SUPPORTED', supported_claims:[], contradictions:[] }
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
    expect(result.reply).toContain('منذ 2019');
    expect(result.reply).toContain('https://bonds-global.com/');
    const actions = result.trace.map(item => item.action);
    expect(actions).toEqual(['web_search', 'web_fetch', 'evidence_verify']);
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);
    const searchInput = executeGovernedAction.mock.calls.find(call => call[0].action === 'web_search')[0].input;
    expect(searchInput.query).toBe('طلال حسن الزهراني');
    expect(searchInput.disabledProviders).toEqual(['searxng']);
  });

  test('shows search excerpts for a news question and drops weak pages', async () => {
    executeGovernedAction.mockImplementation(async ({ action }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{
            results:[
              { title:'خبر الذهب', url:'https://example.com/gold', snippet:'سعر الذهب تحرك اليوم.' },
              { title:'يوتيوب', url:'https://www.youtube.com/watch?v=1', snippet:'مقطع' },
              { title:'وسم', url:'https://example.com/tag/gold', snippet:'وسم ذهب' }
            ]
          }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'أحدث أخبار الذهب' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.planner).toBe('universal-v2-deterministic-research');
    expect(result.reply).toContain('سعر الذهب تحرك اليوم.');
    expect(result.reply).toContain('https://example.com/gold');
    expect(result.reply).not.toContain('youtube.com');
    expect(result.reply).not.toContain('/tag/');
    expect(result.trace.map(item => item.action)).toEqual(['web_search']);
  });

  test('stops after an empty public search instead of calling the planner', async () => {
    executeGovernedAction.mockImplementation(async ({ action }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'web_search') {
        return { ok:true, executed:true, action, action_fabric:{ side_effect:'network_read' }, result:{ results:[] } };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'من وزير الداخلية' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.reply).toBe('البحث لم يُرجع صفحات.');
    expect(result.trace.map(item => item.action)).toEqual(['web_search']);
    const searchInput = executeGovernedAction.mock.calls.find(call => call[0].action === 'web_search')[0].input;
    expect(searchInput.query).toBe('وزير الداخلية');
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


  test('resolves official URL follow-up from the prior verified assistant answer without tools', async () => {
    executeGovernedAction.mockImplementation(async () => {
      throw new Error('NO_TOOL_SHOULD_RUN_FOR_CONTEXT_URL_FOLLOWUP');
    });

    const result = await runUniversalOrchestrator(
      [
        { role:'user', content:'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.' },
        { role:'assistant', content:'وزارة المالية\nhttps://www.mof.gov.sa/' },
        { role:'user', content:'ما الرابط الرسمي الذي وجدته في الإجابة السابقة؟ أجب بالرابط فقط.' }
      ],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.reply).toBe('https://www.mof.gov.sa/');
    expect(result.planner).toBe('universal-v2-context-followup');
    expect(result.toolUsed).toBe(false);
    expect(executeGovernedAction).not.toHaveBeenCalled();
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
