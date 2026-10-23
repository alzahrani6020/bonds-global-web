'use strict';

const crypto = require('crypto');

const SYNTHETIC_PRODUCTION_JOURNEYS_VERSION = 1;
const SYNTHETIC_BOUNDARY = 'synthetic_production_journeys';

function buildSyntheticJourneys({ marker } = {}) {
  const actionId = `${marker || 'synthetic'}-navigation`;
  return [
    {
      id:'assistant_foundation',
      description:'Authenticated Assistant control-plane readiness',
      requests:[
        { method:'GET', path:'/assistant' },
        { method:'GET', path:'/assistant/introspection' },
        { method:'GET', path:'/assistant/emergency-mode' }
      ]
    },
    {
      id:'registered_navigation_plan',
      description:'Registered bilingual navigation remains plan-only',
      requests:[{
        method:'POST',
        path:'/assistant/plan',
        body:{ type:'site_navigate', target:'kyc', language:'en' }
      }]
    },
    {
      id:'policy_dry_run',
      description:'Structured action policy simulation performs no writes or tools',
      requests:[{
        method:'POST',
        path:'/assistant/policy/simulate',
        body:{
          scenario_id:marker,
          action:{
            id:actionId,
            type:'site_navigate',
            capability:'site_navigate',
            target:'kyc',
            input:{ target:'kyc', language:'en' },
            risk:'low',
            requires_confirmation:false
          }
        }
      }]
    },
    {
      id:'workflow_resume_read',
      description:'Resume lookup is read-only for an isolated synthetic boundary',
      requests:[{
        method:'GET',
        path:`/assistant/workflows/resume?boundary=${encodeURIComponent(`${SYNTHETIC_BOUNDARY}:${marker}`)}`
      }]
    },
    {
      id:'service_execution_profile_read',
      description:'Cash generation execution profile remains discoverable without execution',
      requests:[{
        method:'GET',
        path:'/assistant/services/cash_generation_analysis'
      }]
    }
  ];
}

function retryAfterMs(value) {
  const raw=String(value || '').trim();
  if(!raw) return 1000;
  const seconds=Number(raw);
  if(Number.isFinite(seconds)) return Math.max(0,Math.min(65000,Math.ceil(seconds*1000)));
  const absolute=Date.parse(raw);
  if(Number.isFinite(absolute)) return Math.max(0,Math.min(65000,absolute-Date.now()));
  return 1000;
}

