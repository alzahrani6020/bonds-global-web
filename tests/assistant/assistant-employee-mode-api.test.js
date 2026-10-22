/** @jest-environment node */
const EventEmitter=require('events');

const mockResolve=jest.fn();
const mockWorkspace=jest.fn();

jest.mock('../../lib/assistant/employee-assistant-mode',()=>({
  resolveEmployeeAssistantMode:(args)=>mockResolve(args),
  buildEmployeeAssistantWorkspace:(args)=>mockWorkspace(args)
}));

jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>({from:jest.fn()})
}));

const {assistantRouter}=require('../../v3/api/assistant');

function req(url){
  const r=new EventEmitter();
  r.method='GET';
  r.url=url;
  r.headers={host:'localhost'};
  return r;
}
function res(done){
  return{
    statusCode:200,
    headers:{},
    setHeader(k,v){this.headers[k]=v;},
    end(v){done({statusCode:this.statusCode,body:v?JSON.parse(v):null});}
  };
}
const call=(url,user={id:'u1',email:'user@example.com'})=>
  new Promise(resolve=>assistantRouter(req(url),res(resolve),url.replace('/api/v3',''),user));

describe('Employee Assistant API',()=>{
  beforeEach(()=>jest.clearAllMocks());

  test('mode endpoint returns governed operating mode',async()=>{
    mockResolve.mockResolvedValue({
      current_mode:'employee',
      employee:{eligible:true,role:'admin'},
      policy:{execution_authorized:false,permission_escalation:false}
    });
    const out=await call('/api/v3/assistant/mode',{id:'a1',email:'admin@example.com'});
    expect(out.statusCode).toBe(200);
    expect(out.body.assistant_mode.current_mode).toBe('employee');
    expect(out.body.assistant_mode.policy.execution_authorized).toBe(false);
  });

  test('employee workspace denies ordinary users',async()=>{
    mockWorkspace.mockRejectedValue(new Error('EMPLOYEE_ASSISTANT_ACCESS_DENIED'));
    const out=await call('/api/v3/assistant/employee/workspace');
    expect(out.statusCode).toBe(403);
    expect(out.body.error).toBe('EMPLOYEE_ASSISTANT_ACCESS_DENIED');
  });

  test('employee workspace returns bounded operational summary',async()=>{
    mockWorkspace.mockResolvedValue({
      current_mode:'employee',
      employee:{eligible:true,role:'support'},
      workspace:{
        agent_inbox:{active_count:3},
        human_approvals:{available:false,pending_count:0}
      },
      policy:{execution_authorized:false}
    });
    const out=await call('/api/v3/assistant/employee/workspace',{id:'s1',email:'support@example.com'});
    expect(out.statusCode).toBe(200);
    expect(out.body.employee_assistant.workspace.agent_inbox.active_count).toBe(3);
    expect(out.body.employee_assistant.workspace.human_approvals.available).toBe(false);
    expect(out.body.employee_assistant.policy.execution_authorized).toBe(false);
  });
});
