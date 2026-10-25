/** @jest-environment node */

const { runResearchWorkflow } = require('../../lib/intelligence/research-workflow');
const { buildPersonEntityFrame } = require('../../lib/assistant/person-identity');

describe('Person identity integration in research workflow', () => {
  test('verifies identity before evidence verification and passes only verified identity forward', async () => {
    const frame = buildPersonEntityFrame('رئيس شركة X خالد محمد');
    let evidenceVerifyInput = null;

    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          result:{
            results:[
              { title:'خالد محمد - شركة X', snippet:'خالد محمد رئيس شركة X', url:'https://a.example/profile' },
              { title:'خالد محمد', snippet:'رئيس شركة X خالد محمد', url:'https://b.example/profile' }
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
                extracted:{ format:'html', title:'خالد محمد - شركة X', text:'خالد محمد هو رئيس شركة X.' }
              },
              {
                url:'https://b.example/profile',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{ format:'html', title:'سيرة خالد محمد', text:'خالد محمد يشغل منصب رئيس شركة X.' }
              }
            ],
            failures:[],
            blocked:[]
          }
        };
      }

      if (action === 'evidence_verify') {
        evidenceVerifyInput = input;
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
        return {
          ok:true,
          executed:true,
          result:{
            known:[],
            unknown:[],
            contradictions:[]
          }
        };
      }

      throw new Error('unexpected action: ' + action);
    });

    const result = await runResearchWorkflow({
      input:'خالد محمد',
      forceResearch:true,
      research:{
        enabled:true,
        query:'خالد محمد',
        queryVariants:['خالد محمد', 'خالد محمد شركة X'],
        topic:'خالد محمد',
        personEntityFrame:frame,
        minIndependentPublishers:2
      }
    }, {}, { executeCapability });

    expect(result.verified_identity.verification_state).toBe('VERIFIED');
    expect(result.verified_identity.supporting_sources).toHaveLength(2);
    expect(result.candidate_identities).toHaveLength(2);
    expect(result.decisionEligible).toBe(true);

    expect(evidenceVerifyInput).toBeTruthy();
    expect(evidenceVerifyInput.sources).toHaveLength(2);
    expect(evidenceVerifyInput.identity).toBeUndefined();
  });

  test('same-name candidates with missing organization fail closed before evidence verification', async () => {
    const frame = buildPersonEntityFrame('رئيس شركة X خالد محمد');
    const actions = [];

    const executeCapability = jest.fn(async (action, input) => {
      actions.push(action);

      if (action === 'web_search') {
        return {
          ok:true,
          executed:true,
          result:{
            results:[
              { title:'خالد محمد', snippet:'خالد محمد خبير اقتصادي', url:'https://a.example/profile' },
              { title:'خالد محمد', snippet:'خالد محمد باحث', url:'https://b.example/profile' }
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
                extracted:{ format:'html', title:'خالد محمد', text:'خالد محمد خبير اقتصادي مستقل.' }
              },
              {
                url:'https://b.example/profile',
                evidence:{ content_type:'text/html', headers:{} },
                extracted:{ format:'html', title:'خالد محمد', text:'خالد محمد باحث مستقل.' }
              }
            ],
            failures:[],
            blocked:[]
          }
        };
      }

      throw new Error('identity gate should stop before ' + action);
    });

    const result = await runResearchWorkflow({
      input:'خالد محمد',
      forceResearch:true,
      research:{
        enabled:true,
        query:'خالد محمد',
        queryVariants:['خالد محمد'],
        topic:'خالد محمد',
        personEntityFrame:frame,
        minIndependentPublishers:2
      }
    }, {}, { executeCapability });

    expect(result.status).toBe('identity_unverified');
    expect(result.verified_identity.verification_state).toBe('AMBIGUOUS');
    expect(result.decisionEligible).toBe(false);
    expect(actions).not.toContain('evidence_verify');
    expect(actions).not.toContain('research_synthesize');
  });
});
