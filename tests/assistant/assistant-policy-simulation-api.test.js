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

function req(method,path,body){
  const r=new EventEmitter();
  r.method=method;
  r.url='/api/v3'+path;
  process.nextTick(()=>{
    if(body!==undefined)r.emit('data',JSON.stringify(body));
    r.emit('end');
  });
  return r;
}
function res(done){
  return {
    statusCode:200,headers:{},
    setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},
    end(v){done({statusCode:this.statusCode,body:v?JSON.parse(v):null});}
  };
}
function call(method,path,body,user={id:'u1'}){
  return new Promise(resolve=>assistantRouter(req(method,path,body),res(resolve),path,user));
}

describe('Assistant policy simulation API',()=>{
  test('POST returns dry-run decision only',async()=>{
    const out=await call('POST','/assistant/policy/simulate',{
      action:{type:'form_submit',risk:'high'}
    });
    expect(out.statusCode).toBe(200);
    expect(out.body.status).toBe('completed');
    expect(out.body.simulation.policy).toEqual(expect.objectContaining({
      simulation_only:true,
      writes_performed:false,
      tools_invoked:false,
      authorization_source:false,
      execution_authorized:false
    }));
  });

  test('simulation route bypasses mutation kill-switch guard because it is read-only',async()=>{
    const kill=require('../../lib/assistant/emergency-kill-switch');
    const out=await call('POST','/assistant/policy/simulate',{
      action:{type:'site_navigate',risk:'low'}
    });
    expect(out.statusCode).toBe(200);
    expect(kill.assertAssistantMutationEnabled).not.toHaveBeenCalled();
  });

  test('missing actions returns bounded client error',async()=>{
    const out=await call('POST','/assistant/policy/simulate',{});
    expect(out.statusCode).toBe(422);
    expect(out.body.error).toBe('POLICY_SIMULATION_ACTION_REQUIRED');
    expect(out.body.policy).toEqual(expect.objectContaining({
      simulation_only:true,
      execution_authorized:false,
      authorization_source:false
    }));
  });
});
