const {
  normalizePath,
  isHomepage,
  resolveIntent,
  asksHumanEscalationIntent,
  asksCurrentService
} = require('../../lib/assistant/chat-orchestrator');
const {
  stageForIntent,
  nextBestAction,
  buildCaseState
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

  test('does not mistake advisor/person lookup text for human escalation', () => {
    expect(resolveIntent('من هو المستشار المالي الدكتور طلال حسن الزهراني')).toBe('information');
    expect(resolveIntent('من هو مستشار محمد بن سلمان')).toBe('information');
    expect(resolveIntent('ما هو دور المستشار المالي؟')).toBe('information');
    expect(asksHumanEscalationIntent('أريد مستشار بشري')).toBe(true);
    expect(asksHumanEscalationIntent('حوّلني إلى موظف')).toBe(true);
    expect(asksHumanEscalationIntent('طلب مراجعة بشرية')).toBe(true);
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
  test('person lookup outranks ambiguous advisor wording but explicit human escalation remains explicit', () => {
    expect(resolveIntent('حدثني عن المستشار طلال حسن الزهراني')).toBe('information');
    expect(resolveIntent('معلومات عن المحامي أحمد محمد علي')).toBe('information');
    expect(resolveIntent('من هو مستشار محمد بن سلمان')).toBe('information');

    expect(resolveIntent('أريد مستشار بشري')).toBe('escalation');
    expect(resolveIntent('وصلني مع موظف')).toBe('escalation');
  });

});
