const {
  researchQuery,
  researchQueryVariants,
  relevanceSubject,
  relevanceProfile,
  rankRelevantSearchResults,
  filterRelevantPages,
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
              { title:'محمد بن سلمان - الملف التعريفي', url:'https://a.example/profile', snippet:'محمد بن سلمان ولي العهد السعودي' },
              { title:'سيرة محمد بن سلمان', url:'https://b.example/profile', snippet:'محمد بن سلمان المملكة العربية السعودية' }
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
                extracted:{ format:'html', title:'محمد بن سلمان - الملف التعريفي', text:'محمد بن سلمان ولي العهد السعودي، وهذه معلومات موثقة من المصدر الأول.' }
              },
              {
                url:'https://b.example/profile',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{ format:'html', title:'سيرة محمد بن سلمان', text:'محمد بن سلمان شخصية عامة سعودية، وهذه معلومات موثقة من المصدر الثاني.' }
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
              { title:'Transient query A', snippet:'transient query result A', url:'https://a.example/profile' },
              { title:'Transient query B', snippet:'transient query result B', url:'https://b.example/profile' }
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
              { url:'https://a.example/profile', evidence:{content_type:'text/html',headers:{}}, extracted:{format:'html',title:'Transient query A',text:'Transient query result A.'} },
              { url:'https://b.example/profile', evidence:{content_type:'text/html',headers:{}}, extracted:{format:'html',title:'Transient query B',text:'Transient query result B.'} }
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

  test('tries bounded query variants until it finds relevant results', async () => {
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
          result:{ results:[
            {title:'عمرو موسى',snippet:'عمرو موسى وزير خارجية مصري سابق',url:'https://example.com/amr'},
            {title:'Amr Moussa',snippet:'Amr Moussa biography',url:'https://example.org/amr'}
          ] }
        };
      }
      if (action === 'web_explore') {
        return { ok:true, executed:true, result:{ pages:[
          {url:'https://example.com/amr',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',title:'عمرو موسى',text:'عمرو موسى دبلوماسي وسياسي مصري.'}},
          {url:'https://example.org/amr',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',title:'Amr Moussa',text:'Amr Moussa is an Egyptian diplomat and politician.'}}
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

    expect(queries).toEqual(['عمر موسى','عمرو موسى','Amr Moussa']);
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
              {title:'Public person profile A',snippet:'public person background',url:'https://a.example/profile'},
              {title:'Public person profile B',snippet:'public person biography',url:'https://b.example/profile'},
              {title:'Public person profile C',snippet:'public person information',url:'https://c.example/profile'}
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
                {url:'https://a.example/profile',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',title:'Public person A',text:'Public person profile and background information.'}}
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
                {url:'https://b.example/profile',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',title:'Public person B',text:'Public person biography and career information.'}}
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

  test('extracts bounded query-relevant HTML evidence candidates', () => {
    const { htmlEvidenceClaims } = require('../../lib/intelligence/research-workflow');

    const claims = htmlEvidenceClaims({
      format:'html',
      text:[
        'Navigation and unrelated text.',
        'Mohammed bin Salman is Crown Prince of Saudi Arabia.',
        'This sentence is unrelated.',
        'Mohammed bin Salman chairs several national development bodies.'
      ].join(' ')
    }, 'Mohammed bin Salman');

    expect(claims.length).toBeGreaterThan(0);
    expect(claims.length).toBeLessThanOrEqual(6);
    expect(claims[0].text).toMatch(/Mohammed bin Salman/i);
  });

  test('does not confuse a short Arabic person name with another person sharing common name terms', () => {
    const { rankRelevantSearchResults } = require('../../lib/intelligence/research-workflow');

    const ranked = rankRelevantSearchResults([
      {
        title:'محمد بن عبدالله صلى الله عليه وسلم',
        snippet:'معلومات عن النبي محمد بن عبدالله',
        url:'https://religion.example/mohammed'
      },
      {
        title:'محمد بن سلمان',
        snippet:'محمد بن سلمان ولي العهد السعودي',
        url:'https://gov.example/mohammed-bin-salman'
      }
    ], 'محمد بن سلمان');

    expect(ranked).toHaveLength(1);
    expect(ranked[0].url).toBe('https://gov.example/mohammed-bin-salman');
  });


  test('ignores routed search operators and generic official-link words in relevance scoring', () => {
    const query = 'site:mof.gov.sa وزارة المالية السعودية الموقع الرسمي';
    expect(relevanceSubject(query)).toBe('وزارة المالية السعودية الموقع الرسمي');
    expect(relevanceProfile(query)).toEqual({
      terms:['وزارة','المالية','السعودية'],
      requiredMatches:3
    });

    const ranked = rankRelevantSearchResults([
      {
        title:'وزارة المالية - المملكة العربية السعودية',
        snippet:'الموقع الرسمي لوزارة المالية السعودية',
        url:'https://www.mof.gov.sa/ar/Pages/default.aspx'
      }
    ], query);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].url).toContain('mof.gov.sa');
  });

  test('accepts a matched registered institutional domain for explicit official-source relevance', () => {
    const ranked = rankRelevantSearchResults([
      {
        title:'وزارة المالية',
        snippet:'الخدمات الإلكترونية',
        url:'https://www.mof.gov.sa/ar/Pages/default.aspx'
      }
    ], 'وزارة المالية السعودية', {
      allowAuthoritativeInstitutionalMatch:true
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toEqual(expect.objectContaining({
      url:'https://www.mof.gov.sa/ar/Pages/default.aspx',
      institutional_source_id:'ministry_finance_sa',
      authoritative_primary:true
    }));
  });

  test('does not accept a different institutional domain for official-source relevance', () => {
    const ranked = rankRelevantSearchResults([
      {
        title:'وزارة التجارة',
        snippet:'الخدمات الإلكترونية',
        url:'https://mc.gov.sa/'
      }
    ], 'وزارة المالية السعودية', {
      allowAuthoritativeInstitutionalMatch:true
    });

    expect(ranked).toHaveLength(0);
  });

  test('uses explicit research topic as semantic relevance reference without breaking query variants', async () => {
    const { researchRelevanceQuery } = require('../../lib/intelligence/research-workflow');
    const request = {
      research:{
        query:'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.',
        topic:'وزارة المالية السعودية'
      }
    };

    expect(researchRelevanceQuery(request)).toBe('وزارة المالية السعودية');
    expect(researchRelevanceQuery({ research:{ query:'عمرو موسى' } })).toBe('');
  });

  test('rejects technically successful search results that are not relevant to the entity', () => {
    const ranked = rankRelevantSearchResults([
      {title:'Football news',snippet:'Latest league results',url:'https://sports.example'},
      {title:'محمد بن سلمان',snippet:'محمد بن سلمان ولي العهد السعودي',url:'https://gov.example/profile'}
    ], 'محمد بن سلمان');

    expect(ranked).toHaveLength(1);
    expect(ranked[0].url).toBe('https://gov.example/profile');
  });

  test('rejects fetched pages that do not satisfy entity relevance', () => {
    const pages = filterRelevantPages([
      {
        url:'https://irrelevant.example',
        extracted:{title:'General news',text:'Economic markets and weather updates.'}
      },
      {
        url:'https://relevant.example',
        extracted:{title:'الدكتور طلال حسن الزهراني',text:'الدكتور طلال حسن الزهراني مستشار وخبير مالي.'}
      }
    ], 'الدكتور طلال حسن الزهراني');

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe('https://relevant.example');
  });

  test('fails closed when fetched pages are insufficiently relevant', async () => {
    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          result:{results:[
            {title:'الدكتور طلال حسن الزهراني',snippet:'معلومات عن الدكتور طلال حسن الزهراني',url:'https://a.example'},
            {title:'الدكتور طلال حسن الزهراني',snippet:'سيرة الدكتور طلال حسن الزهراني',url:'https://b.example'}
          ]}
        };
      }
      if (action === 'web_explore') {
        return {
          ok:true,
          executed:true,
          result:{pages:[
            {url:'https://a.example',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',title:'General',text:'Unrelated market text only.'}},
            {url:'https://b.example',evidence:{content_type:'text/html',headers:{}},extracted:{format:'html',title:'General',text:'Another unrelated page.'}}
          ]}
        };
      }
      throw new Error('verification should not run for irrelevant pages');
    });

    const result = await runResearchWorkflow({
      input:'الدكتور طلال حسن الزهراني',
      forceResearch:true,
      research:{
        enabled:true,
        topic:'الدكتور طلال حسن الزهراني',
        queryVariants:['الدكتور طلال حسن الزهراني'],
        minIndependentPublishers:2
      }
    }, {}, {executeCapability});

    expect(result.status).toBe('insufficient_relevant_evidence');
    expect(result.unknowns).toContain('INSUFFICIENT_RELEVANT_EVIDENCE');
    expect(result.decisionEligible).toBe(false);
  });

  test('returns stage timings on successful research workflow', async () => {
    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        return {
          ok:true,
          result:{
            results:[
              {title:'Topic A',snippet:'Topic fact from A',url:'https://a.example'},
              {title:'Topic B',snippet:'Topic fact from B',url:'https://b.example'}
            ]
          }
        };
      }

      if (action === 'web_explore') {
        return {
          ok:true,
          result:{
            pages:[
              {
                url:'https://a.example',
                evidence:{content_type:'text/html',headers:{}},
                extracted:{format:'html',text:'Topic fact from A.'}
              },
              {
                url:'https://b.example',
                evidence:{content_type:'text/html',headers:{}},
                extracted:{format:'html',text:'Topic fact from B.'}
              }
            ]
          }
        };
      }

      if (action === 'evidence_verify') {
        return {
          ok:true,
          result:{
            verification_state:'SUPPORTED',
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
          result:{
            known:[],
            unknown:['NO_STRUCTURED_CLAIMS'],
            contradictions:[]
          }
        };
      }

      throw new Error('unexpected action');
    });

    const result = await runResearchWorkflow({
      query:'Topic',
      forceResearch:true,
      research:{enabled:true,minIndependentPublishers:2}
    }, {}, {executeCapability});

    expect(result.timings).toEqual(expect.objectContaining({
      search_ms:expect.any(Number),
      explore_ms:expect.any(Number),
      verify_ms:expect.any(Number),
      synthesize_ms:expect.any(Number)
    }));
  });

});
