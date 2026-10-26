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
          inference:{ tool_used:true },
          diagnostics:{
            path:'OPEN_CHAT_RESEARCH',
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

  test('fails closed when evidence is valid but the verified official URL is missing', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, {
      reply:'وزارة المالية السعودية',
      source:'bonds-assistant-ai-tool',
      inference:{ tool_used:true },
      diagnostics:{
        path:'OPEN_CHAT_RESEARCH',
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
            path:'OPEN_CHAT_RESEARCH',
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

describe('official source URL research contract', () => {
  const {
    officialUrlRequest,
    officialUrlOnlyRequest,
    verifiedOfficialSourceUrl,
    ensureRequestedOfficialUrl
  } = require('../../lib/assistant/open-chat-tool-loop');
  const { buildSearchRoute } = require('../../lib/intelligence/search-router');
  const { findInstitutionalSources } = require('../../lib/intelligence/institutional-source-registry');

  test('routes Saudi Ministry of Finance research through its official institutional domain', () => {
    const sources = findInstitutionalSources({
      query:'وزارة المالية السعودية الموقع الرسمي',
      intent:'web_research',
      country:'SA'
    });
    expect(sources.some(source =>
      source.id === 'ministry_finance_sa' &&
      source.domains.includes('mof.gov.sa')
    )).toBe(true);

    const route = buildSearchRoute({
      query:'وزارة المالية السعودية الموقع الرسمي',
      intent:'web_research',
      country:'SA'
    });
    expect(route.preferred_domains).toContain('mof.gov.sa');
    expect(route.query_variants.some(query => query.includes('site:mof.gov.sa'))).toBe(true);
  });

  test('enforces a verified institutional URL when the user explicitly requests the official link', () => {
    const intent = {
      current:'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.',
      query:'وزارة المالية السعودية الموقع الرسمي',
      language_plan:{
        raw_text:'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.'
      }
    };
    const sources = [
      {
        title:'وزارة المالية',
        publisher:'Ministry of Finance',
        url:'https://www.mof.gov.sa/ar/Pages/default.aspx'
      },
      {
        title:'Example',
        publisher:'Example',
        url:'https://example.com/ministry-of-finance'
      }
    ];

    expect(officialUrlRequest(intent)).toBe(true);
    expect(officialUrlOnlyRequest(intent)).toBe(false);
    expect(verifiedOfficialSourceUrl(sources)).toContain('mof.gov.sa');

    const reply = ensureRequestedOfficialUrl(
      'وزارة المالية السعودية',
      intent,
      sources
    );

    expect(reply).toContain('وزارة المالية السعودية');
    expect(reply).toContain('https://www.mof.gov.sa/ar/Pages/default.aspx');
  });

  test('returns only the official URL when the user explicitly asks for the link only', () => {
    const intent = {
      current:'أعطني الرابط الرسمي فقط',
      language_plan:{ raw_text:'أعطني الرابط الرسمي فقط' }
    };
    const sources = [{
      title:'وزارة المالية',
      publisher:'Ministry of Finance',
      url:'https://www.mof.gov.sa/ar/Pages/default.aspx'
    }];

    expect(officialUrlOnlyRequest(intent)).toBe(true);
    expect(ensureRequestedOfficialUrl('وزارة المالية السعودية', intent, sources))
      .toBe('https://www.mof.gov.sa/ar/Pages/default.aspx');
  });

  test('does not duplicate a verified official URL already present in the answer', () => {
    const {
      ensureRequestedOfficialUrl
    } = require('../../lib/assistant/open-chat-tool-loop');
    const intent = {
      current:'اذكر اسم الجهة والرابط الرسمي فقط',
      language_plan:{ raw_text:'اذكر اسم الجهة والرابط الرسمي فقط' }
    };
    const officialUrl = 'https://www.mof.gov.sa/ar/Pages/default.aspx';
    const reply = `وزارة المالية السعودية\n${officialUrl}`;
    const result = ensureRequestedOfficialUrl(reply, intent, [{
      title:'وزارة المالية',
      publisher:'Ministry of Finance',
      url:officialUrl
    }]);

    expect(result).toBe(reply);
    expect((result.match(/mof\.gov\.sa/g) || []).length).toBe(1);
  });

  test('does not invent an official URL when verified institutional evidence is absent', () => {
    const intent = {
      current:'أعطني الرابط الرسمي فقط',
      language_plan:{ raw_text:'أعطني الرابط الرسمي فقط' }
    };
    const reply = ensureRequestedOfficialUrl(
      'الجهة الرسمية',
      intent,
      [{ url:'https://example.com/' }]
    );
    expect(reply).toBe('الجهة الرسمية');
  });
});
