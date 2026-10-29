const {
  capabilityCatalog,
  plannerCapabilityCatalog,
  plannerDiscoveryLimit,
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