const {
  containsOfficialMofDomain,
  safeDiagnosticsSummary,
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
          inference:{ tool_used:true },
          diagnostics:{
            path:'UNIVERSAL_ORCHESTRATOR',
            status:'PASS',
            evidence:{ decision_eligible:true, source_count:2 }
          }
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
      evidence_backed:true,
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


  test('safe diagnostics summary exposes metadata only', () => {
    const summary = safeDiagnosticsSummary({
      reply:'SECRET_REPLY_SHOULD_NOT_LEAK https://private.example/path',
      source:'bonds-assistant-ai-tool',
      inference:{
        tool_used:true,
        actions:['web_search','web_explore'],
        raw_trace:[{ secret:'NOPE' }]
      },
      diagnostics:{
        path:'UNIVERSAL_ORCHESTRATOR',
        status:'FAIL',
        pipeline_stage:'research_acquisition',
        root_cause_stage:'search_relevance',
        failure_stage:'search_relevance',
        error_code:'SEARCH_LOW_RELEVANCE',
        evidence:{
          decision_eligible:false,
          source_count:0,
          evidence_count:0,
          unknown_count:1,
          contradiction_count:0
        },
        acquisition_trace:{
          failure_samples:[{ url:'https://private.example/path' }]
        }
      }
    });

    expect(summary).toEqual({
      source:'bonds-assistant-ai-tool',
      tool_used:true,
      actions:['web_search','web_explore'],
      path:'UNIVERSAL_ORCHESTRATOR',
      status:'FAIL',
      pipeline_stage:'research_acquisition',
      root_cause_stage:'search_relevance',
      failure_stage:'search_relevance',
      error_code:'SEARCH_LOW_RELEVANCE',
      decision_eligible:false,
      source_count:0,
      evidence_count:0,
      unknown_count:1,
      contradiction_count:0
    });
    expect(JSON.stringify(summary)).not.toContain('SECRET_REPLY_SHOULD_NOT_LEAK');
    expect(JSON.stringify(summary)).not.toContain('private.example');
    expect(JSON.stringify(summary)).not.toContain('raw_trace');
  });

  test('logs safe diagnostics metadata when evidence-backed research proof fails', async () => {
    const logs = [];
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      reply:'وزارة المالية السعودية',
      source:'bonds-assistant-ai-tool',
      inference:{ tool_used:true, actions:['web_search'] },
      diagnostics:{
        path:'UNIVERSAL_ORCHESTRATOR',
        status:'FAIL',
        pipeline_stage:'research_acquisition',
        root_cause_stage:'search_relevance',
        failure_stage:'search_relevance',
        error_code:'SEARCH_LOW_RELEVANCE',
        evidence:{
          decision_eligible:false,
          source_count:0,
          evidence_count:0,
          unknown_count:1,
          contradiction_count:0
        }
      }
    }));

    await expect(runProductionConversationalSmoke({
      baseUrl:'https://bonds-global.com',
      token:'token',
      expectedSha:'e'.repeat(40),
      fetchImpl,
      sleepImpl:async () => {},
      log:value => logs.push(String(value))
    })).rejects.toThrow('successful evidence-backed research pipeline');

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('BONDS conversational smoke diagnostics');
    expect(logs[0]).toContain('"root_cause_stage":"search_relevance"');
    expect(logs[0]).toContain('"decision_eligible":false');
    expect(logs[0]).not.toContain('وزارة المالية السعودية');
  });

  test('fails closed when evidence is valid but the verified official URL is missing', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      reply:'وزارة المالية السعودية',
      source:'bonds-assistant-ai-tool',
      inference:{ tool_used:true },
      diagnostics:{
        path:'UNIVERSAL_ORCHESTRATOR',
        status:'PASS',
        evidence:{ decision_eligible:true, source_count:2 }
      }
    }));

    await expect(runProductionConversationalSmoke({
      baseUrl:'https://bonds-global.com',
      token:'token',
      expectedSha:'d'.repeat(40),
      fetchImpl,
      sleepImpl:async () => {},
      log:() => {}
    })).rejects.toThrow('verified official mof.gov.sa domain');
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
  test('fails closed when evidence-backed research diagnostics are missing', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse(200, {
          reply:'وزارة المالية السعودية',
          source:'bonds-assistant-ai-tool',
          inference:{ tool_used:true },
          diagnostics:{
            path:'UNIVERSAL_ORCHESTRATOR',
            status:'PASS',
            evidence:{ decision_eligible:true, source_count:0 }
          }
        });
      }
      return jsonResponse(200, { reply:'وزارة المالية' });
    });

    await expect(runProductionConversationalSmoke({
      baseUrl:'https://bonds-global.com',
      token:'token',
      expectedSha:'c'.repeat(40),
      fetchImpl,
      sleepImpl:async () => {},
      log:() => {}
    })).rejects.toThrow('successful evidence-backed research pipeline');
  });

});
