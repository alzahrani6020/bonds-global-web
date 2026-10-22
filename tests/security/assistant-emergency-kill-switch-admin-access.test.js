/** @jest-environment node */

const mockGetUser=jest.fn();
const mockMaybeSingle=jest.fn();

jest.mock('../../v3/lib/supabase',()=>({
  getSupabaseClient:()=>({
    auth:{getUser:mockGetUser},
    from:()=>({
      select(){return this;},
      eq(){return this;},
      maybeSingle:mockMaybeSingle
    })
  })
}));

const {requireAssistantKillSwitchAccess}=require('../../v3/lib/admin-access');

function req(token='bearer-token'){
  return {headers:token?{authorization:`Bearer ${token}`}:{}};
}

describe('Assistant emergency kill switch admin access',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_TOKEN;
  });

  test('owner bearer identity is accepted',async()=>{
    process.env.ADMIN_EMAILS='owner@example.com';
    mockGetUser.mockResolvedValue({data:{user:{id:'owner-1',email:'owner@example.com'}},error:null});
    const out=await requireAssistantKillSwitchAccess(req());
    expect(out).toEqual(expect.objectContaining({role:'owner',source:'bearer'}));
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  test('super_admin bearer identity is accepted',async()=>{
    mockGetUser.mockResolvedValue({data:{user:{id:'sa-1',email:'sa@example.com'}},error:null});
    mockMaybeSingle.mockResolvedValue({data:{role:'super_admin'},error:null});
    const out=await requireAssistantKillSwitchAccess(req());
    expect(out).toEqual(expect.objectContaining({role:'super_admin',source:'bearer'}));
  });

  test('admin bearer identity is rejected for critical emergency control',async()=>{
    mockGetUser.mockResolvedValue({data:{user:{id:'a-1',email:'admin@example.com'}},error:null});
    mockMaybeSingle.mockResolvedValue({data:{role:'admin'},error:null});
    await expect(requireAssistantKillSwitchAccess(req())).resolves.toBeNull();
  });

  test('legacy static admin token is never accepted',async()=>{
    process.env.ADMIN_TOKEN='legacy-secret';
    await expect(requireAssistantKillSwitchAccess({headers:{'x-admin-token':'legacy-secret'}})).resolves.toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
