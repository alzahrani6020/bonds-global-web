'use strict';

const { runProductionToolSmoke } = require('../../lib/assistant/production-tool-smoke');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body)
  };
}

function replyFor(content) {
  if (content === 'احسب 18 بالمئة من مليون') {
    return jsonResponse(200, {
      reply:'الناتج: 180000',
      source:'bonds-assistant-ai-tool',
      inference:{ tool_used:true, actions:['math_calculate'], planner:'universal-v2-deterministic-tool' }
    });
  }
  if (content === 'افتح حاسبة القرض' || content === 'افتح صفحة حاسبة التمويل') {
    return jsonResponse(200, {
      reply:'حاسبة القرض\n/calculators/loan',
      source:'bonds-assistant-ai-tool',
      inference:{ tool_used:true, actions:['calculator_open'], planner:'universal-v2-deterministic-tool' },
      actions:[{ type:'site_navigate', target:'calculator_loan', status:'ready' }]
    });
  }
  if (content === 'اعمل لي ميزانية قائمة مركز مالي ودخل وتدفقات ايرادات عشرة مليون وربح سبع مئة الف') {
    return jsonResponse(200, {
      reply:'بنيت مسودة القوائم من الأرقام المعطاة.',
      source:'bonds-assistant-ai-tool',
      inference:{ tool_used:true, actions:['statement_build'], planner:'universal-v2-deterministic-tool' },
      ui:[
        { type:'result_card', title:'قائمة الدخل', items:['الإيرادات: 10,000,000','صافي الربح: 700,000'] },
        { type:'result_card', title:'قائمة التدفقات النقدية', items:['صافي التغير في النقد: 700,000'] },
        { type:'result_card', title:'قائمة المركز المالي', items:['إجمالي الأصول: 700,000'] }
      ]
    });
  }
  if (content === 'افتح صفحة الميزانية') {
    return jsonResponse(200, {
      reply:'الميزانيات والموازنات\n/budgeting',
      source:'bonds-assistant-ai-tool',
      inference:{ tool_used:true, actions:['site_navigate'], planner:'universal-v2-deterministic-tool' },
      actions:[{ type:'site_navigate', target:'budgeting', status:'ready' }]
    });
  }
  return jsonResponse(200, {
    reply:'1. How to make a budget\nhttps://example.com/budget',
    source:'bonds-assistant-ai-tool',
    inference:{ tool_used:true, actions:['web_search'], planner:'universal-v2-deterministic-research' }
  });
}

describe('Assistant production tool smoke', () => {
  test('proves calculate, calculator open, page open, and how-to search actually ran tools', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body.messages[0].content);
      return replyFor(body.messages[0].content);
    });

    const result = await runProductionToolSmoke({
      baseUrl:'https://bonds-global.com',
      token:'token',
      expectedSha:'a'.repeat(40),
      fetchImpl,
      sleepImpl:async () => {},
      log:() => {}
    });

    expect(result).toEqual({
      ok:true,
      math_calculate:true,
      calculator_open:true,
      site_navigate:true,
      funding_calculator_open:true,
      statement_build:true,
      web_search:true
    });
    expect(calls).toEqual([
      'احسب 18 بالمئة من مليون',
      'افتح حاسبة القرض',
      'افتح صفحة الميزانية',
      'افتح صفحة حاسبة التمويل',
      'اعمل لي ميزانية قائمة مركز مالي ودخل وتدفقات ايرادات عشرة مليون وربح سبع مئة الف',
      'كيف اعمل ميزانية'
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body).context).toEqual({
      pagePath:'/calculators/loan',
      serviceCode:'funding'
    });
  });

  test('fails closed when a how-to answer skips search', async () => {
    const fetchImpl = jest.fn(async (url, options) => {
      const content = JSON.parse(options.body).messages[0].content;
      if (content === 'كيف اعمل ميزانية') {
        return jsonResponse(200, {
          reply:'غير موثق لدي',
          inference:{ tool_used:false, actions:[] }
        });
      }
      return replyFor(content);
    });

    await expect(runProductionToolSmoke({
      baseUrl:'https://bonds-global.com',
      token:'token',
      expectedSha:'b'.repeat(40),
      fetchImpl,
      sleepImpl:async () => {},
      log:() => {}
    })).rejects.toThrow('How-to question did not run a governed tool');
  });
});
