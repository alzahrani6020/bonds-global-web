/** @jest-environment node */

jest.mock('../../v3/lib/supabase',()=>({getSupabaseClient:jest.fn()}));
const {getSupabaseClient}=require('../../v3/lib/supabase');
const {requireAssistantKillSwitchAccess}=require('../../v3/lib/admin-access');

function request(authorization='',staticToken=''){
  return {headers:{authorization,'x-admin-token':staticToken}};
}
function client({user=null,role=null}={}){
  return {
    auth:{getUser:jest.fn().mockResolvedValue({data:{user},error:null})},
    from:jest.fn(()=>({
      select(){return this;},
      eq(){return this;},
      maybeSingle:jest.fn().mockResolvedValue({data:role?{role}:null,error:null})
    }))
  };
}

describe('Assistant kill switch admin access',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    process.env.ADMIN_TOKEN='legacy-secret';
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
  });

  test('legacy static token cannot control emergency switch',async()=>{
    getSupabaseClient.mockReturnValue(client());
    await expect(requireAssistantKillSwitchAccess(request('','legacy-secret'))).resolves.toBeNull();
  });

  test('support cannot control emergency switch',async()=>{
    getSupabaseClient.mockReturnValue(client({user:{id:'s1',email:'s@example.com'},role:'support'}));
    await expect(requireAssistantKillSwitchAccess(request('Bearer token'))).resolves.toBeNull();
  });

  test('attributable admin bearer can control emergency switch',async()=>{
    getSupabaseClient.mockReturnValue(client({user:{id:'a1',email:'a@example.com'},role:'admin'}));
    const access=await requireAssistantKillSwitchAccess(request('Bearer token'));
    expect(access).toEqual(expect.objectContaining({role:'admin',source:'bearer'}));
  });
});
