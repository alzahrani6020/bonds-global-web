/** @jest-environment node */
const {EventEmitter}=require('events');

const mockGuard=jest.fn();
const mockEmergencyMode=jest.fn();
const mockEmergencyMode=jest.fn();
jest.mock('../../lib/assistant/emergency-kill-switch',()=>{
  const actual=jest.requireActual('../../lib/assistant/emergency-kill-switch');
  return {
    ...actual,
    assertAssistantMutationEnabled:(args)=>mockGuard(args),
    getAssistantEmergencyMode:(args)=>mockEmergencyMode(args),
    getAssistantEmergencyModeState:(args)=>mockEmergencyMode(args)
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
  beforeEach(()=>{
    jest.clearAllMocks();
    mockEmergencyMode.mockResolvedValue({
      feature:'assistant.read_only',
      disabled:false,
      mode:'normal',
      expires_at:null,
      execution_authorized:false,
      auto_execute:false
    });
  });

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


  test('read-only emergency mode blocks mutation with dedicated public code',async()=>{
    const err=new Error('ASSISTANT_READ_ONLY_MODE');
    err.code='ASSISTANT_READ_ONLY_MODE';
    err.feature='assistant.read_only';
    err.mode='read_only_emergency';
    err.expires_at='2099-01-01T00:00:00Z';
    mockGuard.mockRejectedValue(err);

    const out=await call('POST','/assistant/workflows/status');

    expect(out.statusCode).toBe(503);
    expect(out.body).toEqual(expect.objectContaining({
      status:'denied',
      error:'ASSISTANT_READ_ONLY_MODE',
      feature:'assistant.read_only',
      mode:'read_only_emergency',
      expires_at:'2099-01-01T00:00:00Z'
    }));
    expect(out.body).not.toHaveProperty('reason');
    expect(out.body.policy.execution_authorized).toBe(false);
  });

  test('exposes emergency mode status through a read-only route',async()=>{
    mockEmergencyMode.mockResolvedValue({
      feature:'assistant.read_only',
      disabled:true,
      mode:'read_only_emergency',
      expires_at:null,
      execution_authorized:false,
      auto_execute:false
    });

    const out=await call('GET','/assistant/emergency-mode');

    expect(out.statusCode).toBe(200);
    expect(out.body.emergency_mode.mode).toBe('read_only_emergency');
    expect(mockGuard).not.toHaveBeenCalled();
    expect(mockEmergencyMode).toHaveBeenCalledWith({supabase:mockSupabase});
  });

  test('reports read-only emergency mode from the global assistant switch',async()=>{
    mockEmergencyMode.mockResolvedValue({
      mode:'read_only',
      read_only:true,
      expires_at:'2099-01-01T00:00:00Z',
      execution_authorized:false,
      auto_execute:false
    });
    const out=await call('GET','/assistant/emergency-mode');
    expect(out.statusCode).toBe(200);
    expect(out.body.emergency_mode).toEqual(expect.objectContaining({
      mode:'read_only',
      read_only:true,
      execution_authorized:false
    }));
    expect(mockGuard).not.toHaveBeenCalled();
  });

  test('global switch denial explicitly identifies read-only emergency mode',async()=>{
    const err=new Error('ASSISTANT_FEATURE_DISABLED');
    err.code='ASSISTANT_FEATURE_DISABLED';
    err.feature='assistant';
    err.expires_at=null;
    mockGuard.mockRejectedValue(err);
    const out=await call('POST','/assistant/workflows/status');
    expect(out.statusCode).toBe(503);
    expect(out.body.emergency_mode).toBe('read_only');
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
