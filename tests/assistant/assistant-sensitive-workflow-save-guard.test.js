/** @jest-environment node */

const { EventEmitter }=require('events');
const mockSave=jest.fn();
const mockLoad=jest.fn();

jest.mock('../../lib/assistant/workflow-state',()=>({
  saveWorkflowState:(args)=>mockSave(args),
  loadWorkflowState:(args)=>mockLoad(args),
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
    mockLoad.mockResolvedValue(null);
    mockSave.mockResolvedValue({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:1,
      state:{ boundary:'project:p-1' }
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
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  test('preserves an existing sensitive state when saving ordinary context',async()=>{
    mockLoad.mockResolvedValueOnce({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:4,
      state:{
        boundary:'project:p-1',
        sensitive_state:'confirmed'
      }
    });
    mockSave.mockResolvedValueOnce({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:5,
      state:{
        boundary:'project:p-1',
        goal:'Updated goal',
        sensitive_state:'confirmed'
      }
    });

    const out=await call({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      expected_version:4,
      state:{
        boundary:'project:p-1',
        goal:'Updated goal'
      }
    });

    expect(out.statusCode).toBe(200);
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion:4,
      state:expect.objectContaining({
        goal:'Updated goal',
        sensitive_state:'confirmed'
      })
    }));
  });
});
