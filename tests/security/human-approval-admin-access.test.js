/** @jest-environment node */
const mockGetUser=jest.fn(),mockMaybeSingle=jest.fn();
jest.mock('../../v3/lib/supabase',()=>({getSupabaseClient:()=>({auth:{getUser:mockGetUser},from:()=>({select(){return this;},eq(){return this;},maybeSingle:mockMaybeSingle})})}));
const {requireHumanApprovalAccess}=require('../../v3/lib/admin-access');
describe('Human Approval admin access',()=>{
  beforeEach(()=>{jest.clearAllMocks();delete process.env.ADMIN_EMAILS;delete process.env.ADMIN_EMAIL;process.env.ADMIN_TOKEN='legacy';});
  test('rejects legacy static token because reviewer identity is required',async()=>{const out=await requireHumanApprovalAccess({headers:{'x-admin-token':'legacy'}});expect(out).toBeNull();});
  test('rejects support role',async()=>{mockGetUser.mockResolvedValue({data:{user:{id:'s1',email:'support@example.com'}},error:null});mockMaybeSingle.mockResolvedValue({data:{role:'support'},error:null});const out=await requireHumanApprovalAccess({headers:{authorization:'Bearer token'}});expect(out).toBeNull();});
  test('accepts admin bearer role',async()=>{mockGetUser.mockResolvedValue({data:{user:{id:'a1',email:'admin@example.com'}},error:null});mockMaybeSingle.mockResolvedValue({data:{role:'admin'},error:null});const out=await requireHumanApprovalAccess({headers:{authorization:'Bearer token'}});expect(out).toMatchObject({role:'admin',source:'bearer'});});
});
