/** @jest-environment node */
const {EventEmitter}=require('events');

const mockGuard=jest.fn();
jest.mock('../../lib/assistant/emergency-kill-switch',()=>{
  const actual=jest.requireActual('../../lib/assistant/emergency-kill-switch');
  return {
    ...actual,
    assertAssistantMutationEnabled:(args)=>mockGuard(args)
  };
});
const mockSupabase={from:jest.fn()};
jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>mockSupabase
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

describe('Assistant Emergency Kill Switch API guard',()=>{
  beforeEach(()=>jest.clearAllMocks());

  test('blocks a state-changing route before route execution',async()=>{
    const err=new Error('ASSISTANT_FEATURE_DISABLED');
    err.code='ASSISTANT_FEATURE_DISABLED';
    err.feature='assistant.workflows.status';
    err.expires_at='2099-01-01T00:00:00Z';
    mockGuard.mockRejectedValue(err);

    const out=await call('POST','/assistant/workflows/status');

    expect(out.statusCode).toBe(503);
    expect(mockGuard).toHaveBeenCalledWith({
      supabase:mockSupabase,
      feature:'assistant.workflows.status'
    });
    expect(out.body).toEqual(expect.objectContaining({
      status:'denied',
      error:'ASSISTANT_FEATURE_DISABLED',
      feature:'assistant.workflows.status',
      expires_at:'2099-01-01T00:00:00Z'
    }));
    expect(out.body).not.toHaveProperty('reason');
    expect(out.body.policy.execution_authorized).toBe(false);
  });

  test('read-only routes do not consult the kill switch',async()=>{
    const out=await call('GET','/assistant/contract');
    expect(out.statusCode).toBe(200);
    expect(mockGuard).not.toHaveBeenCalled();
  });

  test('control-plane lookup failure fails closed without internal detail',async()=>{
    mockGuard.mockRejectedValue(new Error('ASSISTANT_KILL_SWITCH_LOOKUP_FAILED'));
    const out=await call('POST','/assistant/events/apply');
    expect(out.statusCode).toBe(503);
    expect(out.body.error).toBe('ASSISTANT_KILL_SWITCH_UNAVAILABLE');
    expect(out.body.feature).toBe('assistant.events.apply');
  });
});
