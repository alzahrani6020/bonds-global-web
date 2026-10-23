/** @jest-environment node */

const {
  resolveIntent,
  resolveIntents,
  resolveConversationReference,
  asksAssistantIdentity,
  asksUserIdentity
} = require('../../lib/assistant/chat-orchestrator');
const {
  adaptiveNativeChatMaxTokens,
  enforceAssistantIdentity,
  buildNativeChatPrompt
} = require('../../v3/api/ai');
const { getActionDescriptor } = require('../../lib/capabilities/bonds-capability-registry');

const ARABIC_GOLDEN_CONVERSATIONS = [
  ['financing_1', 'ما هو أفضل تمويل لمشروعي؟', 'analysis'],
  ['financing_2', 'أحتاج تمويل للمشروع', 'analysis'],
  ['financing_3', 'ابي تمويل للمشرووع', 'analysis'],
  ['financing_4', 'هل القرض مناسب للمشروع؟', 'analysis'],
  ['risk_1', 'حلل مخاطر المشروع', 'analysis'],
  ['risk_2', 'أريد تحليل ائتماني للشركة', 'analysis'],
  ['feasibility_1', 'اعمل دراسة جدوى للمشروع', 'analysis'],
  ['market_1', 'حلل السوق لهذا النشاط', 'analysis'],
  ['calculation_1', 'احسب التدفق النقدي', 'calculation'],
  ['calculation_2', 'احسب هامش الربح', 'calculation'],
  ['calculation_3', 'أريد حساب نسبة المديونية', 'calculation'],
  ['valuation_1', 'ما قيمة هذا الأصل؟ أريد تقييمه', 'calculation'],
  ['scenario_1', 'قارن بين سيناريوهين ماليين', 'calculation'],
  ['execution_1', 'نفذ الخدمة', 'execution'],
  ['execution_2', 'ابدأ التنفيذ الآن', 'execution'],
  ['document_1', 'ارفع الملف للتحليل', 'document'],
  ['document_2', 'أرفق المستند', 'document'],
  ['human_1', 'أريد مستشار بشري', 'escalation'],
  ['status_1', 'ما الحالة الآن؟', 'follow_up'],
  ['information_1', 'ما هو بوندز؟', 'information'],
  ['information_2', 'ما هي الخدمات المتاحة؟', 'information'],
  ['information_3', 'وش الخدمات اللي عندكم؟', 'information'],
  ['compound_1', 'حلل جدوى المشروع واحسب التدفق النقدي', 'analysis'],
  ['compound_2', 'حلل المخاطر والتمويل للمشروع', 'analysis'],
  ['followup_1', 'اكمل', 'analysis'],
  ['followup_2', 'وماذا أيضًا؟', 'analysis'],
  ['followup_3', 'تابع', 'analysis'],
  ['followup_4', 'نفس السابق', 'analysis'],
  ['followup_5', 'هذا', 'analysis'],
  ['followup_6', 'هو', 'analysis'],
  ['followup_7', 'عليه', 'analysis'],
  ['followup_8', 'عليها', 'analysis'],
  ['followup_9', 'المشروع السابق', 'analysis'],
  ['followup_10', 'الطلب نفسه', 'analysis']
];

