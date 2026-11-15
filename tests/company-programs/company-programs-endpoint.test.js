/** @jest-environment node */
'use strict';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
jest.mock('../../lib/api/auth-helper',()=>({verifyBearer:jest.fn()}));
const {createClient}=require('@supabase/supabase-js');
const {verifyBearer}=require('../../lib/api/auth-helper');
const handler=require('../../api/company-programs');
const WS='11111111-1111-4111-8111-111111111111';
const USER='22222222-2222-4222-8222-222222222222';
function res(){
 const r={headers:{},statusCode:200,body:null};
 r.setHeader=(k,v)=>{r.headers[k]=v;return r;};
 r.status=c=>{r.statusCode=c;return r;};
 r.json=b=>{r.body=b;return r;};
 return r;
}
function qb(value,error=null,kind='single'){
 const chain={select:jest.fn(()=>chain),eq:jest.fn(()=>chain),maybeSingle:jest.fn(async()=>({data:value,error}))};
 if(kind==='list')chain.eq=jest.fn(()=>Promise.resolve({data:value,error}));
 return chain;
}
const oldEnv={...process.env};
beforeEach(()=>{
 jest.clearAllMocks();
 process.env.SUPABASE_SERVICE_ROLE_KEY='mock-service-key';
 process.env.SUPABASE_URL='https://project.supabase.co';
 verifyBearer.mockResolvedValue({id:USER});
});
afterAll(()=>{process.env=oldEnv;});
test('GET owner sees eleven products, not operational-ready claims',async()=>{
 const owner=qb({id:WS,name:'Company A'});
 const entitled=qb([{program_key:'crm',status:'active',valid_from:'2020-01-01T00:00:00Z',valid_until:null,seats:3,branches:1}],null,'list');
 const from=jest.fn(table=>table==='crm_app_workspaces'?owner:entitled);
 createClient.mockReturnValue({from});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(200);
 expect(response.body.workspace.role).toBe('owner');
 expect(response.body.programs).toHaveLength(11);
 expect(response.body.programs.find(p=>p.key==='crm').entitled).toBe(true);
 expect(response.body.programs.find(p=>p.key==='hr').entitled).toBe(false);
 expect(response.body.runtimeIntegration).toBe('not_verified');
 expect(owner.eq).toHaveBeenCalledWith('owner_user_id',USER);
});
test('unauthenticated caller is denied before workspace lookup',async()=>{
 verifyBearer.mockRejectedValue(new Error('invalid'));
 createClient.mockReturnValue({from:jest.fn()});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(401);
 expect(response.body.error).toBe('AUTH_REQUIRED');
});
test('cross-workspace nonmember is rejected',async()=>{
 const owner=qb(null);
 const member=qb(null);
 const from=jest.fn(table=>{
  if(table==='crm_app_workspaces')return owner;
  if(table==='crm_app_members')return member;
  throw new Error('entitlements must not be queried for nonmember');
 });
 createClient.mockReturnValue({from});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(404);
 expect(from).not.toHaveBeenCalledWith('company_program_entitlements');
 expect(member.eq).toHaveBeenCalledWith('active',true);
});
test('invalid workspace ID and writes are denied',async()=>{
 const response=res();
 await handler({method:'POST',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(405);
 const invalid=res();
 await handler({method:'GET',query:{workspace_id:'not-an-id'}},invalid);
 expect(invalid.statusCode).toBe(400);
});
