const {
  CORE_PLANNER_ACTIONS,
  capabilityCatalog,
  plannerCapabilityCatalog,
  plannerDiscoveryLimit,
  totalBudgetMs,
  plannerCallBudgetMs,
  plannerInferenceOptions,
  plannerInferenceIdentity,
  parseDecision,
  recoverPlannerDecision,
  explicitMutationConfirmation,
  isFastPublicFact,
  isActualAccountingStatementRequest,
  actualAccountingRange,
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

  test('detects actual accounting statements and resolves an Arabic month range', () => {
    expect(isActualAccountingStatementRequest(
      'اعرض لي القوائم المالية الفعلية لهذا الكيان عن أكتوبر 2026'
    )).toBe(true);
    expect(actualAccountingRange('عن أكتوبر 2026', {})).toEqual({
      from:'2026-10-01',
      to:'2026-10-31'
    });
  });

  test('reads actual accounting statements through governed ledger capabilities without estimates', async () => {
    executeGovernedAction.mockImplementation(async ({ action }) => {
      if (action === 'accounting_trial_balance_report') {
        return { ok:true, executed:true, result:{ trial_balance:{ ok:true, total_debit:0, total_credit:0, difference:0, rows:[] } } };
      }
      if (action === 'accounting_financial_statements_report') {
        return {
          ok:true, executed:true,
          result:{ financial_statements:{
            balance_sheet:{ total_assets:0, total_liabilities:0, total_equity:0, accounting_difference:0 },
            income_statement:{ revenue:0, expenses:0, net_income:0 },
            provenance:{ source:'bonds_accounting_ledger', deterministic:true, ai_generated:false }
          }}
        };
      }
      if (action === 'accounting_changes_in_equity_statement') {
        return { ok:true, executed:true, result:{ rows:[{ opening_equity:0, current_period_earnings:0, closing_equity:0 }] } };
      }
      if (action === 'accounting_budget_analysis') {
        return {
          ok:true, executed:true,
          result:{ analysis:{ ok:true, metrics:{ summary:{
            revenue:{ actual_to_date:0, budget_to_date:100, actual_vs_budget_variance:-100 }
          }}}}
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'اعرض لي القوائم المالية الفعلية لهذا الكيان عن أكتوبر 2026 وقارنها بالموازنة' }],
      {
        accountingEntityId:'entity-1',
        budgetPlanId:'budget-1',
        actualThrough:'2026-10-31'
      },
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-accounting');
    expect(result.toolUsed).toBe(true);
    expect(result.reply).toContain('لا توجد قيود منشورة');
    expect(result.ui).toHaveLength(6);
    expect(result.ui.at(-1).title).toBe('الفعلي مقابل الموازنة');
    expect(result.ui.at(-1).items.join(' ')).toContain('revenue');
    expect(result.trace.map(item => item.action)).toEqual([
      'accounting_trial_balance_report',
      'accounting_financial_statements_report',
      'accounting_changes_in_equity_statement',
      'accounting_budget_analysis'
    ]);
    expect(executeGovernedAction.mock.calls.at(-1)[0].input).toEqual({
      accounting_entity_id:'entity-1',
      budget_plan_id:'budget-1',
      actual_through:'2026-10-31'
    });
  });

  test('routes explicit official URL requests through the deterministic research entry path', () => {
    expect(isFastPublicFact('ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.')).toBe(true);
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

  test('pins core search and calculator tools when discovery has no lexical match', () => {
    const compact = plannerCapabilityCatalog(
      'من مردونا',
      [],
      { modelId:'bonds-native', enforceModelPassport:true }
    );

    expect(compact.length).toBeGreaterThan(0);
    expect(compact.length).toBeLessThanOrEqual(plannerDiscoveryLimit());
    expect(CORE_PLANNER_ACTIONS.every(action => compact.some(item => item.a === action))).toBe(true);
    expect(compact.slice(0, CORE_PLANNER_ACTIONS.length).map(item => item.a))
      .toEqual([...CORE_PLANNER_ACTIONS].reverse());
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

  test('parses trailing commas and answer aliases from Native planner output', () => {
    expect(parseDecision('{"mode":"answer","answer":"تم",}'))
      .toEqual({ mode:'answer', answer:'تم' });
    expect(parseDecision('{"type":"response","text":"تم"}'))
      .toEqual({ mode:'answer', answer:'تم' });
    expect(parseDecision('{"answer":"تم"}'))
      .toEqual({ mode:'answer', answer:'تم' });
  });

  test('recovers Native prose as an answer instead of pretending the model is down', () => {
    expect(recoverPlannerDecision('متطلبات الجاهزية التمويلية تشمل القوائم المالية ودراسة الجدوى.'))
      .toEqual({
        mode:'answer',
        answer:'متطلبات الجاهزية التمويلية تشمل القوائم المالية ودراسة الجدوى.'
      });
    expect(recoverPlannerDecision('null')).toBeNull();
    expect(recoverPlannerDecision('{not json')).toBeNull();
    expect(recoverPlannerDecision('You are the BONDS universal action planner\nnope')).toBeNull();
    expect(recoverPlannerDecision('You are BONDS Assistant, an agent that uses registered capabilities.\nnope')).toBeNull();
  });

  test('recovers a length-truncated planner JSON answer instead of pretending the model is down', () => {
    const truncated = '{"mode":"answer","answer":"بصفتي مساعدك في الاستثمار ودعم اتخاذ القرار، يمكنني تقديم إرشادات عامة حول كيفية عمل الميزانية. عملية عمل الميزانية تعتمد بشكل كبير على الهدف (هل هي ميزانية شخصية، ميزانية عمل، ميزانية مشروع، إلخ) وعلى الأدوات المتاحة لك. \\n\\n**بشكل عام، تتضمن عملية عمل الميزانية الخطوات الأساسية التالية:**\\n\\n1. **تحديد الهدف:** لماذا تقوم بعمل الميزانية؟ (مثل: الادخار لشراء منزل';
    const recovered = recoverPlannerDecision(truncated);
    expect(recovered.mode).toBe('answer');
    expect(recovered.answer).toContain('كيفية عمل الميزانية');
    expect(recovered.answer).toContain('تحديد الهدف');
  });

  test('does not use fast snippet path for person lookup and requires two independent publishers', async () => {
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') {
        throw new Error('AI_REASON_MUST_NOT_RUN_FOR_PERSON_LOOKUP');
      }
      if (action === 'web_search') {
        expect(input.requiredTermMinMatches ?? 2).toBeGreaterThanOrEqual(2);
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{
            query:input.query,
            results:[
              { title:'طلال حسن الزهراني', url:'https://source-one.example/profile', snippet:'طلال حسن الزهراني مستشار مالي.' },
              { title:'طلال حسن الزهراني', url:'https://source-two.example/bio', snippet:'طلال حسن الزهراني خبير اقتصادي.' }
            ]
          }
        };
      }
      if (action === 'evidence_verify') {
        expect(input.minIndependentPublishers).toBe(2);
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'compute' },
          result:{
            verification_state:'SUPPORTED',
            sources:input.sources
          }
        };
      }
      if (action === 'web_fetch') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{ text:'طلال حسن الزهراني مستشار مالي وخبير اقتصادي.', content_type:'text/html' }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'1. من هو الدكتور طلال حسن الزهراني؟' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.planner).toBe('universal-v2-deterministic-research');
    expect(result.research.decision_eligible).toBe(true);
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);
  });

  test('fails closed for person lookup when independent evidence is insufficient and never falls back to planner', async () => {
    executeGovernedAction.mockImplementation(async ({ action }) => {
      if (action === 'ai_reason') {
        throw new Error('AI_REASON_MUST_NOT_RUN_AFTER_PERSON_RESEARCH_FAILURE');
      }
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{
            results:[
              { title:'Wrong person', url:'https://single-source.example/person', snippet:'شخص آخر مختلف تمامًا.' }
            ]
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
            verification_state:'INSUFFICIENT_EVIDENCE',
            sources:[]
          }
        };
      }
      if (action === 'web_fetch') {
        return {
          ok:true,
          executed:true,
          action,
          action_fabric:{ side_effect:'network_read' },
          result:{ text:'شخص آخر مختلف تمامًا.', content_type:'text/html' }
        };
      }
      return { ok:false, executed:false, action, error:{ code:'NO_EVIDENCE' } };
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'1. من هو الدكتور طلال حسن الزهراني؟' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-research');
    expect(result.reply).toBe('لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.');
    expect(result.research.decision_eligible).toBe(false);
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);
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
    expect(searchInput.disabledProviders).toBeUndefined();
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

  test('keeps Wikipedia hits whose snippets were truncated mid-tag', async () => {
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
              {
                title:'طلال حسن الزهراني',
                url:'https://ar.wikipedia.org/wiki/%D8%B7%D9%84%D8%A7%D9%84',
                snippet:'<span class="searchmatch">طلال حسن الزهراني</span> مستشار مالي. يعمل في <span class="searchmat'
              },
              {
                title:'Bonds Global',
                url:'https://en.wikipedia.org/wiki/Bonds_Global',
                snippet:'&lt;span class="searchmatch"&gt;Bonds Global&lt;/span&gt; is a financial advisory'
              }
            ]
          }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'من هو طلال حسن الزهراني' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.reply).not.toBe('البحث لم يُرجع صفحات.');
    expect(result.reply).toContain('طلال حسن الزهراني');
    expect(result.reply).toContain('https://ar.wikipedia.org/wiki/');
    expect(result.reply).not.toMatch(/<span|searchmatch|&lt;/);
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

  test('searches how-to questions even when the user asks for an explanation', async () => {
    executeGovernedAction.mockImplementation(async ({ action }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          action:'web_search',
          result:{
            results:[{
              title:'How to make a budget',
              url:'https://example.com/budget',
              snippet:'Start with income, then subtract expenses.'
            }]
          }
        };
      }
      if (action === 'web_fetch') {
        return { ok:true, executed:true, result:{ text:'Start with income, then subtract expenses.' } };
      }
      if (action === 'evidence_verify') {
        return { ok:true, executed:true, result:{ verification_state:'SUPPORTED' } };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'اشرح كيف اعمل ميزانية' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.toolUsed).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-research');
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'web_search')).toBe(true);
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);
    expect(result.reply).not.toContain('تعذر الوصول إلى خدمة الذكاء');
  });

  test('asks for a clear expression instead of inventing a number', async () => {
    executeGovernedAction.mockImplementation(async ({ action }) => {
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'احسب الميزانية' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.toolUsed).toBe(false);
    expect(result.reply).toContain('عبارة واضحة');
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });

  test('runs arithmetic from code without waiting for the planner', async () => {
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'math_calculate') {
        return {
          ok:true,
          executed:true,
          action:'math_calculate',
          result:{ expression:input.expression, value:180000 }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'احسب 18 بالمئة من مليون' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-tool');
    expect(result.toolUsed).toBe(true);
    expect(result.reply).toBe('الناتج: 180000');
    expect(executeGovernedAction.mock.calls.map(call => call[0].action)).toEqual(['math_calculate']);
    expect(executeGovernedAction.mock.calls[0][0].input.expression).toBe('(1000000) * (18 / 100)');
  });

  test('opens a registered calculator from code without waiting for the planner', async () => {
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'calculator_open') {
        return {
          ok:true,
          executed:true,
          action:'calculator_open',
          result:{
            calculator:input.calculator,
            navigation:{ target:'calculator_loan', route:'/calculators/loan' }
          }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'افتح حاسبة القرض' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-tool');
    expect(result.reply).toBe('حاسبة القرض\n/calculators/loan');
    expect(result.actions).toEqual([
      expect.objectContaining({
        type:'site_navigate',
        capability:'site_navigate',
        target:'calculator_loan',
        risk:'low',
        status:'ready'
      })
    ]);
    expect(executeGovernedAction.mock.calls[0][0]).toMatchObject({
      action:'calculator_open',
      input:{ calculator:'loan', language:'ar' }
    });
  });

  test('opens the funding calculator page from code even when a service is selected', async () => {
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'calculator_open') {
        return {
          ok:true,
          executed:true,
          action:'calculator_open',
          result:{
            calculator:input.calculator,
            navigation:{ target:'calculator_loan', route:'/calculators/loan' }
          }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'افتح صفحة حاسبة التمويل' }],
      { pagePath:'/calculators/loan', serviceCode:'funding' },
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-tool');
    expect(result.reply).toContain('/calculators/loan');
    expect(result.reply).not.toMatch(/case_id|accounting_entity_id/i);
    expect(executeGovernedAction.mock.calls[0][0]).toMatchObject({
      action:'calculator_open',
      input:{ calculator:'loan', language:'ar' }
    });
  });

  test('opens a registered budgeting page from code without asking for an entity id', async () => {
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'site_navigate') {
        return {
          ok:true,
          executed:true,
          action:'site_navigate',
          result:{ target:input.target, route:'/budgeting', kind:'page' }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'افتح صفحة الميزانية' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-tool');
    expect(result.reply).toContain('/budgeting');
    expect(result.actions).toEqual([
      expect.objectContaining({
        type:'site_navigate',
        target:'budgeting',
        status:'ready'
      })
    ]);
    expect(executeGovernedAction.mock.calls[0][0]).toMatchObject({
      action:'site_navigate',
      input:{ target:'budgeting', language:'ar' }
    });
  });

  test('builds statements from given revenue and profit without asking the language model', async () => {
    executeGovernedAction.mockImplementation(async () => {
      throw new Error('AI_REASON_MUST_NOT_RUN');
    });

    const result = await runUniversalOrchestrator(
      [{
        role:'user',
        content:'اعمل لي ميزانية قائمة مركز مالي ودخل وتدفقات ايرادات عشرة مليون وربح سبع مئة الف ولوزن الباقي كمتراكم مناسب'
      }],
      { pagePath:'/budgeting' },
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.toolUsed).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-tool');
    expect(result.reply).not.toMatch(/نموذج لغوي|language model/i);
    expect(result.reply).toContain('10,000,000');
    expect(result.reply).toContain('700,000');
    expect(result.ui).toHaveLength(3);
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });

  test('splits والارباح from revenue and does not coerce missing profit to zero', async () => {
    executeGovernedAction.mockImplementation(async () => {
      throw new Error('AI_REASON_MUST_NOT_RUN');
    });

    const result = await runUniversalOrchestrator(
      [{
        role:'user',
        content:'اعمل ميزانية لشركتي بوندز ايرادات عشرة مليون والارباح 900 الف اظبط القوائم من تاليفك بشكل صحيح'
      }],
      { pagePath:'/budgeting' },
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.toolUsed).toBe(true);
    expect(result.reply).toContain('10,000,000');
    expect(result.reply).toContain('900,000');
    expect(result.reply).not.toContain('10,900,000');
    expect(result.reply).not.toMatch(/صافي ربح 0/);
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });

  test('describes the current loan calculator instead of asking for previous context', async () => {
    executeGovernedAction.mockImplementation(async () => {
      throw new Error('AI_REASON_MUST_NOT_RUN');
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'ما الموجود هنا' }],
      { pagePath:'/calculators/loan', pageTitle:'حاسبة القرض والتمويل | بوندز' },
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-page');
    expect(result.reply).toContain('حاسبة القرض');
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });

  test('recognizes explicit execution confirmation text', () => {
    expect(explicitMutationConfirmation([{ role:'user', content:'نفذ الآن' }], 'accounting_journal_post')).toBe(true);
    expect(explicitMutationConfirmation([{ role:'user', content:'جهزه فقط' }], 'accounting_journal_post')).toBe(false);
  });
});
