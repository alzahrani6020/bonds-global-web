/** @jest-environment node */

const {
  resolveEmployeeAssistantMode,
  buildEmployeeAssistantWorkspace
}=require('../../lib/assistant/employee-assistant-mode');

function roleQuery(role,error=null){
  return {
    select(){return this;},
    eq(){return this;},
    maybeSingle:jest.fn().mockResolvedValue({data:role?{role}:null,error})
  };
}

describe('Employee Assistant Mode',()=>{
  beforeEach(()=>{
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
  });

  test('ordinary user remains customer mode with no employee authority',async()=>{
    const supabase={from:jest.fn(()=>roleQuery(null))};
    const out=await resolveEmployeeAssistantMode({supabase,user:{id:'u1',email:'user@example.com'}});
    expect(out.current_mode).toBe('customer');
    expect(out.available_modes).toEqual(['customer']);
    expect(out.employee.eligible).toBe(false);
    expect(out.policy.execution_authorized).toBe(false);
    expect(out.policy.permission_escalation).toBe(false);
  });

  test('support receives employee mode but cannot review human approvals',async()=>{
    const supabase={from:jest.fn(()=>roleQuery('support'))};
    const out=await resolveEmployeeAssistantMode({supabase,user:{id:'s1',email:'support@example.com'}});
    expect(out.current_mode).toBe('employee');
    expect(out.employee.role).toBe('support');
    expect(out.policy.agent_inbox).toBe('available');
    expect(out.policy.human_approval).toBe('unavailable');
    expect(out.policy.support_can_decide_human_approvals).toBe(false);
  });

  test('admin receives employee mode with review surface but no execution authority',async()=>{
    const supabase={from:jest.fn(()=>roleQuery('admin'))};
    const out=await resolveEmployeeAssistantMode({supabase,user:{id:'a1',email:'admin@example.com'}});
    expect(out.current_mode).toBe('employee');
    expect(out.employee.role).toBe('admin');
    expect(out.policy.human_approval).toBe('review');
    expect(out.policy.execution_authorized).toBe(false);
    expect(out.policy.auto_execute).toBe(false);
  });

  test('configured owner email is attributable without admin_roles lookup',async()=>{
    process.env.ADMIN_EMAILS='owner@example.com';
    const supabase={from:jest.fn()};
    const out=await resolveEmployeeAssistantMode({supabase,user:{id:'o1',email:'owner@example.com'}});
    expect(out.employee.role).toBe('owner');
    expect(out.employee.identity_source).toBe('owner_email');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('workspace exposes only bounded operational counts',async()=>{
    const supabase={from:jest.fn(()=>roleQuery('admin'))};
    const listAgentInbox=jest.fn().mockResolvedValue({items:[{id:'1'},{id:'2'}]});
    const listHumanApprovalQueue=jest.fn().mockResolvedValue({items:[{id:'a1'}]});
    const out=await buildEmployeeAssistantWorkspace({
      supabase,user:{id:'a1',email:'admin@example.com'},listAgentInbox,listHumanApprovalQueue
    });
    expect(out.workspace.agent_inbox.active_count).toBe(2);
    expect(out.workspace.human_approvals.pending_count).toBe(1);
    expect(out.workspace).not.toHaveProperty('items');
    expect(out.policy.execution_authorized).toBe(false);
  });

  test('support workspace never queries human approvals',async()=>{
    const supabase={from:jest.fn(()=>roleQuery('support'))};
    const listAgentInbox=jest.fn().mockResolvedValue({items:[]});
    const listHumanApprovalQueue=jest.fn();
    const out=await buildEmployeeAssistantWorkspace({
      supabase,user:{id:'s1',email:'support@example.com'},listAgentInbox,listHumanApprovalQueue
    });
    expect(listHumanApprovalQueue).not.toHaveBeenCalled();
    expect(out.workspace.human_approvals.available).toBe(false);
  });
});
