/** @jest-environment node */
const {EventEmitter}=require('events');

jest.mock('../../lib/assistant/emergency-kill-switch',()=>{
  const actual=jest.requireActual('../../lib/assistant/emergency-kill-switch');
  return {
    ...actual,
    assertAssistantMutationEnabled:jest.fn()
  };
});
jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>({from:jest.fn()})
}));

const {assistantRouter}=require('../../v3/api/assistant');

function req(method,url){
  const r=new EventEmitter();
  r.method=method;
  r.url=url;
  return r;
}
function res(done){
  return {
    statusCode:200,headers:{},
    setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},
    end(v){done({statusCode:this.statusCode,body:v?JSON.parse(v):null});}
  };
}
function call(method,path,user={id:'u1'}){
  return new Promise(resolve=>assistantRouter(
    req(method,'/api/v3'+path),res(resolve),path,user
  ));
}

describe('Assistant policy API',()=>{
  test('returns read-only public policy descriptor',async()=>{
    const out=await call('GET','/assistant/policy');
    expect(out.statusCode).toBe(200);
    expect(out.body.status).toBe('completed');
    expect(out.body.policy).toEqual(expect.objectContaining({
      policy_id:'bonds-assistant-action-policy',
      policy_version:1,
      schema_version:1
    }));
    expect(out.body.policy.invariants).toEqual(expect.objectContaining({
      deterministic:true,
      execution_authorized:false,
      auto_execute:false,
      authorization_source:false
    }));
  });

  test('policy endpoint is not a mutation route',async()=>{
    const kill=require('../../lib/assistant/emergency-kill-switch');
    const out=await call('GET','/assistant/policy');
    expect(out.statusCode).toBe(200);
    expect(kill.assertAssistantMutationEnabled).not.toHaveBeenCalled();
  });
});
