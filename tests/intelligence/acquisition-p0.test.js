/** @jest-environment node */

const {
  findInstitutionalSources,
  isInstitutionalDomain
} = require('../../lib/intelligence/institutional-source-registry');
const {
  buildSearchRoute,
  relationAliases
} = require('../../lib/intelligence/search-router');
const {
  scoreRelationCandidate,
  rankRelationAwareResults
} = require('../../lib/intelligence/relation-reranker');
const {
  providerCircuitFailures,
  runResearchWorkflow
} = require('../../lib/intelligence/research-workflow');

describe('BONDS Acquisition P0', () => {
  test('resolves Aramco relation lookup to official institutional sources first', () => {
    const entityFrame = {
      entity_type:'relation',
      canonical_name:'شركة أرامكو',
      relations:[{value:'رئيس'}],
      organizations:[{value:'شركة أرامكو'}],
      qualifiers:[]
    };

    const sources = findInstitutionalSources({
      entityFrame,
      query:'من هو رئيس شركة أرامكو؟',
      intent:'relation_lookup'
    });

    expect(sources[0]).toEqual(expect.objectContaining({
      id:'saudi_aramco',
      authority_score:1
    }));
    expect(isInstitutionalDomain('https://www.aramco.com/en/who-we-are/our-leadership'))
      .toEqual(expect.objectContaining({id:'saudi_aramco'}));

    const route = buildSearchRoute({
      intent:'relation_lookup',
      entityFrame,
      query:'رئيس شركة أرامكو'
    });

    expect(route.preferred_domains).toEqual(expect.arrayContaining(['aramco.com']));
    expect(route.query_variants).toEqual(expect.arrayContaining([
      'رئيس شركة أرامكو',
      'president شركة أرامكو',
      'site:aramco.com رئيس شركة أرامكو'
    ]));
  });

  test('maps relation aliases across Arabic and English', () => {
    expect(relationAliases('رئيس')).toEqual(expect.arrayContaining([
      'رئيس',
      'president',
      'chief executive',
      'ceo'
    ]));
  });

  test('relation reranker accepts English official leadership evidence for Arabic query', () => {
    const entityFrame = {
      entity_type:'relation',
      canonical_name:'شركة أرامكو',
      relations:[{value:'رئيس'}],
      organizations:[{value:'شركة أرامكو'}]
    };

    const ranked = rankRelationAwareResults([
      {
        title:'Saudi Aramco President & CEO Amin H. Nasser',
        snippet:'Amin H. Nasser is President and CEO of Saudi Aramco.',
        url:'https://www.aramco.com/en/who-we-are/our-leadership/amin-h-nasser'
      },
      {
        title:'Football president news',
        snippet:'President of a football club.',
        url:'https://sports.example/news'
      }
    ], entityFrame);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].url).toContain('aramco.com');
    expect(ranked[0].relation_relevance.organization_support).toBe(1);
    expect(ranked[0].relation_relevance.relation_support).toBeGreaterThan(0);
    expect(ranked[0].relation_relevance.institutional_support).toBe(1);
  });

  test('extracts unhealthy providers for request-scoped circuit breaker', () => {
    expect(providerCircuitFailures({
      ok:false,
      error:{
        attempts:[
          {provider:'searxng',code:'SEARX_UPSTREAM_FAILED',status_code:429},
          {provider:'duckduckgo',code:'SEARCH_UPSTREAM_FAILED',status_code:403},
          {provider:'bing',code:'SEARCH_RESULTS_FOUND',status_code:200},
          {provider:'brave',code:'SEARCH_UPSTREAM_FAILED',status_code:503}
        ]
      }
    })).toEqual(expect.arrayContaining(['searxng','duckduckgo','brave']));
  });

  test('relation workflow carries circuit breaker across query variants and uses semantic relation reranking', async () => {
    const searchInputs = [];
    let searchCall = 0;

    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        searchCall += 1;
        searchInputs.push({...input});

        if (searchCall === 1) {
          return {
            ok:false,
            executed:true,
            error:{
              code:'SEARCH_NO_RESULTS',
              attempts:[
                {provider:'searxng',code:'SEARX_UPSTREAM_FAILED',status_code:429},
                {provider:'duckduckgo',code:'SEARCH_UPSTREAM_FAILED',status_code:403}
              ]
            },
            evidence:{
              attempts:[
                {provider:'searxng',code:'SEARX_UPSTREAM_FAILED',status_code:429},
                {provider:'duckduckgo',code:'SEARCH_UPSTREAM_FAILED',status_code:403}
              ]
            }
          };
        }

        return {
          ok:true,
          executed:true,
          result:{
            results:[
              {
                title:'Saudi Aramco President & CEO Amin H. Nasser',
                snippet:'Amin H. Nasser is President and CEO of Saudi Aramco.',
                url:'https://www.aramco.com/en/who-we-are/our-leadership/amin-h-nasser'
              },
              {
                title:'Saudi Aramco leadership',
                snippet:'Leadership and governance at Saudi Aramco including the President & CEO.',
                url:'https://www.aramco.com/en/who-we-are/our-leadership'
              }
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
                url:'https://www.aramco.com/en/who-we-are/our-leadership/amin-h-nasser',
                evidence:{content_type:'text/html',headers:{}},
                extracted:{
                  format:'html',
                  title:'Amin H. Nasser',
                  text:'Amin H. Nasser is President and CEO of Saudi Aramco.'
                }
              },
              {
                url:'https://www.aramco.com/en/who-we-are/our-leadership',
                evidence:{content_type:'text/html',headers:{}},
                extracted:{
                  format:'html',
                  title:'Saudi Aramco leadership',
                  text:'Saudi Aramco leadership includes President and CEO Amin H. Nasser.'
                }
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
            supported_claims:[],
            contradictions:[],
            residual_uncertainty:[],
            sources:input.sources
          }
        };
      }

      if (action === 'research_synthesize') {
        return {ok:true,executed:true,result:{known:[],unknown:[],contradictions:[]}};
      }

      throw new Error('unexpected action ' + action);
    });

    const result = await runResearchWorkflow({
      input:'من هو رئيس شركة أرامكو؟',
      forceResearch:true,
      research:{
        enabled:true,
        intent:'relation_lookup',
        query:'رئيس شركة أرامكو',
        queryVariants:['رئيس شركة أرامكو','شركة أرامكو رئيس'],
        entityFrame:{
          entity_type:'relation',
          canonical_name:'شركة أرامكو',
          relations:[{value:'رئيس'}],
          organizations:[{value:'شركة أرامكو'}],
          qualifiers:[]
        },
        minIndependentPublishers:2,
        maxDepth:0
      }
    }, {}, {executeCapability});

    expect(searchInputs.length).toBeGreaterThanOrEqual(2);
    expect(searchInputs[1].disabledProviders).toEqual(
      expect.arrayContaining(['searxng','duckduckgo'])
    );
    expect(searchInputs.some(input => String(input.query).includes('site:aramco.com'))).toBe(true);
    expect(result.status).not.toBe('search_low_relevance');
    expect(result.seeds.every(url => url.includes('aramco.com'))).toBe(true);
    expect(result.search_route.preferred_domains).toEqual(expect.arrayContaining(['aramco.com']));
    expect(result.disabled_search_providers).toEqual(
      expect.arrayContaining(['searxng','duckduckgo'])
    );
  });
});
