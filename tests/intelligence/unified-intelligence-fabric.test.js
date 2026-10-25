/** @jest-environment node */

const { resolveEntityFrame } = require('../../lib/intelligence/entity-resolution');
const { routeIntelligenceRequest } = require('../../lib/intelligence/intelligence-router');
const {
  buildClaimFabric
} = require('../../lib/intelligence/claim-fabric');
const { buildAnswerPlan } = require('../../lib/intelligence/answer-planner');
const { runResearchWorkflow } = require('../../lib/intelligence/research-workflow');
const {
  verifyEvidence,
  synthesizeResearch
} = require('../../lib/intelligence/research-intelligence');
const { buildPersonEntityFrame } = require('../../lib/assistant/person-identity');

describe('Unified Intelligence Fabric', () => {
  test('creates a general immutable entity frame and research route', () => {
    const frame = resolveEntityFrame({
      type:'company',
      text:'أرامكو السعودية',
      confidence:0.97
    }, { rawMention:'شركة أرامكو السعودية' });

    expect(frame).toEqual(expect.objectContaining({
      entity_frame_schema_version:1,
      entity_type:'company',
      canonical_name:'أرامكو السعودية',
      raw_mention:'شركة أرامكو السعودية'
    }));
    expect(Object.isFrozen(frame)).toBe(true);

    const route = routeIntelligenceRequest({
      intent:'company_lookup',
      entityFrame:frame
    });

    expect(route.stages.map(stage => stage.stage)).toEqual(expect.arrayContaining([
      'entity_resolution',
      'research_acquisition',
      'claim_extraction',
      'claim_verification',
      'contradiction_temporal_resolution',
      'evidence_verification',
      'answer_planning',
      'quality_guard'
    ]));
  });

  test('promotes a structured person role only after independent source support', () => {
    const entityFrame = resolveEntityFrame({
      type:'person',
      text:'محمد بن سلمان',
      confidence:0.99,
      person_entity_frame:buildPersonEntityFrame('محمد بن سلمان')
    });

    const fabric = buildClaimFabric({
      entityFrame,
      minIndependentPublishers:2,
      sources:[
        {
          id:'a',
          publisher:'example-a.com',
          url:'https://example-a.com/a',
          candidate_claims:[
            { text:'محمد بن سلمان هو ولي العهد السعودي ورئيس مجلس الوزراء.' }
          ],
          text:'محمد بن سلمان هو ولي العهد السعودي ورئيس مجلس الوزراء.'
        },
        {
          id:'b',
          publisher:'example-b.com',
          url:'https://example-b.com/b',
          candidate_claims:[
            { text:'محمد بن سلمان يشغل منصب ولي العهد السعودي.' }
          ],
          text:'محمد بن سلمان يشغل منصب ولي العهد السعودي.'
        }
      ]
    });

    expect(fabric.verification_state).toBe('VERIFIED');
    expect(fabric.verified_claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key:'person.role.crown_prince',
        verification_state:'VERIFIED',
        independent_publishers:2
      })
    ]));
    expect(fabric.verification_sources.every(source =>
      source.claims.some(claim => claim.key === 'person.role.crown_prince')
    )).toBe(true);

    const plan = buildAnswerPlan({
      intent:'person_lookup',
      languagePlan:{ language:{ language:'ar' } },
      entityFrame,
      verifiedIdentity:{
        verification_state:'VERIFIED',
        canonical_name:'محمد بن سلمان'
      },
      claimFabric:fabric
    });

    expect(plan.mode).toBe('direct_verified_claim');
    expect(plan.requires_ai_synthesis).toBe(false);
    expect(plan.direct_answer).toBe('محمد بن سلمان هو ولي العهد.');
  });

  test('does not promote a one-source extracted claim', () => {
    const entityFrame = resolveEntityFrame({
      type:'person',
      text:'خالد محمد',
      confidence:0.95,
      person_entity_frame:buildPersonEntityFrame('خالد محمد')
    });

    const fabric = buildClaimFabric({
      entityFrame,
      minIndependentPublishers:2,
      sources:[
        {
          id:'a',
          publisher:'example-a.com',
          url:'https://example-a.com/a',
          candidate_claims:[{ text:'خالد محمد هو الرئيس التنفيذي للشركة.' }],
          text:'خالد محمد هو الرئيس التنفيذي للشركة.'
        },
        {
          id:'b',
          publisher:'example-b.com',
          url:'https://example-b.com/b',
          candidate_claims:[{ text:'خالد محمد شخصية مهنية معروفة في القطاع.' }],
          text:'خالد محمد شخصية مهنية معروفة في القطاع.'
        }
      ]
    });

    expect(fabric.verification_state).toBe('SUPPORTED');
    expect(fabric.fused_claims).toHaveLength(0);
    expect(fabric.verification_sources[0].claims).toHaveLength(0);
  });

  test('detects same-period structured metric contradictions', () => {
    const entityFrame = resolveEntityFrame({
      type:'company',
      text:'شركة ألف',
      confidence:0.95
    });

    const fabric = buildClaimFabric({
      entityFrame,
      minIndependentPublishers:1,
      sources:[
        {
          id:'a',
          publisher:'a.example',
          candidate_claims:[{ text:'بلغت إيرادات شركة ألف في 2025 مبلغ 100 مليون ريال.' }],
          text:'بلغت إيرادات شركة ألف في 2025 مبلغ 100 مليون ريال.'
        },
        {
          id:'b',
          publisher:'b.example',
          candidate_claims:[{ text:'بلغت إيرادات شركة ألف في 2025 مبلغ 200 مليون ريال.' }],
          text:'بلغت إيرادات شركة ألف في 2025 مبلغ 200 مليون ريال.'
        }
      ]
    });

    expect(fabric.verification_state).toBe('CONTESTED');
    expect(fabric.contradictions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate:'metric.revenue',
        reference_year:2025
      })
    ]));
  });

  test('research workflow supplies promoted structured claims to evidence verification', async () => {
    const personFrame = buildPersonEntityFrame('محمد بن سلمان');
    const entityFrame = resolveEntityFrame({
      type:'person',
      text:'محمد بن سلمان',
      confidence:0.99,
      person_entity_frame:personFrame
    });

    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          result:{
            results:[
              {
                title:'محمد بن سلمان',
                snippet:'محمد بن سلمان ولي العهد السعودي.',
                url:'https://a.example/profile'
              },
              {
                title:'محمد بن سلمان',
                snippet:'محمد بن سلمان يشغل منصب ولي العهد.',
                url:'https://b.example/profile'
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
                url:'https://a.example/profile',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{
                  format:'html',
                  title:'محمد بن سلمان',
                  text:'محمد بن سلمان هو ولي العهد السعودي ورئيس مجلس الوزراء.'
                }
              },
              {
                url:'https://b.example/profile',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{
                  format:'html',
                  title:'محمد بن سلمان',
                  text:'محمد بن سلمان يشغل منصب ولي العهد السعودي.'
                }
              }
            ],
            failures:[],
            blocked:[]
          }
        };
      }

      if (action === 'evidence_verify') return verifyEvidence(input);
      if (action === 'research_synthesize') return synthesizeResearch(input);
      throw new Error('unexpected action ' + action);
    });

    const result = await runResearchWorkflow({
      input:'محمد بن سلمان',
      forceResearch:true,
      research:{
        enabled:true,
        intent:'person_lookup',
        query:'محمد بن سلمان',
        queryVariants:['محمد بن سلمان'],
        topic:'محمد بن سلمان',
        entityFrame,
        personEntityFrame:personFrame,
        minIndependentPublishers:2,
        maxPages:5,
        maxDepth:0
      }
    }, {}, { executeCapability });

    expect(result.decisionEligible).toBe(true);
    expect(result.claim_fabric.verification_state).toBe('VERIFIED');
    expect(result.claim_fabric.extracted_claim_count).toBeGreaterThan(0);
    expect(result.verification.result.residual_uncertainty).not.toContain('NO_STRUCTURED_CLAIMS');
    expect(result.synthesis.result.known).toEqual(expect.arrayContaining([
      expect.objectContaining({
        claim:'person.role.crown_prince',
        value:'ولي العهد'
      })
    ]));
    expect(result.intelligence_route.stages.map(stage => stage.stage))
      .toContain('claim_verification');
  });
});
