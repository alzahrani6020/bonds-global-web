/** @jest-environment node */
const {EventEmitter}=require('events');

const mockAdminAccess=jest.fn();
const mockScan=jest.fn();
const mockSupabase={from:jest.fn()};

jest.mock('../../v3/lib/admin-access',()=>({
  requireAdminAccess:(req)=>mockAdminAccess(req),
  requireAgentInboxAccess:jest.fn(),
  requireHumanApprovalAccess:jest.fn()
}));
jest.mock('../../lib/assistant/anomaly-detection',()=>({
  scanAssistantAnomalies:(args)=>mockScan(args)
}));
jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>mockSupabase
}));

const {adminRouter}=require('../../v3/api/admin');

function req(method='GET',url='/api/v3/admin/assistant-anomalies'){
  const r=new EventEmitter();
  r.method=method;
  r.url=url;
  r.headers={host:'localhost'};
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
function call(method='GET',url='/api/v3/admin/assistant-anomalies'){
  return new Promise(resolve=>adminRouter(req(method,url),res(resolve),'/admin/assistant-anomalies'));
}

describe('Assistant anomaly detection admin API',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockAdminAccess.mockResolvedValue({user:{id:'admin-1'},role:'admin',source:'bearer'});
    mockScan.mockResolvedValue({
      version:1,
      lookback_minutes:15,
      rows_examined:12,
      findings:[],
      persistence:{inserted:0,existing:0},
      policy:{deterministic_rules:true,auto_block:false,execution_authorized:false,ai_scoring:false}
    });
  });

  test('GET scans without persisting alerts',async()=>{
    const out=await call('GET','/api/v3/admin/assistant-anomalies?lookback_minutes=30');
    expect(out.statusCode).toBe(200);
    expect(mockScan).toHaveBeenCalledWith({
      supabase:mockSupabase,
      lookbackMinutes:'30',
      persist:false
    });
    expect(out.body.anomaly_detection.policy.auto_block).toBe(false);
  });

  test('POST explicitly persists detected anomalies',async()=>{
    const out=await call('POST','/api/v3/admin/assistant-anomalies?lookback_minutes=15');
    expect(out.statusCode).toBe(200);
    expect(mockScan).toHaveBeenCalledWith({
      supabase:mockSupabase,
      lookbackMinutes:'15',
      persist:true
    });
  });

  test('unauthorized caller cannot run anomaly scan',async()=>{
    mockAdminAccess.mockResolvedValue(null);
    const out=await call();
    expect(out.statusCode).toBe(401);
    expect(mockScan).not.toHaveBeenCalled();
  });

  test('scan failure returns bounded service error',async()=>{
    mockScan.mockRejectedValue(new Error('ANOMALY_AUDIT_READ_FAILED'));
    const out=await call();
    expect(out.statusCode).toBe(503);
    expect(out.body.error).toBe('ANOMALY_AUDIT_READ_FAILED');
  });
});
