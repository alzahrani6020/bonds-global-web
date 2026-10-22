/** @jest-environment node */
const {EventEmitter}=require('events');

const mockAdminAccess=jest.fn();
const mockDashboard=jest.fn();
const mockSupabase={from:jest.fn()};

jest.mock('../../v3/lib/admin-access',()=>({
  requireAdminAccess:(req)=>mockAdminAccess(req),
  requireAgentInboxAccess:jest.fn(),
  requireHumanApprovalAccess:jest.fn()
}));
jest.mock('../../lib/assistant/operational-dashboard',()=>({
  buildAssistantOperationalDashboard:(args)=>mockDashboard(args)
}));
jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>mockSupabase
}));

const {adminRouter}=require('../../v3/api/admin');

function req(method='GET',url='/api/v3/admin/assistant-operations?window_hours=24'){
  const r=new EventEmitter();
  r.method=method;r.url=url;r.headers={host:'localhost'};
  process.nextTick(()=>r.emit('end'));
  return r;
}
function res(done){
  return {
    statusCode:200,headers:{},
    setHeader(k,v){this.headers[k]=v;},
    end(v){done({statusCode:this.statusCode,body:v?JSON.parse(v):null});}
  };
}
function call(method='GET',url='/api/v3/admin/assistant-operations?window_hours=24'){
  return new Promise(resolve=>adminRouter(req(method,url),res(resolve),'/admin/assistant-operations'));
}

describe('Assistant operational dashboard admin API',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockAdminAccess.mockResolvedValue({user:{id:'admin-1'},role:'admin',source:'bearer'});
    mockDashboard.mockResolvedValue({
      version:1,
      window_hours:24,
      activity:{total_events:5},
      queues:{agent_inbox:{active_total:1},human_approvals:{pending_total:2}},
      safety:{anomaly_alerts:{active_total:0},emergency_mode:{mode:'normal',disabled:false}},
      policy:{read_only:true,execution_authorized:false,auto_execute:false}
    });
  });

  test('GET returns bounded read-only operations dashboard',async()=>{
    const out=await call();
    expect(out.statusCode).toBe(200);
    expect(out.body.success).toBe(true);
    expect(mockDashboard).toHaveBeenCalledWith({
      supabase:mockSupabase,
      windowHours:'24'
    });
    expect(out.body.assistant_operations.policy).toEqual(expect.objectContaining({
      read_only:true,
      execution_authorized:false
    }));
  });

  test('unauthorized caller cannot read dashboard',async()=>{
    mockAdminAccess.mockResolvedValue(null);
    const out=await call();
    expect(out.statusCode).toBe(401);
    expect(mockDashboard).not.toHaveBeenCalled();
  });

  test('POST is rejected and cannot mutate dashboard state',async()=>{
    const out=await call('POST','/api/v3/admin/assistant-operations');
    expect(out.statusCode).toBe(405);
    expect(mockDashboard).not.toHaveBeenCalled();
  });

  test('source failure returns bounded service error',async()=>{
    mockDashboard.mockRejectedValue(new Error('ASSISTANT_OPERATIONAL_AUDIT_READ_FAILED'));
    const out=await call();
    expect(out.statusCode).toBe(503);
    expect(out.body.error).toBe('ASSISTANT_OPERATIONAL_AUDIT_READ_FAILED');
  });
});
