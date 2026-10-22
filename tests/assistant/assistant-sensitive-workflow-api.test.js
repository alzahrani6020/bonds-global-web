/** @jest-environment node */

const { EventEmitter }=require('events');
const mockTransition=jest.fn();

jest.mock('../../lib/assistant/sensitive-workflow-state-machine',()=>({
  transitionSensitiveWorkflowState:(args)=>mockTransition(args)
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
function call(body,user={id:'user-1'}){
  return new Promise(resolve=>assistantRouter(
    req(body),res(resolve),'/assistant/workflows/transition',user
  ));
}

describe('sensitive workflow transition API',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockTransition.mockResolvedValue({
      workflow:{
        workflow_key:'wf-1',
        boundary:'project:p-1',
        version:5,
        state:{ sensitive_state:'confirmed' }
      },
      transition:{ from:'ready',to:'confirmed',replayed:false },
      execution_triggered:false,
      business_submission_triggered:false,
      authorization:{ granted:false,source:'workflow_state_metadata_only' }
    });
  });

  test('requires authentication',async()=>{
    const out=await call({},null);
    expect(out.statusCode).toBe(401);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  test('passes exact user and version and returns no execution authority',async()=>{
    const out=await call({
      workflow_key:'wf-1',
      to_state:'confirmed',
      expected_version:4,
      boundary:'project:p-1',
      reason:'confirmed'
    });
    expect(out.statusCode).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',
      workflowKey:'wf-1',
      toState:'confirmed',
      expectedVersion:4,
      boundary:'project:p-1'
    }));
    expect(out.body.authorization.granted).toBe(false);
    expect(out.body.execution_triggered).toBe(false);
    expect(out.body.business_submission_triggered).toBe(false);
  });

  test('maps invalid transition and version errors to client errors',async()=>{
    mockTransition.mockRejectedValueOnce(new Error('SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED'));
    const invalid=await call({
      workflow_key:'wf-1',to_state:'completed',expected_version:4
    });
    expect(invalid.statusCode).toBe(422);

    mockTransition.mockRejectedValueOnce(new Error('WORKFLOW_VERSION_CONFLICT'));
    const conflict=await call({
      workflow_key:'wf-1',to_state:'confirmed',expected_version:4
    });
    expect(conflict.statusCode).toBe(409);
  });
});
