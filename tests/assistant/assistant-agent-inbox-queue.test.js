/** @jest-environment node */

const {
  deriveAgentInboxItem,
  enqueueAgentInboxItem,
  listAgentInbox,
  updateAgentInboxItem,
  listAgentAssignees
} = require('../../lib/assistant/agent-inbox-queue');

describe('Assistant Agent Inbox', () => {
  test('derives a critical document conflict review item with semantic dedupe key', () => {
    const item=deriveAgentInboxItem({
      userId:'user-1',
      workflow:{ workflow_key:'funding.case-1', boundary:'project:p-1', version:4 },
      event:{
        id:'evt-1',
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-1',
        source:'system',
        data:{ conflict:true, reason:'اسم المنشأة لا يطابق الطلب' }
      }
    });

    expect(item).toMatchObject({
      item_key:'review:funding.case-1:document_conflict:doc-1',
      reason_code:'document_conflict',
      priority:'critical',
      user_id:'user-1',
      workflow_key:'funding.case-1',
      resource_id:'doc-1'
    });
  });

  test('does not create inbox work for ordinary non-review events', () => {
    expect(deriveAgentInboxItem({
      userId:'user-1',
      workflow:{ workflow_key:'wf-1', boundary:'project:p-1' },
      event:{
        id:'evt-2',
        type:'document_analyzed',
        boundary:'project:p-1',
        resource_id:'doc-1',
        data:{ review_required:false, verification_state:'supported' }
      }
    })).toBeNull();
  });

  test('funding on-hold status becomes a high-priority human follow-up', () => {
    const item=deriveAgentInboxItem({
      userId:'user-1',
      workflow:{ workflow_key:'funding.case-2', boundary:'project:p-2' },
      event:{
        id:'evt-3',
        type:'funding_case_status_changed',
        boundary:'project:p-2',
        resource_id:'case-2',
        data:{ status:'on_hold' }
      }
    });
    expect(item).toMatchObject({
      reason_code:'funding_case_review_required',
      priority:'high',
      item_key:'review:funding.case-2:funding_case_review_required:case-2'
    });
  });

  test('enqueue is idempotent on item_key', async () => {
    const maybeSingle=jest.fn().mockResolvedValue({
      data:{ id:'i-1', item_key:'k-1', status:'open', priority:'high' },
      error:null
    });
    const select=jest.fn().mockReturnValue({ maybeSingle });
    const upsert=jest.fn().mockReturnValue({ select });
    const supabase={ from:jest.fn(()=>({ upsert })) };

    const out=await enqueueAgentInboxItem({
      supabase,
      item:{ item_key:'k-1' }
    });

    expect(supabase.from).toHaveBeenCalledWith('assistant_agent_inbox');
    expect(upsert).toHaveBeenCalledWith(
      { item_key:'k-1' },
      { onConflict:'item_key', ignoreDuplicates:true }
    );
    expect(out.queued).toBe(true);
  });

  test('list defaults to active statuses and keeps execution unauthorized', async () => {
    const result={ data:[{ id:'i-1', status:'open', priority:'critical' }], error:null };
    const q={
      select:jest.fn().mockReturnThis(),
      order:jest.fn().mockReturnThis(),
      limit:jest.fn().mockReturnThis(),
      in:jest.fn().mockResolvedValue(result),
      eq:jest.fn().mockReturnThis()
    };
    const supabase={ from:jest.fn(()=>q) };
    const out=await listAgentInbox({ supabase });

    expect(q.in).toHaveBeenCalledWith('status',['open','assigned','in_review','waiting_user']);
    expect(out.policy).toEqual({
      employee_only:true,
      auto_execute:false,
      execution_authorized:false
    });
  });

  test('assignment must target an admin/support user and records actor', async () => {
    const roleQuery={
      select:jest.fn().mockReturnThis(),
      eq:jest.fn().mockReturnThis(),
      in:jest.fn().mockReturnThis(),
      maybeSingle:jest.fn().mockResolvedValue({
        data:{ user_id:'agent-1', role:'support' },
        error:null
      })
    };
    const updateQuery={
      update:jest.fn().mockReturnThis(),
      eq:jest.fn().mockReturnThis(),
      select:jest.fn().mockReturnThis(),
      maybeSingle:jest.fn().mockResolvedValue({
        data:{ id:'i-1', assigned_to:'agent-1', status:'assigned' },
        error:null
      })
    };
    const supabase={
      from:jest.fn(table => table==='admin_roles' ? roleQuery : updateQuery)
    };

    const out=await updateAgentInboxItem({
      supabase,
      itemId:'i-1',
      actorUserId:'admin-1',
      assignedTo:'agent-1'
    });

    expect(roleQuery.eq).toHaveBeenCalledWith('user_id','agent-1');
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      assigned_to:'agent-1',
      assigned_by:'admin-1',
      status:'assigned'
    }));
    expect(out.id).toBe('i-1');
  });

  test('rejects assignment to a non-agent user', async () => {
    const roleQuery={
      select:jest.fn().mockReturnThis(),
      eq:jest.fn().mockReturnThis(),
      in:jest.fn().mockReturnThis(),
      maybeSingle:jest.fn().mockResolvedValue({ data:null, error:null })
    };
    const supabase={ from:jest.fn(()=>roleQuery) };

    await expect(updateAgentInboxItem({
      supabase,
      itemId:'i-1',
      actorUserId:'admin-1',
      assignedTo:'random-user'
    })).rejects.toThrow('AGENT_INBOX_ASSIGNEE_INVALID');
  });

  test('assignee list is limited to operational admin roles', async () => {
    const q={
      select:jest.fn().mockReturnThis(),
      in:jest.fn().mockReturnThis(),
      order:jest.fn().mockResolvedValue({
        data:[{ user_id:'a1', role:'admin' },{ user_id:'s1', role:'support' }],
        error:null
      })
    };
    const out=await listAgentAssignees({ supabase:{ from:jest.fn(()=>q) } });
    expect(q.in).toHaveBeenCalledWith('role',['super_admin','admin','support']);
    expect(out).toHaveLength(2);
  });
});
