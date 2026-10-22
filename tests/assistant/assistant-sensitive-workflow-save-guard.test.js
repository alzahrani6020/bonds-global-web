/** @jest-environment node */

const { EventEmitter }=require('events');

jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));
const mockSave=jest.fn();

jest.mock('../../lib/assistant/workflow-state',()=>({
  saveWorkflowState:(args)=>mockSave(args),
  loadWorkflowState:jest.fn(),
  setWorkflowStatus:jest.fn()
}));
jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>({ rpc:jest.fn(), from:jest.fn() })
}));

const { assistantRouter }=require('../../v3/api/assistant');

function req(body){
  const r=new EventEmitter();
  r.method='POST';
  process.nextTick(()=>{
    r.emit('data',Buffer.from(JSON.stringify(body||{})));
    r.emit('end');
  });
  return r;
}
function res(done){
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[String(k).toLowerCase()]=v; },
    end(v){ done({statusCode:this.statusCode,body:v?JSON.parse(v):null}); }
  };
}
function call(body){
  return new Promise(resolve=>assistantRouter(
    req(body),res(resolve),'/assistant/workflows/save',{id:'user-1'}
  ));
}

describe('sensitive state direct-save guard',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockSave.mockResolvedValue({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:2,
      state:{ boundary:'project:p-1', goal:'Updated goal' }
    });
  });

  test('rejects direct sensitive_state writes through general workflow save',async()=>{
    const out=await call({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      state:{
        boundary:'project:p-1',
        sensitive_state:'completed'
      }
    });
    expect(out.statusCode).toBe(422);
    expect(out.body.error).toBe('SENSITIVE_STATE_DIRECT_WRITE_FORBIDDEN');
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('ordinary context saves retain the original one-save API contract',async()=>{
    const out=await call({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      expected_version:1,
      state:{
        boundary:'project:p-1',
        goal:'Updated goal'
      }
    });
    expect(out.statusCode).toBe(200);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',
      expectedVersion:1,
      state:expect.objectContaining({ goal:'Updated goal' })
    }));
  });

  test('optimistic version conflict remains a 409',async()=>{
    mockSave.mockRejectedValueOnce(new Error('WORKFLOW_VERSION_CONFLICT'));
    const out=await call({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      expected_version:1,
      state:{ boundary:'project:p-1' }
    });
    expect(out.statusCode).toBe(409);
    expect(out.body.error).toBe('WORKFLOW_VERSION_CONFLICT');
  });
});
