const {
  normalizePath,
  isHomepage,
  resolveIntent,
  asksCurrentService,
  serviceFromExplicitIntent
} = require('../../lib/assistant/chat-orchestrator');
const {
  stageForIntent,
  nextBestAction,
  buildCaseState,
  sanitizeConversationTail
} = require('../../lib/assistant/case-engine');

describe('BONDS Chat Orchestrator + Case Engine', () => {
  test('formalizes homepage as no-service-selected page context', () => {
    expect(isHomepage('/')).toBe(true);
    expect(isHomepage('/en/')).toBe(true);
    expect(normalizePath('/index.html?x=1')).toBe('/index.html');
    expect(normalizePath('/services#analysis')).toBe('/services#analysis');
    expect(normalizePath('/services?x=1#risk')).toBe('/services#risk');
  });

  test('detects current-service questions from page context intent', () => {
    expect(asksCurrentService('ما الخدمة التي أنا موجود فيها الآن؟')).toBe(true);
    expect(asksCurrentService('what is the current service?')).toBe(true);
  });

  test('classifies operational intents deterministically', () => {
    expect(resolveIntent('احسب التدفق النقدي')).toBe('calculation');
    expect(resolveIntent('حلل المخاطر')).toBe('analysis');
    expect(resolveIntent('نفذ الخدمة')).toBe('execution');
    expect(resolveIntent('أريد مستشار بشري')).toBe('escalation');
    expect(resolveIntent('ارفع المستند')).toBe('document');
    expect(resolveIntent('ما الحالة الآن')).toBe('follow_up');
  });

  test('moves cases through declared stages without inventing service execution', () => {
    expect(stageForIntent('analysis', { missingRequired: 2 })).toBe('data_collection');
    expect(stageForIntent('analysis', { missingRequired: 0 })).toBe('analysis');
    expect(stageForIntent('execution', { executed: true })).toBe('review');
    expect(stageForIntent('escalation')).toBe('review');
  });

  test('next best action is based on actual missing requirements', () => {
    const action = nextBestAction({
      serviceCode: 'financial_analysis',
      missingRequirements: ['القوائم المالية'],
      intent: 'analysis'
    });
    expect(action.code).toBe('COLLECT_REQUIRED_DATA');
    expect(action.missing).toEqual(['القوائم المالية']);
  });

  test('resolves only clear explicit service intent', async () => {
    const services = [
      { id: '1', code: 'financial_analysis', name_ar: 'التحليل المالي', name_en: 'Financial Analysis' },
      { id: '2', code: 'risk_analysis', name_ar: 'تحليل المخاطر', name_en: 'Risk Analysis' }
    ];
    const supabase = {
      from: () => {
        const builder = {
          select() { return this; },
          eq() { return this; },
          limit() { return this; },
          then(resolve) { return Promise.resolve(resolve({ data: services, error: null })); }
        };
        return builder;
      }
    };

    await expect(serviceFromExplicitIntent({
      supabase,
      message: 'أريد خدمة تحليل المخاطر'
    })).resolves.toMatchObject({ code: 'risk_analysis' });

    await expect(serviceFromExplicitIntent({
      supabase,
      message: 'حلل المخاطر في هذه الحالة'
    })).resolves.toBeNull();
  });

  test('carries guest continuity into durable case state with a bounded conversation tail', () => {
    const state = buildCaseState({
      boundary: 'page:/services#analysis|service:financial_analysis',
      seedState: {
        goal: 'تحليل الشركة',
        current_stage: 'data_collection',
        confirmed_facts: { currency: 'SAR' },
        conversation_tail: [
          { role: 'user', content: 'ابدأ التحليل' },
          { role: 'assistant', content: 'أرسل البيانات المالية' }
        ]
      },
      conversationTail: [
        { role: 'user', content: 'هذه البيانات' }
      ],
      userMessage: 'هذه البيانات',
      serviceCode: 'financial_analysis',
      intent: 'follow_up',
      missingRequirements: []
    });
    expect(state.goal).toBe('تحليل الشركة');
    expect(state.current_stage).toBe('data_collection');
    expect(state.confirmed_facts.currency).toBe('SAR');
    expect(state.conversation_tail).toHaveLength(3);
    expect(sanitizeConversationTail(new Array(20).fill({ role: 'user', content: 'x' }))).toHaveLength(12);
  });

  test('builds persistent case state using the existing workflow-state contract', () => {
    const state = buildCaseState({
      boundary: 'page:/x|service:financial_analysis',
      userMessage: 'حلل',
      serviceCode: 'financial_analysis',
      intent: 'analysis',
      missingRequirements: []
    });
    expect(state.current_stage).toBe('analysis');
    expect(state.boundary).toContain('financial_analysis');
    expect(state.last_action.code).toBe('RUN_REGISTERED_ENGINE');
  });
});
