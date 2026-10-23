/** @jest-environment node */

const {
  SYNTHETIC_PRODUCTION_JOURNEYS_VERSION,
  buildSyntheticJourneys,
  runSyntheticProductionJourneys
} = require('../../lib/assistant/synthetic-production-journeys');

function jsonResponse(status, body) {
  return {
    status,
    headers:{ get:name => String(name).toLowerCase()==='content-type' ? 'application/json; charset=utf-8' : null },
    text:async()=>JSON.stringify(body)
  };
}

describe('Synthetic production journeys', () => {
  test('registry is bounded and avoids business-write endpoints', () => {
    const journeys=buildSyntheticJourneys({ marker:'marker-1' });
    expect(SYNTHETIC_PRODUCTION_JOURNEYS_VERSION).toBe(1);
    expect(journeys.map(item=>item.id)).toEqual([
      'assistant_foundation',
      'registered_navigation_plan',
      'policy_dry_run',
      'workflow_resume_read',
      'service_execution_profile_read'
    ]);

    const paths=journeys.flatMap(item=>item.requests.map(request=>request.path));
    expect(paths.some(path=>/save|submit|create|transition|execute$/.test(path))).toBe(false);
  });

  test('runs deterministic authenticated production journeys without business writes', async () => {
    const calls=[];
    const fetchImpl=jest.fn(async (url, options={}) => {
      const parsed=new URL(url);
      calls.push({ path:parsed.pathname+parsed.search, method:options.method, body:options.body || null });

      if(parsed.pathname.endsWith('/assistant')) {
        return jsonResponse(200,{ status:'ready', context:{ execution:'plan_only' } });
      }
      if(parsed.pathname.endsWith('/assistant/introspection')) {
        return jsonResponse(200,{ status:'completed', introspection:{ authorization_source:false } });
      }
      if(parsed.pathname.endsWith('/assistant/emergency-mode')) {
        return jsonResponse(200,{ status:'completed', emergency_mode:{ mode:'normal' } });
      }
      if(parsed.pathname.endsWith('/assistant/plan')) {
        return jsonResponse(200,{
          status:'ready',
          actions:[{ type:'site_navigate', target:'kyc' }]
        });
      }
      if(parsed.pathname.endsWith('/assistant/policy/simulate')) {
        return jsonResponse(200,{
          status:'completed',
          simulation:{
            count:1,
            policy:{
              simulation_only:true,
              writes_performed:false,
              tools_invoked:false,
              execution_authorized:false
            }
          }
        });
      }
      if(parsed.pathname.endsWith('/assistant/workflows/resume')) {
        return jsonResponse(200,{
          status:'not_found',
          workflow_key:'page:synthetic-production-journey',
          workflow:null
        });
      }
      if(parsed.pathname.endsWith('/assistant/services/cash_generation_analysis')) {
        return jsonResponse(200,{
          status:'completed',
          service:{ code:'cash_generation_analysis' },
          execution:{
            execution_status:'automated',
            execution_mode:'capability_plan',
            primary_action:'cash_flow_analysis_run'
          }
        });
      }
      throw new Error(`Unexpected synthetic request: ${parsed.pathname}`);
    });

    const result=await runSyntheticProductionJourneys({
      baseUrl:'https://bonds-global.com',
      token:'test-token',
      expectedSha:'a'.repeat(40),
      fetchImpl,
      sleepImpl:async()=>{},
      log:()=>{}
    });

    expect(result.journey_count).toBe(5);
    expect(result.request_count).toBe(7);
    expect(result.writes_performed).toBe(false);
    expect(result.business_records_created).toBe(false);
    expect(result.execution_authorized).toBe(false);
    expect(result.results.every(item=>item.status==='pass')).toBe(true);
    expect(calls).toHaveLength(7);
    expect(calls.some(call=>call.path.includes('/assistant/services/execute'))).toBe(false);
    expect(calls.some(call=>call.path.includes('/workflows/save'))).toBe(false);
  });

  test('fails closed on execution-profile drift', async () => {
    const fetchImpl=jest.fn(async url => {
      const parsed=new URL(url);
      if(parsed.pathname.endsWith('/assistant')) return jsonResponse(200,{ status:'ready', context:{ execution:'plan_only' } });
      if(parsed.pathname.endsWith('/assistant/introspection')) return jsonResponse(200,{ status:'completed', introspection:{} });
      if(parsed.pathname.endsWith('/assistant/emergency-mode')) return jsonResponse(200,{ status:'completed', emergency_mode:{} });
      if(parsed.pathname.endsWith('/assistant/plan')) return jsonResponse(200,{ status:'ready', actions:[{ type:'site_navigate', target:'kyc' }] });
      if(parsed.pathname.endsWith('/assistant/policy/simulate')) return jsonResponse(200,{ status:'completed', simulation:{ count:1, policy:{ simulation_only:true,writes_performed:false,tools_invoked:false,execution_authorized:false } } });
      if(parsed.pathname.endsWith('/assistant/workflows/resume')) return jsonResponse(200,{ status:'not_found', workflow_key:'synthetic-key', workflow:null });
      if(parsed.pathname.endsWith('/assistant/services/cash_generation_analysis')) {
        return jsonResponse(200,{
          status:'completed',
          service:{ code:'cash_generation_analysis' },
          execution:{ execution_status:'request_only', execution_mode:'request_only', primary_action:null }
        });
      }
      throw new Error('unexpected');
    });

    await expect(runSyntheticProductionJourneys({
      baseUrl:'https://bonds-global.com',
      token:'test-token',
      expectedSha:'b'.repeat(40),
      fetchImpl,
      sleepImpl:async()=>{},
      log:()=>{}
    })).rejects.toThrow('cash generation remains automated');
  });
});
