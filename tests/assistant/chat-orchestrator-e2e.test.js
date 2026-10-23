jest.mock('../../lib/services/service-execution-router', () => ({
  loadExecutionProfile: jest.fn(),
  executeService: jest.fn()
}));

jest.mock('../../lib/assistant/human-escalation', () => ({
  createHumanEscalation: jest.fn()
}));

const {
  loadExecutionProfile,
  executeService
} = require('../../lib/services/service-execution-router');
const {
  createHumanEscalation
} = require('../../lib/assistant/human-escalation');
const {
  orchestrateChat
} = require('../../lib/assistant/chat-orchestrator');

function createSupabase() {
  const services = [
    {
      id: 'svc-fin',
      code: 'financial_analysis',
      name_ar: 'التحليل المالي',
      name_en: 'Financial Analysis',
      default_route_ar: '/services#analysis',
      default_route_en: '/en/services#analysis',
      status: 'published',
      is_active: true
    },
    {
      id: 'svc-risk',
      code: 'risk_analysis',
      name_ar: 'تحليل المخاطر',
      name_en: 'Risk Analysis',
      default_route_ar: '/services#risk',
      default_route_en: '/en/services#risk',
      status: 'published',
      is_active: true
    }
  ];
  const requirements = {
    'svc-fin': [],
    'svc-risk': []
  };
  let workflow = null;

  function resultFor(table, filters, routeExpression) {
    if (table === 'service_catalog') {
      if (filters.code) {
        return services.find(row => row.code === filters.code) || null;
      }
      if (routeExpression) {
        return services.find(row =>
          routeExpression.includes(`default_route_ar.eq.${row.default_route_ar}`) ||
          routeExpression.includes(`default_route_en.eq.${row.default_route_en}`)
        ) || null;
      }
      return services;
    }
    if (table === 'service_requirements') {
      return requirements[filters.service_id] || [];
    }
    return [];
  }

  return {
    getWorkflow: () => workflow,
    from(table) {
      const filters = {};
      let routeExpression = null;
      const builder = {
        select() { return builder; },
        eq(key, value) { filters[key] = value; return builder; },
        or(value) { routeExpression = value; return builder; },
        limit() { return builder; },
        order() { return builder; },
        maybeSingle: async () => ({
          data: resultFor(table, filters, routeExpression),
          error: null
        }),
        then(resolve, reject) {
          return Promise.resolve({
            data: resultFor(table, filters, routeExpression),
            error: null
          }).then(resolve, reject);
        }
      };
      return builder;
    },
    async rpc(name, args) {
      if (name === 'assistant_load_workflow_state') {
        return { data: workflow, error: null };
      }
      if (name === 'assistant_save_workflow_state') {
        workflow = {
          id: 'wf-1',
          workflow_key: args.p_workflow_key,
          boundary: args.p_boundary,
          status: args.p_status,
          version: (workflow?.version || 0) + 1,
          state: args.p_state,
          created_at: workflow?.created_at || '2026-10-23T00:00:00.000Z',
          updated_at: '2026-10-23T00:01:00.000Z'
        };
        return { data: workflow, error: null };
      }
      return { data: null, error: null };
    }
  };
}

