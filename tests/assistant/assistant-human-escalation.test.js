/** @jest-environment node */

const mockLoadWorkflow=jest.fn();
const mockEnqueue=jest.fn();

jest.mock('../../lib/assistant/workflow-state',()=>({
  loadWorkflowState:(args)=>mockLoadWorkflow(args)
}));
jest.mock('../../lib/assistant/agent-inbox-queue',()=>({
  enqueueAgentInboxItem:(args)=>mockEnqueue(args)
}));

const {
  HUMAN_ESCALATION_PRIORITY_BY_REASON,
  priorityForReason,
  escalationItemKey,
  createHumanEscalation,
  listUserHumanEscalations
}=require('../../lib/assistant/human-escalation');

function query(result) {
  const state={eq:[],like:[],in:[],limit:null};
  const q={
    select(){ return q; },
    eq(k,v){ state.eq.push([k,v]); return q; },
    like(k,v){ state.like.push([k,v]); return q; },
    in(k,v){ state.in.push([k,v]); return q; },
    order(){ return q; },
    limit(v){ state.limit=v; return q; },
    maybeSingle(){ return Promise.resolve(result); },
    then(resolve){ return Promise.resolve(result).then(resolve); }
  };
  return {q,state};
}

describe('human escalation bridge',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockLoadWorkflow.mockResolvedValue({
      workflow_key:'wf-1',
      boundary:'project:p-1',
      status:'active',
      version:4
    });
    mockEnqueue.mockResolvedValue({queued:true,skipped:false,item:{id:'partial'}});
  });

  test('derives queue priority from bounded reason, not caller input',()=>{
    expect(HUMAN_ESCALATION_PRIORITY_BY_REASON.user_requested).toBe('medium');
    expect(priorityForReason('data_conflict')).toBe('critical');
    expect(priorityForReason('assistant_blocked')).toBe('high');
    expect(()=>priorityForReason('arbitrary')).toThrow('HUMAN_ESCALATION_REASON_INVALID');
  });

  test('derives a bounded opaque idempotent queue key',()=>{
    const a=escalationItemKey({userId:'u-1',workflowKey:'wf-1',idempotencyKey:'request-0001'});
    const b=escalationItemKey({userId:'u-1',workflowKey:'wf-1',idempotencyKey:'request-0001'});
    expect(a).toBe(b);
    expect(a).toMatch(/^human-escalation:[a-f0-9]{40}$/);
    expect(a).not.toContain('u-1');
  });

  test('queues only an owned exact-version exact-boundary workflow and grants no execution',async()=>{
    const first=query({data:null,error:null});
    const persisted=query({data:{
      id:'item-1',
      workflow_key:'wf-1',
      boundary:'project:p-1',
      reason_code:'human_escalation_needs_expert_review',
      priority:'high',
      status:'open',
      title_ar:'طلب مراجعة بشرية',
      title_en:'Human review requested',
      summary_ar:'Needs specialist review',
      created_at:'2026-10-22T16:00:00Z',
      updated_at:'2026-10-22T16:00:00Z'
    },error:null});
    let calls=0;
    const supabase={
      rpc:jest.fn(),
      from:jest.fn(()=>{
        calls++;
        return calls===1 ? first.q : persisted.q;
      })
    };

    const out=await createHumanEscalation({
      supabase,
      userId:'user-1',
      workflowKey:'wf-1',
      boundary:'project:p-1',
      expectedVersion:4,
      reasonCode:'needs_expert_review',
      summary:'Needs specialist review',
      idempotencyKey:'request-0001'
    });

    expect(mockLoadWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      userId:'user-1',workflowKey:'wf-1'
    }));
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      item:expect.objectContaining({
        source_type:'workflow',
        user_id:'user-1',
        workflow_key:'wf-1',
        boundary:'project:p-1',
        reason_code:'human_escalation_needs_expert_review',
        priority:'high'
      })
    }));
    expect(out.escalation.id).toBe('item-1');
    expect(out.execution_triggered).toBe(false);
    expect(out.authorization.granted).toBe(false);
  });

  test('replays the same idempotency key without enqueuing twice',async()=>{
    const existing=query({data:{
      id:'item-1',workflow_key:'wf-1',boundary:'project:p-1',
      reason_code:'human_escalation_user_requested',priority:'high',status:'open'
    },error:null});
    const supabase={rpc:jest.fn(),from:jest.fn(()=>existing.q)};

    const out=await createHumanEscalation({
      supabase,userId:'user-1',workflowKey:'wf-1',boundary:'project:p-1',
      expectedVersion:4,reasonCode:'user_requested',
      idempotencyKey:'request-0002'
    });

    expect(out.replayed).toBe(true);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  test('rejects stale version and boundary conflict before queue write',async()=>{
    const q0=query({data:null,error:null});
    const supabase={rpc:jest.fn(),from:jest.fn(()=>q0.q)};

    await expect(createHumanEscalation({
      supabase,userId:'user-1',workflowKey:'wf-1',boundary:'project:other',
      expectedVersion:4,reasonCode:'assistant_blocked',idempotencyKey:'request-0003'
    })).rejects.toThrow('HUMAN_ESCALATION_BOUNDARY_CONFLICT');

    await expect(createHumanEscalation({
      supabase,userId:'user-1',workflowKey:'wf-1',boundary:'project:p-1',
      expectedVersion:3,reasonCode:'assistant_blocked',idempotencyKey:'request-0004'
    })).rejects.toThrow('WORKFLOW_VERSION_CONFLICT');

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  test('lists only the requesting user human-escalation rows',async()=>{
    const rows=query({data:[],error:null});
    const supabase={from:jest.fn(()=>rows.q)};
    await listUserHumanEscalations({supabase,userId:'user-1',activeOnly:true,limit:12});

    expect(supabase.from).toHaveBeenCalledWith('assistant_agent_inbox');
    expect(rows.state.eq).toContainEqual(['user_id','user-1']);
    expect(rows.state.eq).toContainEqual(['source_type','workflow']);
    expect(rows.state.like).toContainEqual(['reason_code','human_escalation_%']);
    expect(rows.state.in).toContainEqual(['status',['open','assigned','in_review','waiting_user']]);
    expect(rows.state.limit).toBe(12);
  });
});
