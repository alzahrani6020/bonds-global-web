/** @jest-environment node */

const mockGetUser=jest.fn();
const mockRoleMaybeSingle=jest.fn();

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient:()=>({
    auth:{ getUser:mockGetUser },
    from:()=>({
      select:()=>({
        eq:()=>({
          maybeSingle:mockRoleMaybeSingle
        })
      })
    })
  })
}));

const {
  getBearerAdmin,
  getBearerAgentInboxUser
} = require('../../v3/lib/admin-access');

function req(){
  return { headers:{ authorization:'Bearer token-1' } };
}

describe('Agent Inbox scoped admin access',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data:{ user:{ id:'support-1', email:'support@example.com' } },
      error:null
    });
    mockRoleMaybeSingle.mockResolvedValue({
      data:{ role:'support' },
      error:null
    });
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
  });

  test('support can access Agent Inbox scope', async()=>{
    const access=await getBearerAgentInboxUser(req());
    expect(access).toMatchObject({
      role:'support',
      source:'bearer',
      user:{ id:'support-1' }
    });
  });

  test('support is not promoted into general v3 admin access', async()=>{
    const access=await getBearerAdmin(req());
    expect(access).toBeNull();
  });
});
