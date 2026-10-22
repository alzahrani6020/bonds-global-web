/** @jest-environment node */
jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));

const {EventEmitter}=require('events');
const mockRequest=jest.fn(),mockList=jest.fn(),mockAudit=jest.fn();
jest.mock('../../lib/assistant/human-approval',()=>({requestHumanApproval:(args)=>mockRequest(args),listUserHumanApprovals:(args)=>mockList(args)}));
jest.mock('../../lib/assistant/audit-trail',()=>({appendAssistantAuditBestEffort:(args)=>mockAudit(args)}));
jest.mock('../../v3/lib/supabase',()=>({getSupabaseClient:()=>({from:jest.fn()})}));
const {assistantRouter}=require('../../v3/api/assistant');
function req(method,body=null,url='/api/v3/assistant/approvals'){const r=new EventEmitter();r.method=method;r.url=url;process.nextTick(()=>{if(body!==null)r.emit('data',Buffer.from(JSON.stringify(body)));r.emit('end');});return r;}
function res(done){return{statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){done({statusCode:this.statusCode,body:v?JSON.parse(v):null});}};}
const call=(request,user={id:'u1'})=>new Promise(resolve=>assistantRouter(request,res(resolve),'/assistant/approvals',user));
describe('Human Approval user API',()=>{
  beforeEach(()=>{jest.clearAllMocks();mockList.mockResolvedValue([]);mockRequest.mockResolvedValue({approval:{id:'a1',status:'pending'},created:true,replayed:false,execution_authorized:false});});
  test('requires auth',async()=>{const out=await call(req('GET'),null);expect(out.statusCode).toBe(401);});
  test('requests exact approval without execution authority',async()=>{const action={id:'act-1',type:'form_submit',capability:'form_submit',target:'funding',input:{},risk:'high',requires_confirmation:true,status:'ready'};const out=await call(req('POST',{workflow_key:'wf-1',boundary:'project:p-1',expected_version:4,action,idempotency_key:'approval-001'}));expect(out.statusCode).toBe(200);expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({userId:'u1',workflowKey:'wf-1',action}));expect(out.body.execution_authorized).toBe(false);});
});
