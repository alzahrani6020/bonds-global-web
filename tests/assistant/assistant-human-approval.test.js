/** @jest-environment node */
const mockLoadWorkflow=jest.fn();
jest.mock('../../lib/assistant/workflow-state',()=>({loadWorkflowState:(args)=>mockLoadWorkflow(args)}));
const {approvalRequestKey,requestHumanApproval,listHumanApprovalQueue,decideHumanApproval}=require('../../lib/assistant/human-approval');
function query(result){
  const state={eq:[],update:null,insert:null};
  const q={select:jest.fn().mockReturnThis(),eq(k,v){state.eq.push([k,v]);return q;},order:jest.fn().mockReturnThis(),limit:jest.fn().mockReturnThis(),insert(v){state.insert=v;return q;},update(v){state.update=v;return q;},single:jest.fn().mockResolvedValue(result),maybeSingle:jest.fn().mockResolvedValue(result),then(resolve){return Promise.resolve(result).then(resolve);}};
  return {q,state};
}
describe('Human Approval Queue',()=>{
  beforeEach(()=>{jest.clearAllMocks();mockLoadWorkflow.mockResolvedValue({workflow_key:'wf-1',boundary:'project:p-1',version:4,status:'active'});});
  test('request key is opaque and stable for idempotency',()=>{const a=approvalRequestKey({userId:'u1',workflowKey:'wf-1',idempotencyKey:'approval-001'});const b=approvalRequestKey({userId:'u1',workflowKey:'wf-1',idempotencyKey:'approval-001'});expect(a).toBe(b);expect(a).toMatch(/^human-approval:[a-f0-9]{40}$/);expect(a).not.toContain('u1');});
  test('accepts only high or critical confirmation-required action and grants no execution',async()=>{
    const lookup=query({data:null,error:null});const inserted=query({data:{id:'a1',workflow_key:'wf-1',boundary:'project:p-1',workflow_version:4,action_id:'act-1',action_type:'form_submit',action_target:'funding',action_fingerprint:'a'.repeat(64),risk:'high',status:'pending'},error:null});let calls=0;const supabase={from:jest.fn(()=>++calls===1?lookup.q:inserted.q)};
    const out=await requestHumanApproval({supabase,userId:'u1',workflowKey:'wf-1',boundary:'project:p-1',expectedVersion:4,action:{id:'act-1',type:'form_submit',capability:'form_submit',target:'funding',input:{x:1},risk:'high',requires_confirmation:true,status:'ready'},idempotencyKey:'approval-001'});
    expect(inserted.state.insert).toEqual(expect.objectContaining({user_id:'u1',workflow_key:'wf-1',workflow_version:4,risk:'high'}));expect(out.execution_authorized).toBe(false);
  });
  test('rejects low-risk or non-confirmation actions',async()=>{
    const supabase={from:jest.fn()};
    await expect(requestHumanApproval({supabase,userId:'u1',workflowKey:'wf-1',boundary:'project:p-1',expectedVersion:4,action:{id:'a',type:'site_navigate',capability:'site_navigate',target:'home',input:{},risk:'low',requires_confirmation:true,status:'ready'},idempotencyKey:'approval-002'})).rejects.toThrow('HUMAN_APPROVAL_RISK_NOT_ELIGIBLE');
    await expect(requestHumanApproval({supabase,userId:'u1',workflowKey:'wf-1',boundary:'project:p-1',expectedVersion:4,action:{id:'a',type:'form_submit',capability:'form_submit',target:'x',input:{},risk:'high',requires_confirmation:false,status:'ready'},idempotencyKey:'approval-003'})).rejects.toThrow('HUMAN_APPROVAL_CONFIRMATION_REQUIRED');
  });
  test('decision is pending-only, reviewer-bound and never authorizes execution',async()=>{
    const dq=query({data:{id:'a1',workflow_key:'wf-1',boundary:'project:p-1',workflow_version:4,action_id:'act-1',action_type:'form_submit',action_target:'funding',action_fingerprint:'a'.repeat(64),risk:'critical',status:'approved',reviewed_by:'admin-1'},error:null});
    const out=await decideHumanApproval({supabase:{from:jest.fn(()=>dq.q)},approvalId:'a1',reviewerUserId:'admin-1',decision:'approved',note:'Reviewed'});
    expect(dq.state.eq).toContainEqual(['status','pending']);expect(dq.state.update).toEqual(expect.objectContaining({status:'approved',reviewed_by:'admin-1'}));expect(out.execution_authorized).toBe(false);
  });
  test('admin queue defaults to pending',async()=>{const q0=query({data:[],error:null});await listHumanApprovalQueue({supabase:{from:jest.fn(()=>q0.q)}});expect(q0.state.eq).toContainEqual(['status','pending']);});
});