describe('BONDS conversational intelligence golden conversations', () => {
  const priorState = {
    active_topic: 'تمويل المشروع',
    goal: 'اختيار تمويل مناسب',
    last_intent: 'analysis'
  };
  const recentMessages = [
    { role:'user', content:'أريد أفضل تمويل لمشروعي' },
    { role:'assistant', content:'يلزم أولاً تحديد مبلغ التمويل والتدفقات.' }
  ];

  test('contains at least 30 real Arabic conversational scenarios', () => {
    expect(ARABIC_GOLDEN_CONVERSATIONS.length).toBeGreaterThanOrEqual(30);
    expect(ARABIC_GOLDEN_CONVERSATIONS.every(item => /[\u0600-\u06FF]/.test(item[1]))).toBe(true);
  });

  test.each(ARABIC_GOLDEN_CONVERSATIONS)('%s resolves intent without generic greeting interception', (_id, message, expected) => {
    const isFollowUp = _id.startsWith('followup_');
    expect(resolveIntent(message, {
      assistantState: isFollowUp ? priorState : null,
      recentMessages: isFollowUp ? recentMessages : [],
      context: {}
    })).toBe(expected);
  });

  test('compound Arabic request retains more than one operational intent', () => {
    const intents = resolveIntents('حلل جدوى المشروع واحسب التدفق النقدي');
    expect(intents).toEqual(expect.arrayContaining(['analysis', 'calculation']));
  });

  test.each([
    ['اكمل'],
    ['وماذا أيضًا؟'],
    ['نفس السابق'],
    ['هذا'],
    ['المشروع السابق'],
    ['الطلب نفسه']
  ])('follow-up %s resolves against active topic', message => {
    const resolved = resolveConversationReference(message, priorState, recentMessages);
    expect(resolved.follow_up).toBe(true);
    expect(resolved.active_topic).toBe('تمويل المشروع');
    expect(resolved.message).toContain('تمويل المشروع');
  });

  test('identity questions are categorical and do not expose underlying provider identity', () => {
    expect(asksAssistantIdentity('من أنت؟')).toBe(true);
    expect(asksUserIdentity('هل تعرف من أنا؟')).toBe(true);
    const guarded = enforceAssistantIdentity('أنا Gemini من Google وأساعدك.');
    expect(guarded).toContain('مساعد بوندز');
    expect(guarded).not.toMatch(/Gemini|Gemma|Google|OpenAI|ChatGPT|GPT|Claude|Anthropic|Llama|Meta/i);
  });

  test('adaptive token budget removes the legacy 48-token ceiling', () => {
    expect(adaptiveNativeChatMaxTokens([{ role:'user', content:'من أنت؟' }])).toBeGreaterThanOrEqual(80);
    expect(adaptiveNativeChatMaxTokens([{ role:'user', content:'اشرح لي خيارات التمويل لهذا المشروع وشروط كل خيار والمخاطر والتدفقات النقدية المتوقعة، وقارن بينها ثم اذكر البيانات الناقصة؟' }])).toBeGreaterThanOrEqual(256);
    expect(adaptiveNativeChatMaxTokens([{ role:'user', content:'x' }], 999)).toBe(384);
  });

  test('prompt keeps 8-12 recent messages, bounded state, identity and verified evidence layers', () => {
    const messages = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: 'رسالة-' + index
    }));
    const prompt = buildNativeChatPrompt(messages, {
      authenticated:true,
      userRole:'client',
      pagePath:'/services/test',
      serviceCode:'test',
      cityName:'جدة'
    }, {
      active_topic:'تمويل المشروع',
      last_intent:'analysis'
    });
    expect(prompt).toContain('BONDS Assistant / مساعد بوندز');
    expect(prompt).toContain('TRUSTED_USER_CONTEXT=');
    expect(prompt).toContain('CONVERSATION_STATE=');
    expect(prompt).toContain('VERIFIED_BONDS_DATA=');
    expect(prompt).toContain('RECENT_MESSAGES=');
    expect(prompt).toContain('CURRENT_REQUEST=');
    expect(prompt).toContain('رسالة-4');
    expect(prompt).not.toContain('رسالة-3');
    expect(prompt).toContain('رسالة-13');
  });

  test('chat AI is a registered governed Action Fabric capability', () => {
    expect(getActionDescriptor('ai_reason')).toMatchObject({
      action:'ai_reason',
      actionType:'ai',
      serviceCode:'assistant',
      runtimeAdapter:'native_generate',
      sideEffect:'compute',
      active:true
    });
  });

  test('financial actions remain registered engine capabilities', () => {
    for (const action of [
      'financial_analysis_run',
      'cash_flow_analysis_run',
      'funding_readiness_run',
      'creditworthiness_run',
      'feasibility_run',
      'valuation_run',
      'risk_analysis_run',
      'scenario_forecast_run'
    ]) {
      expect(getActionDescriptor(action)).toEqual(expect.objectContaining({
        action,
        actionType:'engine',
        active:true
      }));
    }
  });
});
