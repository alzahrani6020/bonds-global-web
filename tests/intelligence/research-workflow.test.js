const {
  researchQuery,
  researchQueryVariants,
  runResearchWorkflow
} = require('../../lib/intelligence/research-workflow');

describe('BONDS query-led research workflow', () => {
  test('resolves a public query through search, exploration, verification and synthesis', async () => {
    const actions = [];
    const executeCapability = jest.fn(async (action, input) => {
      actions.push(action);

      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          result:{
            query:input.query,
            results:[
              { title:'Source A', url:'https://a.example/profile', snippet:'A' },
              { title:'Source B', url:'https://b.example/profile', snippet:'B' }
            ]
          }
        };
      }

      if (action === 'web_explore') {
        return {
          ok:true,
          executed:true,
          result:{
            pages:[
              {
                url:'https://a.example/profile',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{ format:'html', title:'Source A', text:'Verified source A content.' }
              },
              {
                url:'https://b.example/profile',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{ format:'html', title:'Source B', text:'Verified source B content.' }
              }
            ],
            failures:[],
            blocked:[]
          }
        };
      }

      if (action === 'evidence_verify') {
        return {
          ok:true,
          executed:true,
          result:{
            verification_state:'SUPPORTED',
            source_count:2,
            independent_publisher_count:2,
            supported_claims:[],
            contradictions:[],
            residual_uncertainty:['NO_STRUCTURED_CLAIMS'],
            sources:input.sources
          }
        };
      }

      if (action === 'research_synthesize') {
        return {
          ok:true,
          executed:true,
          result:{
            verification_state:'SUPPORTED',
            known:[],
            unknown:['NO_STRUCTURED_CLAIMS'],
            contradictions:[]
          }
        };
      }

      throw new Error('unexpected action: ' + action);
    });

    const result = await runResearchWorkflow({
      input:'من هو محمد بن سلمان؟',
      forceResearch:true,
      research:{
        enabled:true,
        topic:'من هو محمد بن سلمان؟',
        minIndependentPublishers:2,
        maxDepth:0
      }
    }, {}, { executeCapability });

    expect(actions).toEqual([
      'web_search',
      'web_explore',
      'evidence_verify',
      'research_synthesize'
    ]);
    expect(result.search.ok).toBe(true);
    expect(result.seeds).toEqual([
      'https://a.example/profile',
      'https://b.example/profile'
    ]);
    expect(result.decisionEligible).toBe(true);
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toEqual(expect.objectContaining({
      evidence_type:'research_source',
      validation_status:'source_verified',
      source_url:'https://a.example/profile'
    }));
  });

  test('retries one transient search failure and then continues', async () => {
    let searchCalls = 0;
    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        searchCalls += 1;
        if (searchCalls === 1) {
          return {
            ok:false,
            executed:true,
            error:{
              code:'SEARCH_NO_RESULTS',
              attempts:[
                { code:'SEARCH_UPSTREAM_FAILED', failure_class:'TIMEOUT', status_code:null }
              ]
            }
          };
        }
        return {
          ok:true,
          executed:true,
          result:{
            query:input.query,
            results:[
              { url:'https://a.example/profile' },
              { url:'https://b.example/profile' }
            ]
          }
        };
      }
      if (action === 'web_explore') {
        return {
          ok:true,
          executed:true,
          result:{
            pages:[
              { url:'https://a.example/profile', evidence:{content_type:'text/html',headers:{}}, extracted:{format:'html',text:'A'} },
              { url:'https://b.example/profile', evidence:{content_type:'text/html',headers:{}}, extracted:{format:'html',text:'B'} }
            ]
          }
        };
      }
      if (action === 'evidence_verify') {
        return {
          ok:true,
          executed:true,
          result:{
            verification_state:'SUPPORTED',
            supported_claims:[],
            contradictions:[],
            residual_uncertainty:[],
            sources:input.sources
          }
        };
      }
      if (action === 'research_synthesize') {
        return { ok:true, executed:true, result:{ unknown:[], contradictions:[] } };
      }
      throw new Error('unexpected action');
    });

    const result = await runResearchWorkflow({
      query:'transient query',
      forceResearch:true,
      research:{enabled:true}
    }, {}, { executeCapability });

    expect(searchCalls).toBe(2);
    expect(result.search_attempts).toHaveLength(2);
    expect(result.decisionEligible).toBe(true);
  });

  test('tries bounded query variants and stops on the first successful search', async () => {
    const queries = [];
    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        queries.push(input.query);
        if (input.query === 'عمر موسى') {
          return { ok:false, executed:true, error:{code:'SEARCH_NO_RESULTS',attempts:[{code:'SEARCH_NO_RESULTS',status_code:200}]} };
        }
        return {
          ok:true,
          executed:true,
          result:{ results:[{url:'https://example.com/amr'},{url:'https://example.org/amr'}] }
        };
      }
      if (action === 'web_explore') {
        return { ok:true, executed:true, result:{ pages:[
          {url:'https://example.com/amr',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',text:'A'}},
          {url:'https://example.org/amr',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',text:'B'}}
        ]}};
      }
      if (action === 'evidence_verify') {
        return { ok:true, executed:true, result:{verification_state:'SUPPORTED',supported_claims:[],sources:input.sources,contradictions:[],residual_uncertainty:[]} };
      }
      if (action === 'research_synthesize') {
        return { ok:true, executed:true, result:{unknown:[],contradictions:[]} };
      }
      throw new Error('unexpected action');
    });

    const result = await runResearchWorkflow({
      query:'عمر موسى',
      forceResearch:true,
      research:{
        enabled:true,
        queryVariants:['عمر موسى','عمرو موسى','Amr Moussa']
      }
    }, {}, {executeCapability});

    expect(queries).toEqual(['عمر موسى','عمرو موسى']);
    expect(result.selected_query).toBe('عمرو موسى');
    expect(result.attempted_queries).toEqual(['عمر موسى','عمرو موسى','Amr Moussa']);
    expect(result.decisionEligible).toBe(true);
  });

  test('recovers missing search seeds individually before evidence verification', async () => {
    let exploreCalls = 0;
    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          result:{
            results:[
              {url:'https://a.example/profile'},
              {url:'https://b.example/profile'},
              {url:'https://c.example/profile'}
            ]
          }
        };
      }

      if (action === 'web_explore') {
        exploreCalls += 1;
        if (exploreCalls === 1) {
          return {
            ok:true,
            executed:true,
            result:{
              pages:[
                {url:'https://a.example/profile',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',text:'A'}}
              ]
            }
          };
        }
        if (input.seedUrls[0] === 'https://b.example/profile') {
          return {
            ok:true,
            executed:true,
            result:{
              pages:[
                {url:'https://b.example/profile',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',text:'B'}}
              ]
            }
          };
        }
        return {ok:false,executed:true,error:{code:'WEB_ACQUISITION_FAILED'}};
      }

      if (action === 'evidence_verify') {
        expect(input.sources).toHaveLength(2);
        return {
          ok:true,
          executed:true,
          result:{
            verification_state:'SUPPORTED',
            supported_claims:[],
            contradictions:[],
            residual_uncertainty:[],
            sources:input.sources
          }
        };
      }

      if (action === 'research_synthesize') {
        return {ok:true,executed:true,result:{unknown:[],contradictions:[]}};
      }

      throw new Error('unexpected action: ' + action);
    });

    const result = await runResearchWorkflow({
      query:'public person',
      forceResearch:true,
      research:{enabled:true,minIndependentPublishers:2,maxDepth:0}
    }, {}, {executeCapability});

    expect(exploreCalls).toBe(2);
    expect(result.exploration.result.pages).toHaveLength(2);
    expect(result.exploration.result.recovery_attempts).toHaveLength(1);
    expect(result.decisionEligible).toBe(true);
  });

  test('fails closed when query-led search cannot produce results', async () => {
    const executeCapability = jest.fn(async action => {
      if (action === 'web_search') {
        return {
          ok:false,
          executed:true,
          error:{ code:'SEARCH_NO_RESULTS' }
        };
      }
      throw new Error('unexpected action');
    });

    const result = await runResearchWorkflow({
      query:'unknown public subject',
      forceResearch:true,
      research:{ enabled:true }
    }, {}, { executeCapability });

    expect(result.status).toBe('search_failed');
    expect(result.decisionEligible).toBe(false);
    expect(result.unknowns).toContain('SEARCH_NO_RESULTS');
  });

  test('resolves the research query from topic or request input', () => {
    expect(researchQuery({ research:{ topic:'topic' } })).toBe('topic');
    expect(researchQuery({ input:'input' })).toBe('input');
    expect(researchQueryVariants({ research:{ queryVariants:['a','b'], query:'a' } })).toEqual(['a','b']);
  });
});
