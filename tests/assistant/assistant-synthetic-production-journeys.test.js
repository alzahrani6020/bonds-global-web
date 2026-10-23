/** @jest-environment node */
'use strict';

const { runSyntheticProductionJourneys } = require('../../scripts/assistant-synthetic-production-journeys');

const SHA='e'.repeat(40);
const TOKEN='fixture-token';

function response(status, body, headers={}) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{'content-type':'application/json',...headers}
  });
}

describe('Assistant synthetic production journeys', () => {
  test('passes safe read/plan-only journeys without write endpoints', async () => {
    const calls=[];
    const fetchImpl=jest.fn(async (url, options={}) => {
      calls.push({url,options});
      const path=new URL(url).pathname;

      if(path==='/api/v3/ai/chat'){
        return response(200,{
          source:'bonds-chat-orchestrator',
          context:{
            state:'homepage/no_service_selected',
            authority:'page',
            serviceCode:null
          }
        });
      }

      const body=JSON.parse(options.body||'{}');
      if(path==='/api/v3/assistant/plan' && body.type==='site_navigate' && body.target==='kyc'){
        return response(200,{
          status:'ready',
          actions:[{type:'site_navigate',target:'kyc'}],
          context:{navigation:{route:body.language==='en'?'/en/client/kyc':'/client/kyc'}}
        });
      }
      if(path==='/api/v3/assistant/plan' && body.type==='form_load'){
        return response(200,{
          status:'ready',
          actions:[{type:'form_load',target:'kyc',requires_confirmation:false}],
          context:{
            form:{navigation_target:'kyc'},
            navigation:{route:'/en/client/kyc'}
          }
        });
      }
      if(path==='/api/v3/assistant/plan' && body.target==='synthetic-unregistered-target'){
        return response(422,{
          status:'denied',
          actions:[],
          context:{code:'NAVIGATION_TARGET_NOT_REGISTERED'}
        });
      }

      throw new Error('Unexpected synthetic journey request: '+path);
    });

    const result=await runSyntheticProductionJourneys({
      baseUrl:'https://bonds-global.com',
      token:TOKEN,
      expectedSha:SHA,
      fetchImpl,
      sleepImpl:jest.fn().mockResolvedValue(),
      log:jest.fn()
    });

    expect(result.journeys).toHaveLength(4);
    expect(result.journeys.every(item=>item.status==='pass')).toBe(true);
    expect(calls.every(call=>{
      const path=new URL(call.url).pathname;
      return path==='/api/v3/ai/chat' || path==='/api/v3/assistant/plan';
    })).toBe(true);
  });

  test('fails closed when a registered navigation route drifts', async () => {
    const fetchImpl=jest.fn(async (url, options={}) => {
      const path=new URL(url).pathname;
      if(path==='/api/v3/ai/chat'){
        return response(200,{
          source:'bonds-chat-orchestrator',
          context:{state:'homepage/no_service_selected',authority:'page',serviceCode:null}
        });
      }
      const body=JSON.parse(options.body||'{}');
      if(body.type==='site_navigate' && body.target==='kyc'){
        return response(200,{
          status:'ready',
          actions:[{type:'site_navigate',target:'kyc'}],
          context:{navigation:{route:'/wrong-route'}}
        });
      }
      throw new Error('Unexpected request');
    });

    await expect(runSyntheticProductionJourneys({
      baseUrl:'https://bonds-global.com',
      token:TOKEN,
      expectedSha:SHA,
      fetchImpl,
      sleepImpl:jest.fn().mockResolvedValue(),
      log:jest.fn()
    })).rejects.toThrow('navigation ar registered route');
  });

  test('retries one transient 429 and does not bypass authorization', async () => {
    let count=0;
    const sleepImpl=jest.fn().mockResolvedValue();
    const fetchImpl=jest.fn(async (url, options={}) => {
      const path=new URL(url).pathname;
      if(path==='/api/v3/ai/chat' && count++===0){
        return response(429,{error:'rate limited'},{'retry-after':'0'});
      }
      if(path==='/api/v3/ai/chat'){
        expect(options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
        return response(200,{
          source:'bonds-chat-orchestrator',
          context:{state:'homepage/no_service_selected',authority:'page',serviceCode:null}
        });
      }
      const body=JSON.parse(options.body||'{}');
      if(body.type==='site_navigate' && body.target==='kyc'){
        return response(200,{
          status:'ready',
          actions:[{type:'site_navigate',target:'kyc'}],
          context:{navigation:{route:body.language==='en'?'/en/client/kyc':'/client/kyc'}}
        });
      }
      if(body.type==='form_load'){
        return response(200,{
          status:'ready',
          actions:[{type:'form_load',target:'kyc',requires_confirmation:false}],
          context:{form:{navigation_target:'kyc'},navigation:{route:'/en/client/kyc'}}
        });
      }
      if(body.target==='synthetic-unregistered-target'){
        return response(422,{status:'denied',actions:[],context:{code:'NAVIGATION_TARGET_NOT_REGISTERED'}});
      }
      throw new Error('Unexpected request');
    });

    const result=await runSyntheticProductionJourneys({
      baseUrl:'https://bonds-global.com',
      token:TOKEN,
      expectedSha:SHA,
      fetchImpl,
      sleepImpl,
      log:jest.fn()
    });

    expect(result.journeys).toHaveLength(4);
    expect(sleepImpl).toHaveBeenCalledWith(0);
  });
});
