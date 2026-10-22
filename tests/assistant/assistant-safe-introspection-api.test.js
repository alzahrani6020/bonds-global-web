/** @jest-environment node */
const {EventEmitter}=require('events');

const mockEmergencyMode=jest.fn();
const mockCachedIntrospection=jest.fn();

jest.mock('../../lib/assistant/emergency-kill-switch',()=>{
  const actual=jest.requireActual('../../lib/assistant/emergency-kill-switch');
  return {
    ...actual,
    getAssistantEmergencyModeState:(args)=>mockEmergencyMode(args),
    assertAssistantMutationEnabled:jest.fn()
  };
});

jest.mock('../../lib/assistant/safe-introspection-cache',()=>({
  getCachedIntrospection:(args)=>mockCachedIntrospection(args)
}));

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

describe('Assistant safe introspection API',()=>{
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
    mockCachedIntrospection.mockImplementation(async({loader})=>({
      snapshot:await loader(),
      cache:{hit:false,age_ms:0,ttl_ms:5000}
    }));
  });

  test('returns bounded informational introspection',async()=>{
    const out=await call('GET','/assistant/introspection');
    expect(out.statusCode).toBe(200);
    expect(out.body.status).toBe('completed');
    expect(out.body.introspection.cache).toEqual({
      hit:false,
      age_ms:0,
      ttl_ms:5000
    });
    expect(out.body.introspection.snapshot.emergency_mode.mode).toBe('normal');
    expect(mockEmergencyMode).toHaveBeenCalledWith({supabase:mockSupabase});
  });

  test('does not use the mutation guard for introspection',async()=>{
    const out=await call('GET','/assistant/introspection');
    expect(out.statusCode).toBe(200);
    const kill=require('../../lib/assistant/emergency-kill-switch');
    expect(kill.assertAssistantMutationEnabled).not.toHaveBeenCalled();
  });

  test('returns bounded unavailable response on loader/cache failure',async()=>{
    mockCachedIntrospection.mockRejectedValue(new Error('internal secret failure'));
    const out=await call('GET','/assistant/introspection');
    expect(out.statusCode).toBe(503);
    expect(out.body.error).toBe('ASSISTANT_INTROSPECTION_UNAVAILABLE');
    expect(out.body).not.toHaveProperty('detail');
    expect(out.body.policy).toEqual(expect.objectContaining({
      informational_only:true,
      authorization_source:false,
      execution_authorized:false
    }));
  });
});
