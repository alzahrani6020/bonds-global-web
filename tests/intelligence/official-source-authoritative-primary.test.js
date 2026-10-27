/** @jest-environment node */

const {
  verifyEvidence,
  synthesizeResearch
} = require('../../lib/intelligence/research-intelligence');
const {
  runResearchWorkflow
} = require('../../lib/intelligence/research-workflow');

describe('Authoritative primary evidence for official-source lookup', () => {
  const officialSource = {
    id:'official-mof',
    publisher:'www.mof.gov.sa',
    url:'https://www.mof.gov.sa/',
    authoritative_primary:true,
    authority_score:1,
    institutional_source_id:'ministry_finance_sa',
    relevance_score:1,
    claims:[],
    text:'وزارة المالية السعودية الموقع الرسمي والخدمات والمعلومات الحكومية.'
  };

  test('does not waive independent-source requirement by default', () => {
    const strict = verifyEvidence({
      topic:'الموقع الرسمي لوزارة المالية السعودية',
      sources:[officialSource],
      minIndependentPublishers:2
    });

    expect(strict.ok).toBe(false);
    expect(strict.result.residual_uncertainty)
      .toContain('INSUFFICIENT_INDEPENDENT_SOURCES');
    expect(strict.result.authoritative_primary_evidence_used).toBe(false);
  });

  test('accepts one registered authoritative primary source only when explicitly enabled', () => {
    const verified = verifyEvidence({
      topic:'الموقع الرسمي لوزارة المالية السعودية',
      sources:[officialSource],
      minIndependentPublishers:2,
      allowAuthoritativePrimaryEvidence:true
    });

    expect(verified.ok).toBe(true);
    expect(verified.result.verification_state).toBe('SUPPORTED');
    expect(verified.result.authoritative_primary_used).toBe(true);
    expect(verified.result.authoritative_primary_evidence_used).toBe(true);
    expect(verified.result.residual_uncertainty)
      .not.toContain('INSUFFICIENT_INDEPENDENT_SOURCES');
  });

  test('does not accept a non-authoritative source even when explicitly enabled', () => {
    const untrusted = verifyEvidence({
      topic:'الموقع الرسمي لوزارة المالية السعودية',
      sources:[{
        ...officialSource,
        publisher:'example.com',
        url:'https://example.com/mof',
        authoritative_primary:false,
        authority_score:0.4,
        institutional_source_id:null
      }],
      minIndependentPublishers:2,
      allowAuthoritativePrimaryEvidence:true
    });

    expect(untrusted.ok).toBe(false);
    expect(untrusted.result.authoritative_primary_evidence_used).toBe(false);
  });

  test('workflow bounds acquisition to the registered official source and becomes decision eligible', async () => {
    const calls = [];
    const executeCapability = jest.fn(async (action, input) => {
      calls.push({action,input});

      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          result:{
            results:[
              {
                title:'وزارة المالية السعودية',
                snippet:'الموقع الرسمي لوزارة المالية السعودية',
                url:'https://www.mof.gov.sa/'
              },
              {
                title:'دليل غير رسمي',
                snippet:'وزارة المالية السعودية',
                url:'https://example.com/mof'
              }
            ]
          }
        };
      }

      if (action === 'web_explore') {
        expect(input.maxDepth).toBe(0);
        expect(input.seedUrls).toEqual([
          'https://www.mof.gov.sa/'
        ]);
        return {
          ok:true,
          executed:true,
          result:{
            pages:[{
              url:'https://www.mof.gov.sa/',
              evidence:{content_type:'text/html',headers:{}},
              extracted:{
                format:'html',
                title:'وزارة المالية',
                text:'وزارة المالية السعودية الموقع الرسمي والخدمات والمعلومات الحكومية.'
              }
            }],
            failures:[],
            blocked:[],
            coverage:{
              discovered_count:1,
              visited_count:1,
              successful_count:1,
              failed_count:0,
              blocked_count:0
            }
          }
        };
      }

      if (action === 'evidence_verify') return verifyEvidence(input);
      if (action === 'research_synthesize') return synthesizeResearch(input);
      throw new Error('unexpected action ' + action);
    });

    const result = await runResearchWorkflow({
      input:'الموقع الرسمي لوزارة المالية السعودية',
      forceResearch:true,
      research:{
        enabled:true,
        query:'الموقع الرسمي لوزارة المالية السعودية',
        queryVariants:['الموقع الرسمي لوزارة المالية السعودية'],
        topic:'وزارة المالية السعودية',
        intent:'web_research',
        minIndependentPublishers:2,
        allowAuthoritativePrimaryEvidence:true,
        maxPages:5,
        maxDepth:1
      }
    }, {}, {executeCapability});

    expect(result.decisionEligible).toBe(true);
    expect(result.status).toBe('SUPPORTED');
    expect(result.authoritative_primary_evidence_fast_path).toBe(true);
    expect(result.verification.result.authoritative_primary_evidence_used).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(calls.filter(item => item.action === 'web_explore')).toHaveLength(1);
    expect(calls.filter(item => item.action === 'evidence_verify')).toHaveLength(1);
    expect(calls.filter(item => item.action === 'research_synthesize')).toHaveLength(1);
  });
  test('uses the governed institutional registry directly for explicit official URL lookup', async () => {
    const calls = [];
    const executeCapability = jest.fn(async (action, input) => {
      calls.push({action,input});

      if (action === 'web_explore') {
        expect(input.seedUrls).toEqual(['https://www.mof.gov.sa/']);
        return {
          ok:true,
          executed:true,
          result:{
            pages:[{
              url:'https://www.mof.gov.sa/',
              evidence:{content_type:'text/html',headers:{}},
              extracted:{
                format:'html',
                title:'وزارة المالية',
                text:'وزارة المالية السعودية الموقع الرسمي والخدمات والمعلومات الحكومية.'
              }
            }],
            failures:[],
            blocked:[],
            coverage:{discovered_count:1,visited_count:1,successful_count:1,failed_count:0,blocked_count:0}
          }
        };
      }

      if (action === 'evidence_verify') return verifyEvidence(input);
      if (action === 'research_synthesize') return synthesizeResearch(input);
      throw new Error('unexpected action ' + action);
    });

    const result = await runResearchWorkflow({
      input:'الموقع الرسمي لوزارة المالية السعودية',
      forceResearch:true,
      research:{
        enabled:true,
        query:'الموقع الرسمي لوزارة المالية السعودية',
        queryVariants:['الموقع الرسمي لوزارة المالية السعودية'],
        topic:'وزارة المالية السعودية',
        intent:'information',
        minIndependentPublishers:2,
        allowAuthoritativePrimaryEvidence:true,
        maxPages:5,
        maxDepth:1
      }
    }, {}, {executeCapability});

    expect(result.decisionEligible).toBe(true);
    expect(result.status).toBe('SUPPORTED');
    expect(calls.filter(item => item.action === 'web_search')).toHaveLength(0);
    expect(calls.filter(item => item.action === 'web_explore')).toHaveLength(1);
    expect(result.search?.source).toBe('institutional_registry');
    expect(result.search?.result?.results?.[0]?.url).toBe('https://www.mof.gov.sa/');
  });

});
