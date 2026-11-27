'use strict';
const {randomUUID}=require('node:crypto');
const {validateWorkspaceContext}=require('../../lib/api/correspondence');
function client(workspace,owner,member=null){
 const lookups=[];
 const sb={from(table){
  const query={
   eq(name,value){lookups.push({table,name,value});return query;},
   maybeSingle:async()=>{
    if(table==='crm_app_workspaces')return {data:{id:workspace,owner_user_id:owner},error:null};
    if(table==='crm_app_members')return {data:member?{role:member}:null,error:null};
    return {data:null,error:new Error('UNEXPECTED_TABLE')};
   }
  };return {select(){return query;}};
 }};
 return {sb,lookups};
}
describe('Official correspondence campaign workspace security',()=>{
 const workspace=randomUUID(),owner=randomUUID();
 test('owner may create a workspace-bound official letter without creating memberships',async()=>{
  const mock=client(workspace,owner);
  const result=await validateWorkspaceContext(mock.sb,{workspace:'correspondence',campaign_workspace_id:workspace},{id:owner});
  expect(result.context.campaign_workspace_id).toBe(workspace);
  expect(result.companyId).toBe(null);
  expect(mock.lookups.some(l=>l.table==='crm_app_members')).toBe(false);
 });
 test('active member with appropriate role can bind only to permitted workspace',async()=>{
  const mock=client(workspace,owner,'manager');
  const result=await validateWorkspaceContext(mock.sb,{campaign_workspace_id:workspace},{id:randomUUID()});
  expect(result.context.campaign_workspace_id).toBe(workspace);
  expect(mock.lookups.some(l=>l.name==='active'&&l.value===true)).toBe(true);
 });
 test('non-member cannot forge campaign workspace context even with platform role',async()=>{
  const mock=client(workspace,owner);
  await expect(validateWorkspaceContext(mock.sb,{campaign_workspace_id:workspace},{id:randomUUID()},'super_admin'))
    .rejects.toThrow('campaign_workspace_id');
 });
 test('invalid UUID is rejected before database lookup',async()=>{
  const mock=client(workspace,owner);
  await expect(validateWorkspaceContext(mock.sb,{campaign_workspace_id:'bad-value'},{id:owner})).rejects.toThrow('Invalid workspace context identifier');
  expect(mock.lookups).toHaveLength(0);
 });
 test('prior governed correspondence context is still readable unchanged',async()=>{
  const mock=client(workspace,owner);
  const out=await validateWorkspaceContext(mock.sb,{workspace:'correspondence'},{id:owner});
  expect(out.context.workspace).toBe('correspondence');
  expect(mock.lookups).toHaveLength(0);
 });
});
