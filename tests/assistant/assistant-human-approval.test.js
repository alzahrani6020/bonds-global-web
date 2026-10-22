/** @jest-environment node */
const mockLoadWorkflow=jest.fn();
jest.mock('../../lib/assistant/workflow-state',()=>({loadWorkflowState:(args)=>mockLoadWorkflow(args)}));
const {APPROVAL_PERMISSION,approvalRequestKey,requestHumanApproval,listHumanApprovalQueue,decideHumanApproval}=require('../../lib/assistant/human-approval');
function query(result){
  const state={eq:[],update:null,insert:null};
  const q={select:jest.fn().mockReturnThis(),eq(k,v){state.eq.push([k,v]);return q;},order:jest.fn().mockReturnThis(),limit:jest.fn().mockReturnThis(),insert(v){state.insert=v;return q;},update(v){state.update=v;return q;},single:jest.fn().mockResolvedValue(result),maybeSingle:jest.fn().mockResolvedValue(result),then(resolve){return Promise.resolve(result).then(resolve);}};
  return {q,state};
}
describe('Human Approval Queue',()=>{
  beforeEach(()=>{jest.clearAllMocks();mockLoadWorkflow.mockResolvedValue({workflow_key:'wf-1',boundary:'project:p-1',version:4,status:'active'});});
  test('reuses the existing admin approval control-plane permission',()=>{expect(APPROVAL_PERMISSION).toBe('assistant.human_approval');});
  test('request key is opaque and stable for idempotency',()=>{const a=approvalRequestKey({userId:'u1',workflowKey:'wf-1',idempotencyKey:'approval-001'});const b=approvalRequestKey({userId:'u1',workflowKey:'wf-1',idempotencyKey:'approval-001'});expect(a).toBe(b);expect(a).toMatch(/^human-approval:[a-f0-9]{40}$/);expect(a).not.toContain('u1');});
  test('writes to existing admin_approval_requests and grants no execution',async()=>{
    const lookup=query({data:null,error:null});const inserted=query({data:{id:'a1',requested_by:'u1',permission:'assistant.human_approval',workflow_key:'wf-1',boundary:'project:p-1',workflow_version:4,action_type:'form_submit',target_id:'wf-1',action_fingerprint:'a'.repeat(64),risk:'high',status:'pending',payload:{action_id:'act-1',action_target:'funding'}},error:null});let calls=0;const supabase={from:jest.fn(()=>++calls===1?lookup.q:inserted.q)};
    const out=await requestHumanApproval({supabase,userId:'u1',workflowKey:'wf-1',boundary:'project:p-1',expectedVersion:4,action:{id:'act-1',type:'form_submit',capability:'form_submit',target:'funding',input:{x:1},risk:'high',requires_confirmation:true,status:'ready'},idempotencyKey:'approval-001'});
    expect(supabase.from).toHaveBeenCalledWith('admin_approval_requests');expect(inserted.state.insert).toEqual(expect.objectContaining({requested_by:'u1',permission:'assistant.human_approval',workflow_key:'wf-1',risk:'high'}));expect(out.execution_authorized).toBe(false);
  });
  test('rejects actions below the human-approval risk threshold',async()=>{
    const supabase={from:jest.fn()};
    await expect(requestHumanApproval({supabase,userId:'u1',workflowKey:'wf-1',boundary:'project:p-1',expectedVersion:4,action:{id:'a',type:'site_navigate',capability:'site_navigate',target:'home',input:{},risk:'low',requires_confirmation:true,status:'ready'},idempotencyKey:'approval-002'})).rejects.toThrow('HUMAN_APPROVAL_RISK_NOT_ELIGIBLE');
  });
  test('decision is pending-only, reviewer-bound and never authorizes execution',async()=>{
    const dq=query({data:{id:'a1',requested_by:'u1',permission:'assistant.human_approval',workflow_key:'wf-1',boundary:'project:p-1',workflow_version:4,action_type:'form_submit',target_id:'wf-1',action_fingerprint:'a'.repeat(64),risk:'critical',status:'approved',approvals:[{reviewer_user_id:'admin-1',decision:'approved'}],payload:{action_id:'act-1',action_target:'funding'}},error:null});
    const out=await decideHumanApproval({supabase:{from:jest.fn(()=>dq.q)},approvalId:'a1',reviewerUserId:'admin-1',decision:'approved',note:'Reviewed'});
    expect(dq.state.eq).toContainEqual(['permission','assistant.human_approval']);expect(dq.state.eq).toContainEqual(['status','pending']);expect(dq.state.update.status).toBe('approved');expect(dq.state.update.approvals[0].reviewer_user_id).toBe('admin-1');expect(out.execution_authorized).toBe(false);
  });
  test('admin queue is scoped to assistant approval permission and pending by default',async()=>{const q0=query({data:[],error:null});await listHumanApprovalQueue({supabase:{from:jest.fn(()=>q0.q)}});expect(q0.state.eq).toContainEqual(['permission','assistant.human_approval']);expect(q0.state.eq).toContainEqual(['status','pending']);});
  test('public approval never exposes internal reviewer note',()=>{
    const {publicApproval}=require('../../lib/assistant/human-approval');
    const out=publicApproval({
      id:'a1',
      workflow_key:'wf-1',
      boundary:'project:p-1',
      workflow_version:4,
      action_id:'act-1',
      action_type:'form_submit',
      action_target:'funding',
      action_fingerprint:'a'.repeat(64),
      risk:'high',
      status:'approved',
      approvals:[{reviewer_user_id:'admin-1',decision:'approved',note:'internal staff-only note',reviewed_at:'2026-10-22T16:00:00Z'}]
    });
    expect(out).not.toHaveProperty('decision_note');
    expect(JSON.stringify(out)).not.toContain('internal staff-only note');
  });

});
