/** @jest-environment node */
const {EventEmitter}=require('events');
const mockAccess=jest.fn(),mockList=jest.fn(),mockDecide=jest.fn();
jest.mock('../../v3/lib/admin-access',()=>({requireAdminAccess:jest.fn(),requireAgentInboxAccess:jest.fn(),requireHumanApprovalAccess:(req)=>mockAccess(req)}));
jest.mock('../../lib/assistant/human-approval',()=>({listHumanApprovalQueue:(args)=>mockList(args),decideHumanApproval:(args)=>mockDecide(args)}));
jest.mock('../../v3/lib/supabase',()=>({getSupabaseClient:()=>({from:jest.fn()})}));
const {adminRouter}=require('../../v3/api/admin');
function req(method='GET',url='/api/v3/admin/human-approvals',body=null){const r=new EventEmitter();r.method=method;r.url=url;r.headers={host:'localhost'};process.nextTick(()=>{if(body!==null)r.emit('data',Buffer.from(JSON.stringify(body)));r.emit('end');});return r;}
function res(done){return{statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){done({statusCode:this.statusCode,body:v?JSON.parse(v):null});}};}
const call=(path,r)=>new Promise(resolve=>adminRouter(r,res(resolve),path));
describe('Human Approval admin API',()=>{
  beforeEach(()=>{jest.clearAllMocks();mockAccess.mockResolvedValue({user:{id:'admin-1'},role:'admin',source:'bearer'});mockList.mockResolvedValue({version:1,items:[],policy:{execution_authorized:false}});});
  test('lists pending approvals for attributed admin',async()=>{const out=await call('/admin/human-approvals',req());expect(out.statusCode).toBe(200);expect(out.body.role).toBe('admin');});
  test('decision records reviewer identity and remains non-executing',async()=>{mockDecide.mockResolvedValue({approval:{id:'a1',status:'approved'},reviewer_user_id:'admin-1',execution_authorized:false});const out=await call('/admin/human-approvals/a1/decision',req('POST','/api/v3/admin/human-approvals/a1/decision',{decision:'approved',note:'ok'}));expect(out.statusCode).toBe(200);expect(mockDecide).toHaveBeenCalledWith(expect.objectContaining({approvalId:'a1',reviewerUserId:'admin-1',decision:'approved'}));expect(out.body.execution_authorized).toBe(false);});
  test('denies missing bearer approval identity',async()=>{mockAccess.mockResolvedValue(null);const out=await call('/admin/human-approvals',req());expect(out.statusCode).toBe(401);expect(mockList).not.toHaveBeenCalled();});
});
