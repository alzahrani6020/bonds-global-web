/** @jest-environment node */
'use strict';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
jest.mock('../../lib/api/auth-helper',()=>({verifyBearer:jest.fn()}));
const {createClient}=require('@supabase/supabase-js');
const {verifyBearer}=require('../../lib/api/auth-helper');
const handler=require('../../lib/api/company-programs');
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
const originalEnv={...process.env};
beforeEach(()=>{
 jest.clearAllMocks();
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-dummy';
 process.env.SUPABASE_URL='https://unit-test.supabase.co';
 verifyBearer.mockResolvedValue({id:USER});
});
afterAll(()=>{process.env=originalEnv;});
test('CRM owner sees eleven programs and only explicit active grant',async()=>{
 const owner=qb({id:WS,name:'Company A'});
 const link=qb({id:WS});
 const grants=qb([{program_key:'crm',status:'active',valid_from:'2020-01-01T00:00:00Z',valid_until:null,seats:3,branches:1}],null,'list');
 const from=jest.fn(table=>({
  crm_app_workspaces:owner,company_program_workspaces:link,
  company_program_entitlements:grants
 })[table]||(()=>{throw Error('unexpected table '+table)})());
 createClient.mockReturnValue({from});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(200);
 expect(response.body.workspace).toMatchObject({source:'crm',role:'owner'});
 expect(response.body.programs).toHaveLength(11);
 expect(response.body.programs.find(p=>p.key==='crm').entitled).toBe(true);
 expect(response.body.programs.find(p=>p.key==='hr').entitled).toBe(false);
 expect(response.body.runtimeIntegration).toBe('not_verified');
 expect(owner.eq).toHaveBeenCalledWith('owner_user_id',USER);
 expect(link.eq).toHaveBeenCalledWith('kind','crm');
});
test('real BONDS company owner uses companies, NOT CRM, for identity',async()=>{
 const ownedCompany=qb({id:WS,name:'Legal Company'});
 const link=qb(null);
 const from=jest.fn(table=>({
   companies:ownedCompany,company_program_workspaces:link
 })[table]||(()=>{throw Error('unexpected table '+table)})());
 createClient.mockReturnValue({from});
 const response=res();
 await handler({method:'GET',query:{workspace_type:'company',workspace_id:WS}},response);
 expect(response.statusCode).toBe(200);
 expect(response.body.workspace.source).toBe('company');
 expect(response.body.programs.every(p=>p.entitled===false)).toBe(true);
 expect(ownedCompany.eq).toHaveBeenCalledWith('is_active',true);
 expect(from).not.toHaveBeenCalledWith('crm_app_workspaces');
});
test('unauthenticated caller is denied',async()=>{
 verifyBearer.mockRejectedValue(new Error('invalid'));
 createClient.mockReturnValue({from:jest.fn()});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(401);
});
test('cross-workspace nonmember is rejected before entitlements',async()=>{
 const owner=qb(null);
 const member=qb(null);
 const from=jest.fn(table=>{
  if(table==='crm_app_workspaces')return owner;
  if(table==='crm_app_members')return member;
  throw new Error('must not inspect tenant links');
 });
 createClient.mockReturnValue({from});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(404);
 expect(from).not.toHaveBeenCalledWith('company_program_workspaces');
 expect(member.eq).toHaveBeenCalledWith('active',true);
});
test('inactive BONDS company and nonmember are denied',async()=>{
 const owner=qb(null),member=qb(null);
 createClient.mockReturnValue({from:table=>({
   companies:owner,company_members:member
 })[table]||(()=>{throw Error('no access')})())});
 const response=res();
 await handler({method:'GET',query:{workspace_type:'company',workspace_id:WS}},response);
 expect(response.statusCode).toBe(404);
});
test('denies writes and invalid workspace source',async()=>{
 const response=res();
 await handler({method:'POST',query:{workspace_id:WS}},response);
 expect(response.statusCode).toBe(405);
 const invalid=res();
 await handler({method:'GET',query:{workspace_type:'unknown',workspace_id:WS}},invalid);
 expect(invalid.statusCode).toBe(400);
});
