'use strict';
const { verifyBearer } = require('./auth-helper');
const { PROGRAMS, isActiveEntitlement } = require('../company-programs/catalog');
const { createClient } = require('@supabase/supabase-js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function respond(res,code,body){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('Vary','Authorization');
 res.setHeader('X-Content-Type-Options','nosniff');
 return res.status(code).json(body);
}
function privilegedDb(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function accessToSourceWorkspace(sb,user,source,id){
 if(source==='crm'){
  const {data:owned,error:ownerError}=await sb.from('crm_app_workspaces')
   .select('id,name').eq('id',id).eq('owner_user_id',user.id).maybeSingle();
  if(ownerError)throw ownerError;
  if(owned)return {name:owned.name,role:'owner'};
  const {data:member,error:memberError}=await sb.from('crm_app_members')
   .select('role').eq('workspace_id',id).eq('member_user_id',user.id)
   .eq('active',true).maybeSingle();
  if(memberError)throw memberError;
  if(!member)return null;
  const {data:workspace,error:wsError}=await sb.from('crm_app_workspaces')
   .select('id,name').eq('id',id).maybeSingle();
  if(wsError)throw wsError;
  return workspace?{name:workspace.name,role:member.role}:null;
 }
 const {data:owned,error:ownerError}=await sb.from('companies')
  .select('id,name').eq('id',id).eq('owner_user_id',user.id)
  .eq('is_active',true).maybeSingle();
 if(ownerError)throw ownerError;
 if(owned)return {name:owned.name,role:'owner'};
 const {data:member,error:memberError}=await sb.from('company_members')
  .select('role').eq('company_id',id).eq('user_id',user.id).maybeSingle();
 if(memberError)throw memberError;
 if(!member)return null;
 const {data:company,error:companyError}=await sb.from('companies')
  .select('id,name').eq('id',id).eq('is_active',true).maybeSingle();
 if(companyError)throw companyError;
 return company?{name:company.name,role:member.role}:null;
}
/** Read-only access inventory; DOES NOT ACTIVATE PRODUCTS OR PROXY MAKKIN. */
module.exports=async function companyPrograms(req,res){
 if(req.method!=='GET')return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
 const workspaceId=String(req.query?.workspace_id||'').trim();
 const workspaceType=String(req.query?.workspace_type||'crm').trim();
 if(!UUID.test(workspaceId)||!['crm','company'].includes(workspaceType))
  return respond(res,400,{error:'WORKSPACE_REQUIRED'});
 const sb=privilegedDb();
 if(!sb)return respond(res,503,{error:'SERVER_AUTH_UNAVAILABLE'});
 let user;
 try{user=await verifyBearer(req);}catch{return respond(res,401,{error:'AUTH_REQUIRED'});}
 try{
  const access=await accessToSourceWorkspace(sb,user,workspaceType,workspaceId);
  if(!access)return respond(res,404,{error:'WORKSPACE_NOT_FOUND'});
  const field=workspaceType==='crm'?'crm_workspace_id':'company_id';
  const {data:link,error:linkError}=await sb.from('company_program_workspaces')
   .select('id').eq('kind',workspaceType).eq(field,workspaceId).maybeSingle();
  if(linkError)throw linkError;
  let rows=[];
  if(link){
   const {data,error}=await sb.from('company_program_entitlements')
    .select('program_key,status,valid_from,valid_until,seats,branches')
    .eq('workspace_link_id',link.id);
   if(error)throw error;
   rows=data||[];
  }
  const byKey=new Map(rows.map(row=>[row.program_key,row]));
  return respond(res,200,{
   workspace:{id:workspaceId,source:workspaceType,name:access.name,role:access.role},
   programs:PROGRAMS.map(p=>{
    const row=byKey.get(p.key);
    return {key:p.key,nameAr:p.nameAr,nameEn:p.nameEn,
      entitlement:row?row.status:'not_subscribed',
      entitled:Boolean(row&&isActiveEntitlement(row)),
      seats:row?.seats??null,branches:row?.branches??null};
   }),
   runtimeIntegration:'not_verified'
  });
 }catch(error){
  console.error('[company-programs] inventory query unavailable:',error?.code||'ERROR');
  // Fail closed: schema or permission errors are not treated as empty grants.
  return respond(res,503,{error:'ENTITLEMENTS_UNAVAILABLE'});
 }
};
