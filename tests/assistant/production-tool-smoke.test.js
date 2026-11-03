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

describe('Assistant production tool smoke', () => {
  test('proves calculate, calculator open, and how-to search actually ran tools', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body.messages[0].content);

      if (calls.length === 1) {
        return jsonResponse(200, {
          reply:'الناتج: 180000',
          source:'bonds-assistant-ai-tool',
          inference:{ tool_used:true, actions:['math_calculate'], planner:'universal-v2-deterministic-tool' }
        });
      }
      if (calls.length === 2) {
        return jsonResponse(200, {
          reply:'حاسبة القرض\n/calculators/loan',
          source:'bonds-assistant-ai-tool',
          inference:{ tool_used:true, actions:['calculator_open'], planner:'universal-v2-deterministic-tool' }
        });
      }
      return jsonResponse(200, {
        reply:'1. How to make a budget\nhttps://example.com/budget',
        source:'bonds-assistant-ai-tool',
        inference:{ tool_used:true, actions:['web_search'], planner:'universal-v2-deterministic-research' }
      });
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
      web_search:true
    });
    expect(calls).toEqual([
      'احسب 18 بالمئة من مليون',
      'افتح حاسبة القرض',
      'كيف اعمل ميزانية'
    ]);
  });

  test('fails closed when a how-to answer skips search', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse(200, {
          reply:'الناتج: 180000',
          inference:{ tool_used:true, actions:['math_calculate'] }
        });
      }
      if (call === 2) {
        return jsonResponse(200, {
          reply:'حاسبة القرض\n/calculators/loan',
          inference:{ tool_used:true, actions:['calculator_open'] }
        });
      }
      return jsonResponse(200, {
        reply:'غير موثق لدي',
        inference:{ tool_used:false, actions:[] }
      });
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
