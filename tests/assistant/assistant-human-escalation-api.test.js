/** @jest-environment node */
jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));


const { EventEmitter }=require('events');
const mockCreate=jest.fn();
const mockList=jest.fn();
const mockAudit=jest.fn();
const mockSupabase={from:jest.fn(),rpc:jest.fn()};

jest.mock('../../lib/assistant/human-escalation',()=>({
  createHumanEscalation:(args)=>mockCreate(args),
  listUserHumanEscalations:(args)=>mockList(args)
}));
jest.mock('../../lib/assistant/audit-trail',()=>({
  appendAssistantAuditBestEffort:(args)=>mockAudit(args)
}));
jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>mockSupabase
}));

const { assistantRouter }=require('../../v3/api/assistant');

function req(method,body=null,url='/api/v3/assistant/escalations'){
  const r=new EventEmitter();
  r.method=method;
  r.url=url;
  if(body!==null) process.nextTick(()=>{
    r.emit('data',Buffer.from(JSON.stringify(body)));
    r.emit('end');
  });
  return r;
}
function res(done){
  return {
    statusCode:200,headers:{},
    setHeader(k,v){this.headers[k.toLowerCase()]=v;},
    end(v){done({statusCode:this.statusCode,body:v?JSON.parse(v):null});}
  };
}
function call(method,body,user={id:'user-1'},url){
  return new Promise(resolve=>assistantRouter(req(method,body,url),res(resolve),'/assistant/escalations',user));
}

describe('human escalation API',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockList.mockResolvedValue([]);
    mockAudit.mockResolvedValue({ok:true});
    mockCreate.mockResolvedValue({
      version:1,
      escalation:{id:'e-1',workflow_key:'wf-1',status:'open',execution_authorized:false},
      queued:true,replayed:false,execution_triggered:false,
      authorization:{granted:false,source:'human_review_only'}
    });
  });

  test('requires authentication for escalation routes',async()=>{
    const out=await call('GET',null,null);
    expect(out.statusCode).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  test('creates an exact governed escalation with no execution authority',async()=>{
    const out=await call('POST',{
      workflow_key:'wf-1',
      boundary:'project:p-1',
      expected_version:4,
      reason_code:'needs_expert_review',
      summary:'Needs specialist review',
      priority:'high',
      idempotency_key:'request-0001'
    });

    expect(out.statusCode).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      supabase:mockSupabase,
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      expectedVersion:4,
      reasonCode:'needs_expert_review',
      idempotencyKey:'request-0001'
    }));
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('priority');
    expect(out.body.authorization.granted).toBe(false);
    expect(out.body.execution_triggered).toBe(false);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      eventType:'write_succeeded',
      outcome:'human_escalation_queued'
    }));
  });

  test('maps stale workflow and ownership-boundary errors to 409',async()=>{
    mockCreate.mockRejectedValueOnce(new Error('WORKFLOW_VERSION_CONFLICT'));
    const conflict=await call('POST',{
      workflow_key:'wf-1',boundary:'project:p-1',expected_version:3,
      reason_code:'assistant_blocked',idempotency_key:'request-0002'
    });
    expect(conflict.statusCode).toBe(409);

    mockCreate.mockRejectedValueOnce(new Error('HUMAN_ESCALATION_BOUNDARY_CONFLICT'));
    const boundary=await call('POST',{
      workflow_key:'wf-1',boundary:'project:wrong',expected_version:4,
      reason_code:'assistant_blocked',idempotency_key:'request-0003'
    });
    expect(boundary.statusCode).toBe(409);
  });

  test('lists only user-scoped escalation summaries',async()=>{
    mockList.mockResolvedValue([{id:'e-1',status:'in_review',execution_authorized:false}]);
    const out=await call('GET',null,{id:'user-1'},'/api/v3/assistant/escalations?active=true');
    expect(out.statusCode).toBe(200);
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',
      activeOnly:true
    }));
    expect(out.body.policy.execution_authorized).toBe(false);
  });
});
