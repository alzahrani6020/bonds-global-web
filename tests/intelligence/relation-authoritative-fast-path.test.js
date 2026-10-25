/** @jest-environment node */

const { buildClaimFabric } = require('../../lib/intelligence/claim-fabric');
const { verifyEvidence, synthesizeResearch } = require('../../lib/intelligence/research-intelligence');
const { buildAnswerPlan } = require('../../lib/intelligence/answer-planner');
const { runResearchWorkflow } = require('../../lib/intelligence/research-workflow');

function relationFrame() {
  return {
    entity_frame_schema_version:1,
    entity_type:'relation',
    canonical_name:'شركة أرامكو',
    raw_mention:'شركة أرامكو',
    qualifiers:[],
    relations:[{type:'role_relation',value:'رئيس',source:'user',verified:false}],
    organizations:[{value:'شركة أرامكو',source:'user',verified:false}],
    confidence:0.98,
    ambiguity:false
  };
}

describe('Authoritative relation fast path', () => {
  test('extracts relation holder from an authoritative official source', () => {
    const fabric = buildClaimFabric({
      entityFrame:relationFrame(),
      minIndependentPublishers:2,
      sources:[{
        id:'official-1',
        publisher:'www.aramco.com',
        url:'https://www.aramco.com/en/who-we-are/our-leadership/amin-h-nasser',
        authoritative_primary:true,
        authority_score:1,
        institutional_source_id:'saudi_aramco',
        text:'Amin H. Nasser is President and CEO of Saudi Aramco.'
      }]
    });

    expect(fabric.verification_state).toBe('VERIFIED');
    expect(fabric.fused_claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate:'relation.holder',
        value:'Amin H. Nasser',
        authoritative_primary:true,
        verification_state:'VERIFIED'
      })
    ]));
  });

  test('does not waive independent-source rule for a non-authoritative relation claim', () => {
    const fabric = buildClaimFabric({
      entityFrame:relationFrame(),
      minIndependentPublishers:2,
      sources:[{
        id:'blog-1',
        publisher:'blog.example',
        url:'https://blog.example/aramco',
        authoritative_primary:false,
        authority_score:0.4,
        text:'Amin H. Nasser is President and CEO of Saudi Aramco.'
      }]
    });

    expect(fabric.verification_state).toBe('SUPPORTED');
    expect(fabric.fused_claims).toHaveLength(0);
  });

  test('evidence verification permits only authoritative structured relation claims to bypass publisher count', () => {
    const source = {
      id:'official-1',
      publisher:'www.aramco.com',
      url:'https://www.aramco.com/en/who-we-are/our-leadership/amin-h-nasser',
      authoritative_primary:true,
      authority_score:1,
      institutional_source_id:'saudi_aramco',
      relevance_score:1,
      claims:[{
        key:'relation.holder.president',
        predicate:'relation.holder',
        value:'Amin H. Nasser'
      }],
      text:'Amin H. Nasser is President and CEO of Saudi Aramco.'
    };

    const strict = verifyEvidence({
      topic:'رئيس شركة أرامكو',
      sources:[source],
      minIndependentPublishers:2,
      allowAuthoritativePrimary:false
    });
    expect(strict.ok).toBe(false);

    const authoritative = verifyEvidence({
      topic:'رئيس شركة أرامكو',
      sources:[source],
      minIndependentPublishers:2,
      allowAuthoritativePrimary:true
    });
    expect(authoritative.ok).toBe(true);
    expect(authoritative.result.authoritative_primary_used).toBe(true);
    expect(authoritative.result.residual_uncertainty)
      .not.toContain('INSUFFICIENT_INDEPENDENT_SOURCES');
  });

  test('answer planner returns a direct Arabic relation answer', () => {
    const plan = buildAnswerPlan({
      intent:'relation_lookup',
      languagePlan:{language:{language:'ar'}},
      entityFrame:relationFrame(),
      claimFabric:{
        fused_claims:[{
          predicate:'relation.holder',
          value:'Amin H. Nasser',
          relation:'رئيس',
          organization:'شركة أرامكو',
          verification_state:'VERIFIED',
          authoritative_primary:true
        }]
      }
    });

    expect(plan.mode).toBe('direct_verified_claim');
    expect(plan.requires_ai_synthesis).toBe(false);
    expect(plan.direct_answer).toBe('Amin H. Nasser هو رئيس شركة أرامكو.');
  });

  test('workflow bounds exploration and skips research synthesis for authoritative relation evidence', async () => {
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
                title:'Amin H. Nasser | Saudi Aramco',
                snippet:'Amin H. Nasser is President and CEO of Saudi Aramco.',
                url:'https://www.aramco.com/en/who-we-are/our-leadership/amin-h-nasser'
              },
              {
                title:'Saudi Aramco leadership',
                snippet:'Leadership information from Saudi Aramco.',
                url:'https://www.aramco.com/en/who-we-are/our-leadership'
              },
              {
                title:'Third party result',
                snippet:'Saudi Aramco leadership discussion.',
                url:'https://example.com/aramco'
              }
            ]
          }
        };
      }

      if (action === 'web_explore') {
        expect(input.maxPages).toBeLessThanOrEqual(2);
        expect(input.maxDepth).toBe(0);
        expect(input.seedUrls.length).toBeLessThanOrEqual(2);
        expect(input.seedUrls.every(url => url.includes('aramco.com'))).toBe(true);
        return {
          ok:true,
          executed:true,
          result:{
            pages:[{
              url:'https://www.aramco.com/en/who-we-are/our-leadership/amin-h-nasser',
              evidence:{content_type:'text/html',headers:{}},
              extracted:{
                format:'html',
                title:'Amin H. Nasser',
                text:'Amin H. Nasser is President and CEO of Saudi Aramco.'
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
      input:'من هو رئيس شركة أرامكو؟',
      forceResearch:true,
      research:{
        enabled:true,
        intent:'relation_lookup',
        query:'رئيس شركة أرامكو',
        queryVariants:['رئيس شركة أرامكو'],
        entityFrame:relationFrame(),
        minIndependentPublishers:2,
        maxPages:8,
        maxDepth:1
      }
    }, {}, {executeCapability});

    expect(result.decisionEligible).toBe(true);
    expect(result.status).toBe('SUPPORTED');
    expect(result.authoritative_relation_fast_path).toBe(true);
    expect(result.claim_fabric.verification_state).toBe('VERIFIED');
    expect(result.claim_fabric.fused_claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate:'relation.holder',
        value:'Amin H. Nasser'
      })
    ]));
    expect(result.verification.result.authoritative_primary_used).toBe(true);
    expect(result.synthesis.result.fast_path).toBe('authoritative_relation');
    expect(calls.filter(item => item.action === 'research_synthesize')).toHaveLength(0);
  });
});
