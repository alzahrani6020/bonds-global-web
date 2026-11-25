/** @jest-environment node */
'use strict';
const { resolveUserGovernanceContext }=require('../../lib/capabilities/user-governance-context');
function dbFor({ role='super_admin', status='active' }={}){
 const calls=[];
 const db={
  from(table){
   calls.push(table);
   if(table==='profiles')return {select(){return {eq(){return {maybeSingle:async()=>({data:{id:'owner-1',status},error:null})}}}}};
   if(table==='admin_roles')return {select(){return {eq(){return {limit:async()=>({data:role?[{user_id:'owner-1',role}]:[],error:null})}}}}};
   throw new Error('unexpected lookup: '+table);
  },
  rpc(){throw new Error('owner must not require subscription or permission RPC');}
 };
 return {db,calls};
}
const service={governance:{permissions:['service.execute'],entitlements:['service.premium']}};
describe('verified platform owner governance',()=>{
 test('active super admin may access enabled capabilities without paid subscription records',async()=>{
  const {db,calls}=dbFor();
  const result=await resolveUserGovernanceContext({user:{id:'owner-1'},service,supabase:db});
  expect(result).toEqual({ok:true,context:{
   actor:{id:'owner-1'},userId:'owner-1',userTier:'enterprise',
   governance:{permissions:['service.execute'],entitlements:['service.premium']}
  }});
  expect(calls).toEqual(['profiles','admin_roles']);
 });
 test('disabled owner account remains denied',async()=>{
  const {db}=dbFor({status:'inactive'});
  const result=await resolveUserGovernanceContext({user:{id:'owner-1'},service,supabase:db});
  expect(result.ok).toBe(false);
  expect(result.code).toBe('USER_DISABLED');
 });
 test('ordinary user does not inherit platform owner rights',async()=>{
  const {db}=dbFor({role:'viewer'});
  const result=await resolveUserGovernanceContext({user:{id:'owner-1'},service,supabase:db});
  expect(result.ok).toBe(false);
 });
});
