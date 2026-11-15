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
 const from=jest.fn(table=>{
   if(table==='companies') return owner;
   if(table==='company_members') return member;
   throw new Error('Unexpected company-programs query: '+table);
 });
 createClient.mockReturnValue({from});
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


test('integration-status requires verified tenant+user mapping and never releases external IDs',async()=>{
 const owner=qb({id:WS,name:'Legal Company'});
 const link=qb({id:WS});
 const rows=qb([{program_key:'hr',status:'active',valid_from:'2020-01-01T00:00:00Z',valid_until:null}],null,'list');
 const tenant=qb({workspace_link_id:WS,makkin_tenant_id:'hidden-tenant',state:'verified',verified_at:'2026-01-01',verified_by:USER});
 const member=qb({workspace_link_id:WS,bonds_user_id:USER,makkin_user_id:'hidden-user',state:'verified',verified_at:'2026-01-01',verified_by:USER});
 const from=jest.fn(table=>({
   crm_app_workspaces:owner,company_program_workspaces:link,
   company_program_entitlements:rows,
   company_program_makkin_links:tenant,
   company_program_makkin_user_links:member
 })[table]||(()=>{throw Error('unexpected table '+table)})());
 createClient.mockReturnValue({from});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS,action:'integration-status',program_key:'hr'}},response);
 expect(response.statusCode).toBe(200);
 expect(response.body).toMatchObject({mappingReady:true,operationalReady:false,mappingStatus:'MAPPING_VERIFIED_NOT_OPERATIONAL'});
 expect(JSON.stringify(response.body)).not.toContain('hidden-tenant');
 expect(JSON.stringify(response.body)).not.toContain('hidden-user');
});
test('integration-status refuses paid HR when only CRM is subscribed',async()=>{
 const owner=qb({id:WS,name:'Company A'});
 const link=qb({id:WS});
 const rows=qb([{program_key:'crm',status:'active',valid_from:'2020-01-01',valid_until:null}],null,'list');
 const from=jest.fn(table=>({
  crm_app_workspaces:owner,company_program_workspaces:link,company_program_entitlements:rows
 })[table]||(()=>{throw Error('must never query Makkin mapping')})());
 createClient.mockReturnValue({from});
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS,action:'integration-status',program_key:'hr'}},response);
 expect(response.statusCode).toBe(200);
 expect(response.body).toMatchObject({mappingReady:false,operationalReady:false,mappingStatus:'ENTITLEMENT_REQUIRED'});
 expect(from).not.toHaveBeenCalledWith('company_program_makkin_links');
});
test('integration-status rejects unknown application keys before touching identity',async()=>{
 const response=res();
 await handler({method:'GET',query:{workspace_id:WS,action:'integration-status',program_key:'invented'}},response);
 expect(response.statusCode).toBe(400);
});


const { generateKeyPairSync, verify: verifySignature } = require('node:crypto');
const signingPair=generateKeyPairSync('ed25519');
const nativeFetch=global.fetch;
afterEach(()=>{global.fetch=nativeFetch;delete process.env.BONDS_MAKKIN_SIGNING_PRIVATE_KEY_PEM;delete process.env.MAKKIN_MAPPING_VERIFY_URL;});
test('owner mapping proof validates SCC identity without issuing access tokens or writing mappings',async()=>{
 const owner=qb({id:WS,name:'Company A'});
 const link=qb({id:WS});
 const entitlements=qb([{program_key:'hr',status:'active',valid_from:'2020-01-01',valid_until:null}],null,'list');
 const tenant=qb({workspace_link_id:WS,makkin_tenant_id:'private-tenant',state:'pending'});
 const mapped=qb({workspace_link_id:WS,bonds_user_id:USER,makkin_user_id:'private-user',state:'pending'});
 const from=jest.fn(table=>({
  crm_app_workspaces:owner,company_program_workspaces:link,
  company_program_entitlements:entitlements,
  company_program_makkin_links:tenant,company_program_makkin_user_links:mapped
 })[table]||(()=>{throw Error('unexpected '+table)})());
 createClient.mockReturnValue({from});
 verifyBearer.mockResolvedValue({id:USER,email:'owner@example.org',email_confirmed_at:'2026-11-01T00:00:00Z'});
 process.env.BONDS_MAKKIN_SIGNING_PRIVATE_KEY_PEM=signingPair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
 process.env.MAKKIN_MAPPING_VERIFY_URL='https://scc380-api.onrender.com/integrations/bonds/verify-mapping';
 global.fetch=jest.fn(async(_url,options)=>{
  const {assertion}=JSON.parse(options.body);
  const [payload,signature]=assertion.split('.');
  expect(verifySignature(null,Buffer.from(payload),signingPair.publicKey,Buffer.from(signature,'base64url'))).toBe(true);
  const decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  expect(decoded).toMatchObject({tenantId:'private-tenant',userId:'private-user',programKey:'hr'});
  return {ok:true,json:async()=>({matched:true,operationalReady:false})};
 });
 const response=res();
 await handler({method:'POST',query:{action:'probe-mapping'},body:{workspace_id:WS,program_key:'hr'}},response);
 expect(response.statusCode).toBe(200);
 expect(response.body).toMatchObject({matched:true,operationalReady:false});
 expect(JSON.stringify(response.body)).not.toContain('private-tenant');
 expect(JSON.stringify(response.body)).not.toContain('private-user');
});
test('unverified BONDS email blocks remote proof before any network call',async()=>{
 createClient.mockReturnValue({from:table=>table==='crm_app_workspaces'?qb({id:WS,name:'Company A'}):(()=>{throw Error('unexpected lookup')})()});
 verifyBearer.mockResolvedValue({id:USER,email:'owner@example.org',email_confirmed_at:null});
 global.fetch=jest.fn();
 const response=res();
 await handler({method:'POST',query:{action:'probe-mapping'},body:{workspace_id:WS,program_key:'hr'}},response);
 expect(response.statusCode).toBe(403);
 expect(global.fetch).not.toHaveBeenCalled();
});
test('non-owner cannot probe an SCC identity even with an entitlement',async()=>{
 const owner=qb(null);
 const member=qb({role:'member'});
 const workspace=qb({id:WS,name:'A'});
 let workspaceQueries=0;
 createClient.mockReturnValue({from:table=>{
  if(table==='crm_app_workspaces')return workspaceQueries++===0?owner:workspace;
  if(table==='crm_app_members')return member;
  if(table==='company_program_workspaces')return qb({id:WS});
  if(table==='company_program_entitlements')return qb([],null,'list');
  throw Error('unexpected '+table);
 }});
 verifyBearer.mockResolvedValue({id:USER,email:'member@example.org',email_confirmed_at:'2026-11-01'});
 const response=res();
 await handler({method:'POST',query:{action:'probe-mapping'},body:{workspace_id:WS,program_key:'hr'}},response);
 expect(response.statusCode).toBe(403);
});
