const {
  containsOfficialMofDomain,
  runProductionConversationalSmoke
} = require('../../lib/assistant/production-conversational-smoke');

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: key => headers[String(key).toLowerCase()] || null },
    text: async () => JSON.stringify(body)
  };
}

describe('Assistant production conversational smoke', () => {
  test('recognizes the official Ministry of Finance domain', () => {
    expect(containsOfficialMofDomain('https://www.mof.gov.sa/ar/Pages/default.aspx')).toBe(true);
    expect(containsOfficialMofDomain('https://example.com/mof.gov.sa.fake')).toBe(false);
  });

  test('proves governed research plus follow-up context without force_native or writes', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, options, body });

      if (calls.length === 1) {
        return jsonResponse(200, {
          reply:'وزارة المالية السعودية — https://www.mof.gov.sa/',
          source:'bonds-assistant-ai-tool',
          inference:{ tool_used:true }
        });
      }

      return jsonResponse(200, {
        reply:'https://www.mof.gov.sa/',
        source:'bonds-assistant-ai',
        inference:{ tool_used:false }
      });
    });

    const result = await runProductionConversationalSmoke({
      baseUrl:'https://bonds-global.com',
      token:'token',
      expectedSha:'a'.repeat(40),
      fetchImpl,
      sleepImpl:async () => {},
      log:() => {}
    });

    expect(result).toEqual(expect.objectContaining({
      ok:true,
      research_tool_used:true,
      follow_up_context:true,
      official_domain:'mof.gov.sa'
    }));
    expect(calls).toHaveLength(2);
    expect(calls.every(call => call.url.endsWith('/api/v3/ai/chat'))).toBe(true);
    expect(calls.every(call => call.options.method === 'POST')).toBe(true);
    expect(calls.every(call => call.body.options?.force_native === undefined)).toBe(true);
    expect(calls.every(call => call.body.context?.pagePath === '/')).toBe(true);
    expect(calls[0].body.messages).toHaveLength(1);
    expect(calls[1].body.messages).toHaveLength(3);
    expect(calls[1].body.messages[1].role).toBe('assistant');
  });

  test('fails closed when research does not prove tool use', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      reply:'https://www.mof.gov.sa/',
      source:'bonds-assistant-ai',
      inference:{ tool_used:false }
    }));

    await expect(runProductionConversationalSmoke({
      baseUrl:'https://bonds-global.com',
      token:'token',
      expectedSha:'b'.repeat(40),
      fetchImpl,
      sleepImpl:async () => {},
      log:() => {}
    })).rejects.toThrow('did not prove governed tool use');
  });
});
