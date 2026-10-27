/** @jest-environment node */
'use strict';

/**
 * Free-chat routing: L0 default, L1/L2 at claim level, per-claim degradation.
 */

function loadHarness({ plannerReplies, plannerTelemetry = [], toolResults = {} }) {
  jest.resetModules();

  const calls = [];
  const reasonerPrompts = [];
  let reasonerCall = 0;

  const capabilities = {
    web_search: { action:'web_search', active:true, sideEffect:'network_read', purpose:'search the public web' },
    web_fetch: { action:'web_fetch', active:true, sideEffect:'network_read', purpose:'fetch a page' },
    calculator: { action:'calculator', active:true, sideEffect:'compute', purpose:'deterministic calculation' },
    form_save_draft: { action:'form_save_draft', active:true, sideEffect:'database_write', purpose:'save draft' },
    ai_reason: { action:'ai_reason', active:true, sideEffect:'compute', purpose:'reason' }
  };

  jest.doMock('../../lib/services/service-execution-router', () => ({
    executeGovernedAction: jest.fn(async ({ action, input }) => {
      calls.push({ action, input });

      if (action === 'ai_reason') {
        const prompt = String(input?.prompt || '');
        reasonerPrompts.push(prompt);
        const replyIndex = Math.min(reasonerCall, plannerReplies.length - 1);
        const reply = plannerReplies[replyIndex];
        const telemetry = plannerTelemetry[Math.min(reasonerCall, Math.max(0, plannerTelemetry.length - 1))] || {};
        reasonerCall += 1;
        return {
          ok:true,
          result:{
            result:{
              text: typeof reply === 'string' ? reply : JSON.stringify(reply),
              ...telemetry
            }
          },
          meta:{
            native_node:'native-1',
            elapsed_ms:telemetry.elapsed_ms ?? 2050
          }
        };
      }

      if (action in toolResults) {
        return toolResults[action](input);
      }

      throw new Error('UNEXPECTED_ACTION:' + action);
    })
  }));

  jest.doMock('../../lib/capabilities/bonds-capability-registry', () => ({
    listCapabilities: () => Object.values(capabilities),
    getCapability: action => capabilities[action] || null,
    getActionDescriptor: action => capabilities[action] || null
  }));

  const mod = require('../../lib/assistant/universal-orchestrator');
  return { mod, calls, reasonerPrompts };
}

const TERMINAL_INSUFFICIENT = 'لم أجد أدلة عامة كافية وموثوقة للإجابة على هذا الطلب.';

const ALL_PROVIDERS_DOWN = () => ({
  ok:false,
  executed:true,
  error:{
    code:'WEB_SEARCH_FAILED',
    attempts:[
      { provider:'bing', status_code:403, failure_class:'HTTP_STATUS' },
      { provider:'duckduckgo', status_code:403, failure_class:'HTTP_STATUS' },
      { provider:'brave', status_code:403, failure_class:'HTTP_STATUS' }
    ]
  }
});

