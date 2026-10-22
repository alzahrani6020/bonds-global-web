/** @jest-environment node */
jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));


const { EventEmitter } = require('events');
const mockApply=jest.fn();
const mockPersist=jest.fn();
const mockAudit=jest.fn();
const mockDerive=jest.fn();
const mockVerifyOwnership=jest.fn();
const mockEnqueue=jest.fn();
const mockSupabase={ from:jest.fn(), rpc:jest.fn() };

jest.mock('../../lib/assistant/event-driven',()=>({
  applyAssistantEvent:(args)=>mockApply(args)
}));
jest.mock('../../lib/assistant/notification-store',()=>({
  persistAssistantNotifications:(args)=>mockPersist(args),
  listAssistantNotifications:jest.fn(),
  markAssistantNotificationRead:jest.fn()
}));
jest.mock('../../lib/assistant/notification-engine',()=>({
  notificationsFromAssistantEvent:jest.fn(()=>[])
}));
jest.mock('../../lib/assistant/audit-trail',()=>({
  appendAssistantAuditBestEffort:(args)=>mockAudit(args)
}));
jest.mock('../../lib/assistant/agent-inbox-queue',()=>({
  deriveAgentInboxItem:(args)=>mockDerive(args),
  verifyAgentInboxItemOwnership:(args)=>mockVerifyOwnership(args),
  enqueueAgentInboxItem:(args)=>mockEnqueue(args)
}));
jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>mockSupabase
}));

const { assistantRouter }=require('../../v3/api/assistant');

function req(body){
  const r=new EventEmitter();
  r.method='POST';
  process.nextTick(()=>{
    r.emit('data',Buffer.from(JSON.stringify(body)));
    r.emit('end');
  });
  return r;
}
function res(done){
  return {
    statusCode:200,headers:{},
    setHeader(k,v){this.headers[k.toLowerCase()]=v;},
    end(v){done({statusCode:this.statusCode,body:JSON.parse(v)})}
  };
}
function call(body){
  return new Promise(resolve=>assistantRouter(req(body),res(resolve),'/assistant/events/apply',{id:'user-1'}));
}

describe('Assistant event to Agent Inbox integration',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockPersist.mockResolvedValue({persisted:0});
    mockAudit.mockResolvedValue({ok:true});
    mockApply.mockResolvedValue({
      event:{
        id:'evt-review-1',
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-1',
        data:{conflict:true}
      },
      workflow:{workflow_key:'wf-1',boundary:'project:p-1',version:2},
      notifications:[],
      replayed:false,
      suggestions:[],
      authorization:{granted:false},
      execution_triggered:false
    });
    mockDerive.mockReturnValue({
      item_key:'review:wf-1:document_conflict:doc-1'
    });
    mockVerifyOwnership.mockResolvedValue(true);
    mockEnqueue.mockResolvedValue({queued:true,skipped:false,item:{id:'i-1'}});
  });

  test('queues server-derived human review work after event application',async()=>{
    const out=await call({
      workflow_key:'wf-1',
      event:{
        id:'evt-review-1',
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-1',
        data:{conflict:true}
      }
    });

    expect(out.statusCode).toBe(200);
    expect(mockDerive).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',
      workflow:expect.objectContaining({workflow_key:'wf-1'})
    }));
    expect(mockVerifyOwnership).toHaveBeenCalledWith(expect.objectContaining({
      supabase:mockSupabase,
      userId:'user-1',
      event:expect.objectContaining({ resource_id:'doc-1' })
    }));
    expect(mockEnqueue).toHaveBeenCalledWith({
      supabase:mockSupabase,
      item:{item_key:'review:wf-1:document_conflict:doc-1'}
    });
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      metadata:expect.objectContaining({agent_inbox_queued:true})
    }));
  });


  test('does not queue a review event for a resource the user does not own',async()=>{
    mockVerifyOwnership.mockResolvedValue(false);

    const out=await call({
      workflow_key:'wf-1',
      event:{
        id:'evt-review-1',
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-1',
        data:{conflict:true}
      }
    });

    expect(out.statusCode).toBe(200);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      metadata:expect.objectContaining({agent_inbox_queued:false})
    }));
  });

  test('Agent Inbox outage does not fail the user workflow event',async()=>{
    mockEnqueue.mockRejectedValue(new Error('AGENT_INBOX_ENQUEUE_FAILED'));
    const warn=jest.spyOn(console,'warn').mockImplementation(()=>{});

    const out=await call({
      workflow_key:'wf-1',
      event:{
        id:'evt-review-1',
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-1',
        data:{conflict:true}
      }
    });

    expect(out.statusCode).toBe(200);
    expect(out.body.status).toBe('completed');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