describe('BONDS Chat Orchestrator end-to-end acceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadExecutionProfile.mockResolvedValue({
      service: { code: 'financial_analysis' },
      profile: {
        execution_mode: 'request_only',
        primary_action: null
      },
      capabilities: []
    });
    executeService.mockResolvedValue({
      httpStatus: 200,
      body: { ok: true, executed: true, result: { score: 88 } }
    });
    createHumanEscalation.mockResolvedValue({
      escalation: { id: 'esc-1', status: 'pending' }
    });
  });

  test('page context wins over a stale session for current-service questions', async () => {
    const supabase = createSupabase();
    const result = await orchestrateChat({
      req: { headers: {} },
      user: null,
      supabase,
      message: 'ما الخدمة التي أنا موجود فيها الآن؟',
      messages: [{ role: 'user', content: 'ما الخدمة التي أنا موجود فيها الآن؟' }],
      context: {
        pagePath: '/services#analysis',
        serviceCode: 'risk_analysis',
        serviceName: 'تحليل المخاطر'
      }
    });

    expect(result.handled).toBe(true);
    expect(result.response.context.authority).toBe('page');
    expect(result.response.context.serviceCode).toBe('financial_analysis');
    expect(result.response.reply).toContain('التحليل المالي');
  });

  test('homepage ignores stale session service for current-page identity', async () => {
    const supabase = createSupabase();
    const result = await orchestrateChat({
      req: { headers: {} },
      user: null,
      supabase,
      message: 'ما الخدمة الحالية؟',
      messages: [{ role: 'user', content: 'ما الخدمة الحالية؟' }],
      context: {
        pagePath: '/',
        serviceCode: 'risk_analysis'
      }
    });

    expect(result.response.context.state).toBe('homepage/no_service_selected');
    expect(result.response.context.serviceCode).toBeNull();
  });

  test('clear explicit service intent overrides page/session without carrying service-specific facts', async () => {
    const supabase = createSupabase();
    const result = await orchestrateChat({
      req: { headers: {} },
      user: { id: 'user-1' },
      supabase,
      message: 'أريد خدمة تحليل المخاطر',
      messages: [
        { role: 'user', content: 'كنت أراجع التحليل المالي' },
        { role: 'assistant', content: 'مفهوم' },
        { role: 'user', content: 'أريد خدمة تحليل المخاطر' }
      ],
      context: {
        pagePath: '/services#analysis',
        serviceCode: 'financial_analysis'
      },
      assistantState: {
        goal: 'تقييم المخاطر',
        current_stage: 'data_collection',
        confirmed_facts: { currency: 'SAR' },
        conversation_tail: [
          { role: 'user', content: 'كنت أراجع التحليل المالي' },
          { role: 'assistant', content: 'مفهوم' }
        ]
      }
    });

    expect(result.handled).toBe(false);
    expect(result.resolvedContext.serviceCode).toBe('risk_analysis');
    expect(result.resolvedContext.contextAuthority).toBe('explicit_user_intent');
    expect(result.caseState.confirmed_facts.currency).toBeUndefined();
    expect(result.caseState.conversation_tail.at(-1).content).toBe('أريد خدمة تحليل المخاطر');
    expect(supabase.getWorkflow().boundary).toContain('service:risk_analysis');
  });

  test('guest-to-authenticated continuity persists same-service state', async () => {
    const supabase = createSupabase();
    const result = await orchestrateChat({
      req: { headers: {} },
      user: { id: 'user-1' },
      supabase,
      message: 'ما التالي؟',
      messages: [
        { role: 'user', content: 'بدأت كضيف' },
        { role: 'assistant', content: 'أرسل القوائم المالية' },
        { role: 'user', content: 'ما التالي؟' }
      ],
      context: {
        pagePath: '/services#analysis',
        serviceCode: 'financial_analysis'
      },
      assistantState: {
        boundary: 'city:none|activity:none|model:none|service:financial_analysis',
        goal: 'تحليل الشركة',
        current_stage: 'data_collection',
        confirmed_facts: { currency: 'SAR' },
        conversation_tail: [
          { role: 'user', content: 'بدأت كضيف' },
          { role: 'assistant', content: 'أرسل القوائم المالية' }
        ]
      }
    });

    expect(result.handled).toBe(true);
    expect(result.response.case_state.goal).toBe('تحليل الشركة');
    expect(result.response.case_state.current_stage).toBe('data_collection');
    expect(result.response.case_state.confirmed_facts.currency).toBe('SAR');
    expect(result.response.case_state.conversation_tail.at(-1).content).toBe('ما التالي؟');
    expect(supabase.getWorkflow()).not.toBeNull();
  });

  test('registered deterministic execution returns a governed action result and review state', async () => {
    const supabase = createSupabase();
    loadExecutionProfile.mockResolvedValue({
      service: { code: 'financial_analysis' },
      profile: {
        execution_mode: 'capability_plan',
        primary_action: 'financial_analysis_run'
      },
      capabilities: [{ capability_code: 'financial_analysis_run' }]
    });

    const result = await orchestrateChat({
      req: { headers: {} },
      user: { id: 'user-1' },
      supabase,
      message: 'نفذ خدمة التحليل المالي',
      messages: [{ role: 'user', content: 'نفذ خدمة التحليل المالي' }],
      context: {
        pagePath: '/services#analysis',
        executionInputs: { revenue: 1000, expenses: 700 }
      }
    });

    expect(result.handled).toBe(true);
    expect(result.response.source).toBe('service-execution-layer');
    expect(result.response.case_state.current_stage).toBe('review');
    expect(result.response.ui[0].type).toBe('calculation');
    expect(executeService).toHaveBeenCalledWith(expect.objectContaining({
      serviceCode: 'financial_analysis'
    }));
  });

  test('human escalation persists the case and routes to Agent Inbox', async () => {
    const supabase = createSupabase();
    const result = await orchestrateChat({
      req: { headers: {} },
      user: { id: 'user-1' },
      supabase,
      message: 'أريد مستشار بشري',
      messages: [{ role: 'user', content: 'أريد مستشار بشري' }],
      context: { pagePath: '/services#analysis' }
    });

    expect(result.handled).toBe(true);
    expect(result.response.ui[0].type).toBe('escalation');
    expect(result.response.case_state.current_stage).toBe('review');
    expect(createHumanEscalation).toHaveBeenCalled();
  });
});