async function runSyntheticProductionJourneys({
  baseUrl,
  token,
  expectedSha,
  fetchImpl=global.fetch,
  sleepImpl=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  log=console.log
}={}) {
  if(!token) throw new Error('Synthetic production journeys require an authenticated session');
  if(!/^[0-9a-f]{40}$/i.test(String(expectedSha || ''))) {
    throw new Error('Synthetic production journeys require an exact release SHA');
  }

  const origin=new URL(baseUrl);
  if(!['https:','http:'].includes(origin.protocol) || origin.username || origin.password ||
     origin.pathname!=='/' || origin.search || origin.hash) {
    throw new Error('Synthetic production journeys require a site origin');
  }

  const marker=`synthetic-journey-${expectedSha.slice(0,12)}-${crypto.randomUUID()}`;
  const journeys=buildSyntheticJourneys({ marker });
  let requestCount=0;

  function check(condition,label,detail=null){
    if(!condition) {
      const suffix=detail ? ` | ${detail}` : '';
      throw new Error(`Synthetic journey failed: ${label}${suffix} (marker=${marker})`);
    }
  }

  async function request(spec){
    const headers={
      Authorization:`Bearer ${token}`,
      'Cache-Control':'no-cache',
      'X-Request-ID':marker
    };
    const body=spec.body===undefined ? undefined : {
      ...spec.body,
      session_id:marker,
      boundary:SYNTHETIC_BOUNDARY
    };
    if(body!==undefined) headers['Content-Type']='application/json';

    for(let attempt=1; attempt<=2; attempt++){
      requestCount+=1;
      const response=await fetchImpl(`${origin.origin}/api/v3${spec.path}`,{
        method:spec.method,
        headers,
        body:body===undefined ? undefined : JSON.stringify(body),
        redirect:'error',
        signal:AbortSignal.timeout(20000)
      });
      if(response.status===429 && attempt===1){
        await sleepImpl(retryAfterMs(response.headers.get('retry-after')));
        continue;
      }
      const contentType=response.headers.get('content-type') || '';
      check(/^application\/json\b/i.test(contentType),`${spec.id || spec.path} returns JSON`);
      let data;
      try { data=JSON.parse(await response.text()); }
      catch(_error){ throw new Error(`Synthetic journey invalid JSON: ${spec.path} (marker=${marker})`); }
      return { status:response.status, data };
    }
    throw new Error(`Synthetic journey exhausted retries: ${spec.path} (marker=${marker})`);
  }

  const results=[];

  for(const journey of journeys){
    const responses=[];
    for(const spec of journey.requests) responses.push(await request(spec));

    if(journey.id==='assistant_foundation'){
      const [ready,introspection,emergency]=responses;
      check(ready.status===200 && ready.data?.status==='ready','assistant foundation ready');
      check(ready.data?.context?.execution==='plan_only','assistant remains plan-only');
      check(introspection.status===200 && introspection.data?.status==='completed','introspection available');
      check(introspection.data?.introspection?.authorization_source!==true,'introspection is not authorization');
      check(emergency.status===200 && emergency.data?.status==='completed','emergency mode state readable');
    }

    if(journey.id==='registered_navigation_plan'){
      const result=responses[0];
      check(result.status===200 && result.data?.status==='ready','navigation plan ready');
      check(result.data?.actions?.length===1,'navigation plan has one action');
      check(result.data?.actions?.[0]?.type==='site_navigate','navigation action type');
      check(result.data?.actions?.[0]?.target==='kyc','navigation target remains registered');
    }

    if(journey.id==='policy_dry_run'){
      const result=responses[0];
      const simulation=result.data?.simulation;
      check(result.status===200 && result.data?.status==='completed','policy simulation completed');
      check(simulation?.count===1,'policy simulation contains one action');
      check(simulation?.policy?.simulation_only===true,'policy simulation is simulation-only');
      check(simulation?.policy?.writes_performed===false,'policy simulation performs no writes');
      check(simulation?.policy?.tools_invoked===false,'policy simulation invokes no tools');
      check(simulation?.policy?.execution_authorized===false,'policy simulation grants no execution');
    }

    if(journey.id==='workflow_resume_read'){
      const result=responses[0];
      check(
        result.status===200,
        'workflow resume read succeeds',
        `HTTP ${result.status}, body=${JSON.stringify(result.data ?? null).slice(0,500)}`
      );
      check(['completed','not_found'].includes(result.data?.status),'workflow resume has bounded status');
      check(typeof result.data?.workflow_key==='string' && result.data.workflow_key.length>0,
        'workflow resume returns canonical key');
    }

    if(journey.id==='service_execution_profile_read'){
      const result=responses[0];
      check(result.status===200 && result.data?.status==='completed','service profile readable');
      check(result.data?.service?.code==='cash_generation_analysis','cash generation service resolved');
      check(result.data?.execution?.execution_status==='automated','cash generation remains automated');
      check(result.data?.execution?.execution_mode==='capability_plan','cash generation uses capability plan');
      check(result.data?.execution?.primary_action==='cash_flow_analysis_run','cash generation primary action stable');
    }

    results.push({ id:journey.id, status:'pass', request_count:responses.length });
    log(`Synthetic production journey PASS: ${journey.id}`);
  }

  const summary={
    version:SYNTHETIC_PRODUCTION_JOURNEYS_VERSION,
    marker,
    release_sha:expectedSha,
    journey_count:results.length,
    request_count:requestCount,
    writes_performed:false,
    business_records_created:false,
    execution_authorized:false,
    results
  };
  log(`Synthetic production journeys PASS (journeys=${results.length}, requests=${requestCount}, marker=${marker})`);
  return summary;
}

module.exports={
  SYNTHETIC_PRODUCTION_JOURNEYS_VERSION,
  SYNTHETIC_BOUNDARY,
  buildSyntheticJourneys,
  runSyntheticProductionJourneys
};