describe('universal orchestrator free-chat routing', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('unknown person: failed research degrades to free chat instead of a terminal refusal', async () => {
    const { mod, reasonerPrompts } = loadHarness({
      plannerReplies: [
        { mode:'answer', answer:'لا تتوفر لدي معلومات عامة كافية عن هذا الاسم. إن زودتني بموقع أو مصدر أحلله لك فوراً.' }
      ],
      toolResults: { web_search: ALL_PROVIDERS_DOWN }
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'من هو الدكتور فلان الفلاني غير المعروف؟' }],
      {},
      { requestId:'req-person-unknown' }
    );

    expect(result.ok).toBe(true);
    expect(result.reply).not.toBe(TERMINAL_INSUFFICIENT);
    expect(result.reply).toContain('لا تتوفر لدي معلومات عامة كافية');
    expect(result.planner).toBe('universal-v2');
    expect(reasonerPrompts.length).toBeGreaterThan(0);
    expect(reasonerPrompts[0]).toContain('INSUFFICIENT_EVIDENCE');
    expect(reasonerPrompts[0]).toContain('deterministic_research');
  });

  test('general finance concept answers directly without any tool', async () => {
    const { mod, calls, reasonerPrompts } = loadHarness({
      plannerReplies: [
        { mode:'answer', answer:'EBITDA هي الأرباح قبل الفوائد والضرائب والإهلاك والاستهلاك، وتقيس ربحية التشغيل الأساسية.' }
      ]
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'اشرح لي مفهوم EBITDA باختصار' }],
      {},
      { requestId:'req-ebitda' }
    );

    expect(result.ok).toBe(true);
    expect(result.reply).toContain('EBITDA');
    expect(result.steps).toBe(0);
    expect(calls.every(call => call.action === 'ai_reason')).toBe(true);
    expect(reasonerPrompts[0]).toContain('FREE_CHAT_DEFAULT');
  });

  test('deterministic finance action routes through the tool and cites its result', async () => {
    const { mod, calls, reasonerPrompts } = loadHarness({
      plannerReplies: [
        { mode:'tool', action:'calculator', input:{ expression:'1000000 * 0.18' } },
        { mode:'answer', answer:'الناتج الحتمي: 180000.' }
      ],
      toolResults: {
        calculator: async () => ({
          ok:true,
          executed:true,
          action:'calculator',
          action_fabric:{ side_effect:'compute' },
          result:{ value:'180000' }
        })
      }
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'احسب 18 بالمئة من مليون' }],
      {},
      { requestId:'req-calc' }
    );

    expect(result.ok).toBe(true);
    expect(calls.some(call => call.action === 'calculator')).toBe(true);
    expect(result.reply).toContain('180000');
    expect(reasonerPrompts[0]).toContain('calculator');
  });

  test('failed tool observation reaches the planner with the no-guessing rule', async () => {
    const { mod, reasonerPrompts } = loadHarness({
      plannerReplies: [
        { mode:'tool', action:'web_search', input:{ query:'إيرادات شركة X الحالية' } },
        { mode:'answer', answer:'تعذر الوصول إلى البحث المباشر الآن، فلا أستطيع تأكيد الرقم الحالي.' }
      ],
      toolResults: {
        web_search: async () => ({
          ok:false,
          executed:true,
          action:'web_search',
          action_fabric:{ side_effect:'network_read' },
          error:{ code:'SEARCH_FAILED', message:'upstream unavailable' }
        })
      }
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'ابحث عن إيرادات شركة X الحالية' }],
      {},
      { requestId:'req-tool-fail' }
    );

    expect(result.ok).toBe(true);
    expect(reasonerPrompts[0]).toContain('TOOL_FAILURE');
    expect(reasonerPrompts[1]).toContain('SEARCH_FAILED');
    expect(reasonerPrompts[1]).toContain('"ok":false');
    expect(result.reply).not.toMatch(/\d{3,}/);
  });

  test('mixed question: general part answered, current fact qualified per-claim', async () => {
    const { mod, reasonerPrompts } = loadHarness({
      plannerReplies: [
        { mode:'tool', action:'web_search', input:{ query:'شركة X إيرادات 500 مليون' } },
        { mode:'answer', answer:'EBITDA تقيس ربحية التشغيل قبل الفوائد والضرائب. أما إيرادات شركة X اليوم فهي غير موثقة لديّ حالياً ولا أستطيع تأكيد الرقم 500 مليون.' }
      ],
      toolResults: {
        web_search: async () => ({
          ok:true,
          executed:true,
          action:'web_search',
          action_fabric:{ side_effect:'network_read' },
          result:{ results:[{ title:'صفحة عامة عن الشركة', url:'https://example.com/x' }] }
        })
      }
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'اشرح EBITDA وهل إيرادات شركة X اليوم 500 مليون؟' }],
      {},
      { requestId:'req-mixed' }
    );

    expect(result.ok).toBe(true);
    expect(result.reply).toContain('EBITDA');
    expect(result.reply).toContain('غير موثقة');
    expect(result.reply).toContain('500 مليون');
    expect(result.answerQualified).toBe(false);
    expect(reasonerPrompts[1]).toContain('صفحة عامة عن الشركة');
  });

  test('unverified verification vocabulary is qualified unless verified evidence exists', () => {
    const { mod } = loadHarness({ plannerReplies: [{ mode:'answer', answer:'ok' }] });

    expect(mod.hasVerifiedEvidence([])).toBe(false);
    expect(mod.hasVerifiedEvidence([{ ok:true, result:{ verification_state:'SUPPORTED' } }])).toBe(true);
    expect(mod.hasVerifiedEvidence([{ ok:false, result:{ verification_state:'SUPPORTED' } }])).toBe(false);

    const qualified = mod.qualifyUnverifiedAnswer('هذا رقم موثق من مصادر رسمية.', false);
    expect(qualified.qualified).toBe(true);
    expect(qualified.reply).toContain('غير موثقة');

    const negated = mod.qualifyUnverifiedAnswer('الرقم غير موثق لديّ.', false);
    expect(negated.qualified).toBe(false);

    const verified = mod.qualifyUnverifiedAnswer('هذا رقم موثق.', true);
    expect(verified.qualified).toBe(false);

    const english = mod.qualifyUnverifiedAnswer('This figure is verified by official sources.', false);
    expect(english.qualified).toBe(true);
    expect(english.reply).toContain('unverified');
  });

  test('captures only safe planner Native telemetry and preserves prompt token usage', async () => {
    const { mod } = loadHarness({
      plannerReplies:[{ mode:'answer', answer:'إجابة عامة.' }],
      plannerTelemetry:[{
        lock_wait_seconds:1.23456,
        generation_seconds:2.34567,
        request_total_seconds:3.45678,
        model_load_seconds:0,
        model_cache_hit:true,
        completion_tokens:27,
        tokens_per_second:11.23456,
        n_ctx:4096,
        finish_reason:'stop',
        usage:{ prompt_tokens:6123, completion_tokens:27 },
        model_path:'C:/private/model.gguf',
        secret:'DO_NOT_EXPOSE',
        elapsed_ms:999999
      }]
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'اشرح مفهوماً عاماً' }],
      {},
      { requestId:'req-native-telemetry' }
    );

    expect(result.ok).toBe(true);
    expect(result.nativeTelemetry).toHaveLength(1);
    expect(result.nativeTelemetry[0]).toEqual(expect.objectContaining({
      step:1,
      final:false,
      lock_wait_seconds:1.235,
      generation_seconds:2.346,
      request_total_seconds:3.457,
      model_load_seconds:0,
      model_cache_hit:true,
      completion_tokens:27,
      prompt_tokens:6123,
      tokens_per_second:11.235,
      n_ctx:4096,
      finish_reason:'stop',
      native_node:'native-1',
      elapsed_ms:2050
    }));
    expect(result.nativeTelemetry[0]).not.toHaveProperty('model_path');
    expect(result.nativeTelemetry[0]).not.toHaveProperty('secret');
    expect(result.nativeTelemetry[0]).not.toHaveProperty('usage');
  });

  test('planner unavailable degrades to a deterministic patient reply without HTTP-style failure semantics', async () => {
    const { mod } = loadHarness({
      plannerReplies:[null]
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'ارسل موقع مدينة جده' }],
      {},
      { requestId:'req-planner-unavailable' }
    );

    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.failure).toBe('PLANNER_UNAVAILABLE');
    expect(result.reply).toBe('تعذر الوصول إلى خدمة الذكاء حالياً. أعد المحاولة بعد قليل.');
    expect(result.steps).toBe(0);
  });

  test('planner exhausted after insufficient research returns the evidence-aware deterministic fallback', async () => {
    const { mod } = loadHarness({
      plannerReplies:[null],
      toolResults:{ web_search:ALL_PROVIDERS_DOWN }
    });

    const result = await mod.runUniversalOrchestrator(
      [{ role:'user', content:'من هو الدكتور فلان الفلاني غير المعروف؟' }],
      {},
      { requestId:'req-planner-exhausted' }
    );

    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.failure).toBe('PLANNER_EXHAUSTED');
    expect(result.reply).toContain('البحث لم يجد دليلاً كافياً');
    expect(result.reply).toContain('خدمة الذكاء غير متاحة');
  });

  test('planner prompt carries the free-chat and phrasing rules (source contract)', () => {
    const { mod, reasonerPrompts } = loadHarness({
      plannerReplies: [{ mode:'answer', answer:'إجابة عامة بلا مفردات توثيق.' }]
    });

    return mod.runUniversalOrchestrator(
      [{ role:'user', content:'ما رأيك في رفع أسعار الفائدة؟' }],
      {},
      { requestId:'req-contract' }
    ).then(() => {
      expect(reasonerPrompts[0]).toContain('FREE_CHAT_DEFAULT');
      expect(reasonerPrompts[0]).toContain('UNVERIFIED_PHRASING');
      expect(reasonerPrompts[0]).toContain('TOOL_FAILURE');
      expect(reasonerPrompts[0]).toContain('INSUFFICIENT_EVIDENCE');
    });
  });
});
