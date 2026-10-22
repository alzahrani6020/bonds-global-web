/** @jest-environment node */

const { EventEmitter } = require('events');
const mockAccess=jest.fn();
const mockList=jest.fn();
const mockUpdate=jest.fn();
const mockAssignees=jest.fn();

jest.mock('../../v3/lib/admin-access', () => ({
  requireAdminAccess:jest.fn(),
  requireAgentInboxAccess:(req)=>mockAccess(req)
}));

jest.mock('../../lib/assistant/agent-inbox-queue', () => ({
  listAgentInbox:(args)=>mockList(args),
  updateAgentInboxItem:(args)=>mockUpdate(args),
  listAgentAssignees:(args)=>mockAssignees(args)
}));

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient:()=>({ from:jest.fn() })
}));

const { adminRouter } = require('../../v3/api/admin');

function req(method='GET', url='/api/v3/admin/agent-inbox', body=null) {
  const r=new EventEmitter();
  r.method=method;
  r.url=url;
  r.headers={ host:'localhost' };
  if(body!==null){
    process.nextTick(()=>{
      r.emit('data',Buffer.from(JSON.stringify(body)));
      r.emit('end');
    });
  }
  return r;
}
function res(done){
  return {
    statusCode:200,
    headers:{},
    setHeader(k,v){ this.headers[k.toLowerCase()]=v; },
    end(v){ done({ statusCode:this.statusCode, body:v?JSON.parse(v):null }); }
  };
}
function call(path, request){
  return new Promise(resolve=>adminRouter(request,res(resolve),path));
}

describe('Agent Inbox admin API', () => {
  beforeEach(()=>{
    jest.clearAllMocks();
    mockAccess.mockResolvedValue({
      user:{ id:'support-1' },
      role:'support',
      source:'bearer'
    });
    mockList.mockResolvedValue({
      version:1,
      items:[],
      policy:{ employee_only:true, auto_execute:false, execution_authorized:false }
    });
    mockAssignees.mockResolvedValue([]);
  });

  test('support role can read Agent Inbox without widening other admin routes', async () => {
    const out=await call('/admin/agent-inbox',req());
    expect(out.statusCode).toBe(200);
    expect(out.body.role).toBe('support');
    expect(out.body.agent_inbox.policy.execution_authorized).toBe(false);
  });

  test('unauthorized request is denied', async () => {
    mockAccess.mockResolvedValue(null);
    const out=await call('/admin/agent-inbox',req());
    expect(out.statusCode).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  test('assignee endpoint returns only server-approved agents', async () => {
    mockAssignees.mockResolvedValue([{ user_id:'a1', role:'admin' }]);
    const out=await call('/admin/agent-inbox/assignees',req('GET','/api/v3/admin/agent-inbox/assignees'));
    expect(out.statusCode).toBe(200);
    expect(out.body.assignees).toEqual([{ user_id:'a1', role:'admin' }]);
  });

  test('status/assignment update records authenticated actor', async () => {
    mockUpdate.mockResolvedValue({ id:'i-1', status:'in_review' });
    const out=await call(
      '/admin/agent-inbox/i-1',
      req('PATCH','/api/v3/admin/agent-inbox/i-1',{
        assigned_to:'agent-1',
        status:'in_review'
      })
    );
    expect(out.statusCode).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      itemId:'i-1',
      actorUserId:'support-1',
      assignedTo:'agent-1',
      status:'in_review'
    }));
  });
});
