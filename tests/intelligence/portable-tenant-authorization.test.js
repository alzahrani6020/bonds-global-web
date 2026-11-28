'use strict';
const {createTenantAuthorizer}=require('../../lib/portable-intelligence/tenant-authorization');
const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
describe('portable trusted tenant authorization',()=>{
 const memberships=new Map([['alice:'+A,{actor_id:'alice',workspace_id:A,role:'reviewer',active:true}],['bob:'+B,{actor_id:'bob',workspace_id:B,role:'owner',active:true}],['carol:'+A,{actor_id:'carol',workspace_id:A,role:'viewer',active:false}]]);
 const getMembership=jest.fn(async({workspaceId,actorId})=>memberships.get(actorId+':'+workspaceId)||null);
 const authorize=createTenantAuthorizer({getMembership});
 test('same tenant reviewer can review but cannot export',async()=>{
  await expect(authorize({workspaceId:A,actorId:'alice',action:'import.reviewed'})).resolves.toBe(true);
  await expect(authorize({workspaceId:A,actorId:'alice',action:'crm.export'})).resolves.toBe(false);
 });
 test('cross-company and inactive memberships deny',async()=>{
  await expect(authorize({workspaceId:B,actorId:'alice',action:'records.read'})).resolves.toBe(false);
  await expect(authorize({workspaceId:A,actorId:'carol',action:'records.read'})).resolves.toBe(false);
 });
 test('unknown actions fail closed even for owner',async()=>{
  await expect(authorize({workspaceId:B,actorId:'bob',action:'mail.send'})).resolves.toBe(false);
  await expect(authorize({workspaceId:B,actorId:'bob',action:'hr.directory.export'})).resolves.toBe(true);
 });
 test('identity and workspace required; spoofed supplied role cannot grant access',async()=>{
  await expect(authorize({workspaceId:A,actorId:'unknown',action:'records.read',role:'owner'})).resolves.toBe(false);
  await expect(authorize({workspaceId:'wrong',actorId:'alice',action:'records.read'})).rejects.toThrow('INVALID_AUTH_CONTEXT');
 });
 test('requires trusted membership resolver',()=>expect(()=>createTenantAuthorizer()).toThrow('TRUSTED_MEMBERSHIP_PROVIDER_REQUIRED'));
});
