const {
  publisherKey,
  researchSources,
  deterministicResearchAnswer,
  runUniversalOrchestrator
} = require('../../lib/assistant/universal-orchestrator');
const { resolveLanguageQuery } = require('../../lib/assistant/language-query-resolver');
const { verifyEvidence } = require('../../lib/intelligence/research-intelligence');

jest.mock('../../lib/services/service-execution-router', () => ({
  executeGovernedAction: jest.fn()
}));

const { executeGovernedAction } = require('../../lib/services/service-execution-router');

describe('governed person research independent sources regression', () => {
  beforeEach(() => {
    executeGovernedAction.mockReset();
  });

  test('keeps person definitions evidence-bound and requires independent publishers', async () => {
    const plan = resolveLanguageQuery('من هو حسني مبارك؟', { context:{} });
    expect(plan.intent).toBe('person_lookup');
    expect(plan.requires_research).toBe(true);

    expect(publisherKey('https://ar.wikipedia.org/wiki/Hosni_Mubarak'))
      .toBe('wikipedia.org');
    expect(publisherKey('https://en.wikipedia.org/wiki/Hosni_Mubarak'))
      .toBe('wikipedia.org');

    const wikipediaVerification = verifyEvidence({
      topic:'حسني مبارك',
      minIndependentPublishers:2,
      sources:[
        {
          url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
          publisher:'ar.wikipedia.org',
          text:'محمد حسني مبارك سياسي وعسكري مصري.'
        },
        {
          url:'https://en.wikipedia.org/wiki/Hosni_Mubarak',
          publisher:'en.wikipedia.org',
          text:'Hosni Mubarak was an Egyptian politician.'
        }
      ]
    });
    expect(wikipediaVerification.ok).toBe(false);
    expect(wikipediaVerification.result.independent_publisher_count).toBe(1);

    const fixture = {
      verification:{
        sources:[
          {
            title:'Hosni Mubarak | Britannica',
            url:'https://www.britannica.com/biography/Hosni-Mubarak',
            text:'Hosni Mubarak was an Egyptian military officer and politician who served as president of Egypt from 1981 until 2011.'
          },
          {
            title:'حسني مبارك - ويكيبيديا',
            url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
            text:'محمد حسني مبارك سياسي وعسكري مصري شغل منصب رئيس جمهورية مصر العربية.'
          },
          {
            title:'Hosni Mubarak - Wikipedia',
            url:'https://en.wikipedia.org/wiki/Hosni_Mubarak',
            text:'Hosni Mubarak was an Egyptian politician and military officer.'
          }
        ],
        result:{ independent_publisher_count:2 }
      }
    };

    const sources = researchSources(fixture);
    expect(sources).toHaveLength(2);
    expect(sources.map(item => item.publisher)).toEqual(
      expect.arrayContaining(['britannica.com', 'wikipedia.org'])
    );

    const answer = deterministicResearchAnswer('من هو حسني مبارك؟', fixture, plan);
    expect(answer.indexOf('Hosni Mubarak was an Egyptian military officer')).toBe(0);
    expect(answer.indexOf('المصادر:')).toBeGreaterThan(0);
    expect(answer).toContain('britannica.com/biography/Hosni-Mubarak');
    expect(answer).toContain('ar.wikipedia.org');
    expect(answer).not.toContain('en.wikipedia.org');
    expect(answer.split('\n')[0]).toBe(
      'Hosni Mubarak was an Egyptian military officer and politician who served as president of Egypt from 1981 until 2011.'
    );

    const wikipediaOnly = {
      verification:{
        sources:[
          {
            title:'حسني مبارك - ويكيبيديا',
            url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
            text:'محمد حسني مبارك سياسي وعسكري مصري.'
          },
          {
            title:'Hosni Mubarak - Wikipedia',
            url:'https://en.wikipedia.org/wiki/Hosni_Mubarak',
            text:'Hosni Mubarak was an Egyptian politician.'
          }
        ],
        result:{ independent_publisher_count:1 }
      }
    };
    expect(deterministicResearchAnswer('من هو حسني مبارك؟', wikipediaOnly, plan))
      .toBe('لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.');

    const oneVerifiedPlusSearchOnly = {
      verification:{
        sources:[
          {
            title:'حسني مبارك - ويكيبيديا',
            url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
            text:'محمد حسني مبارك سياسي وعسكري مصري.'
          }
        ],
        result:{ independent_publisher_count:1 }
      },
      search:{
        result:{
          results:[
            {
              title:'Hosni Mubarak | Britannica',
              url:'https://www.britannica.com/biography/Hosni-Mubarak',
              snippet:'Hosni Mubarak was an Egyptian military officer and politician.'
            }
          ]
        }
      }
    };
    expect(researchSources(oneVerifiedPlusSearchOnly)).toHaveLength(2);
    expect(deterministicResearchAnswer('من هو حسني مبارك؟', oneVerifiedPlusSearchOnly, plan))
      .toBe('لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.');

    let verifyInput = null;
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN');
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          action_fabric:{ side_effect:'network_read' },
          result:{
            query:input.query,
            results:[
              {
                title:'Hosni Mubarak | Britannica',
                url:'https://www.britannica.com/biography/Hosni-Mubarak',
                snippet:'Hosni Mubarak was an Egyptian military officer and politician who served as president of Egypt from 1981 until 2011.'
              },
              {
                title:'حسني مبارك - ويكيبيديا',
                url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
                snippet:'محمد حسني مبارك سياسي وعسكري مصري شغل منصب رئيس جمهورية مصر العربية.'
              }
            ]
          }
        };
      }
      if (action === 'web_explore') {
        return {
          ok:true,
          executed:true,
          action_fabric:{ side_effect:'network_read' },
          result:{
            pages:[
              {
                url:'https://www.britannica.com/biography/Hosni-Mubarak',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{
                  format:'html',
                  title:'Hosni Mubarak | Britannica',
                  text:'Hosni Mubarak was an Egyptian military officer and politician who served as president of Egypt from 1981 until 2011.'
                }
              },
              {
                url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{
                  format:'html',
                  title:'حسني مبارك - ويكيبيديا',
                  text:'محمد حسني مبارك سياسي وعسكري مصري شغل منصب رئيس جمهورية مصر العربية.'
                }
              }
            ]
          }
        };
      }
      if (action === 'evidence_verify') {
        verifyInput = input;
        return {
          ok:true,
          executed:true,
          action_fabric:{ side_effect:'compute' },
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
          action_fabric:{ side_effect:'compute' },
          result:{
            verification_state:'SUPPORTED',
            known:[],
            unknown:['NO_STRUCTURED_CLAIMS'],
            contradictions:[]
          }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const result = await runUniversalOrchestrator(
      [{ role:'user', content:'من هو حسني مبارك؟' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(verifyInput).not.toBeNull();
    expect(verifyInput.minIndependentPublishers).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.planner).toBe('universal-v2-deterministic-research');
    expect(result.reply.indexOf('Hosni Mubarak was an Egyptian military officer')).toBe(0);
    expect(result.reply).toContain('المصادر:');
    expect(result.reply).toContain('britannica.com');
    expect(result.reply).toContain('ar.wikipedia.org');
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);

    executeGovernedAction.mockReset();
    executeGovernedAction.mockImplementation(async ({ action, input }) => {
      if (action === 'ai_reason') throw new Error('AI_REASON_MUST_NOT_RUN_ON_INSUFFICIENT_PERSON_EVIDENCE');
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          action_fabric:{ side_effect:'network_read' },
          result:{
            query:input.query,
            results:[
              {
                title:'حسني مبارك - ويكيبيديا',
                url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
                snippet:'محمد حسني مبارك سياسي وعسكري مصري.'
              },
              {
                title:'Hosni Mubarak - Wikipedia',
                url:'https://en.wikipedia.org/wiki/Hosni_Mubarak',
                snippet:'Hosni Mubarak was an Egyptian politician.'
              }
            ]
          }
        };
      }
      if (action === 'web_explore') {
        return {
          ok:true,
          executed:true,
          action_fabric:{ side_effect:'network_read' },
          result:{
            pages:[
              {
                url:'https://ar.wikipedia.org/wiki/%D8%AD%D8%B3%D9%86%D9%8A_%D9%85%D8%A8%D8%A7%D8%B1%D9%83',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{ format:'html', title:'حسني مبارك - ويكيبيديا', text:'محمد حسني مبارك سياسي وعسكري مصري.' }
              },
              {
                url:'https://en.wikipedia.org/wiki/Hosni_Mubarak',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{ format:'html', title:'Hosni Mubarak - Wikipedia', text:'Hosni Mubarak was an Egyptian politician.' }
              }
            ]
          }
        };
      }
      if (action === 'evidence_verify') {
        return {
          ok:false,
          executed:true,
          action_fabric:{ side_effect:'compute' },
          result:{
            verification_state:'INSUFFICIENT_EVIDENCE',
            source_count:2,
            independent_publisher_count:1,
            supported_claims:[],
            contradictions:[],
            residual_uncertainty:['INSUFFICIENT_INDEPENDENT_SOURCES'],
            sources:input.sources
          }
        };
      }
      if (action === 'research_synthesize') {
        return {
          ok:false,
          executed:true,
          action_fabric:{ side_effect:'compute' },
          result:{
            verification_state:'INSUFFICIENT_EVIDENCE',
            known:[],
            unknown:['INSUFFICIENT_INDEPENDENT_SOURCES'],
            contradictions:[]
          }
        };
      }
      throw new Error('UNEXPECTED_ACTION:' + action);
    });

    const insufficient = await runUniversalOrchestrator(
      [{ role:'user', content:'من هو حسني مبارك؟' }],
      {},
      { req:{ headers:{} }, user:{ id:'u1' }, supabase:{} }
    );

    expect(insufficient.ok).toBe(true);
    expect(insufficient.reply).toBe('لم أجد مصادر مستقلة كافية لتقديم تعريف موثق.');
    expect(insufficient.research.decision_eligible).toBe(false);
    expect(insufficient.research.initial_quality_code).toBe('INSUFFICIENT_INDEPENDENT_SOURCES');
    expect(executeGovernedAction.mock.calls.some(call => call[0].action === 'ai_reason')).toBe(false);
  });
});
