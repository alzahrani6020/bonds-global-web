'use strict';
const { verifyBearer } = require('./auth-helper');
const { PROGRAMS, isActiveEntitlement } = require('../company-programs/catalog');
const { evaluateMakkinBridgeReadiness } = require('../company-programs/makkin-bridge-policy');
const { signMakkinMappingProof } = require('../company-programs/makkin-mapping-proof');
const { createClient } = require('@supabase/supabase-js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
 if(!['GET','POST'].includes(req.method))return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(req.method==='POST' && req.query?.action!=='probe-mapping')return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
 const params=req.method==='POST'?req.body:req.query;
 const workspaceId=String(params?.workspace_id||'').trim();
 const workspaceType=String(params?.workspace_type||'crm').trim();
 if(!UUID.test(workspaceId)||!['crm','company'].includes(workspaceType))
  return respond(res,400,{error:'WORKSPACE_REQUIRED'});
 const action=req.method==='POST'?'probe-mapping':String(req.query?.action||'inventory');
 if(!['inventory','integration-status','probe-mapping'].includes(action))return respond(res,400,{error:'UNSUPPORTED_ACTION'});
 const requestedProgram=String(params?.program_key||'');
 if(action!=='inventory'&&!PROGRAMS.some(p=>p.key===requestedProgram))
   return respond(res,400,{error:'PROGRAM_KEY_REQUIRED'});
 const sb=privilegedDb();
 if(!sb)return respond(res,503,{error:'SERVER_AUTH_UNAVAILABLE'});
 let user;
 try{user=await verifyBearer(req);}catch{return respond(res,401,{error:'AUTH_REQUIRED'});}
 try{
  const access=await accessToSourceWorkspace(sb,user,workspaceType,workspaceId);
  if(!access)return respond(res,404,{error:'WORKSPACE_NOT_FOUND'});
  if(action==='probe-mapping' && (!user.email || !user.email_confirmed_at))
    return respond(res,403,{error:'VERIFIED_EMAIL_REQUIRED'});
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
  if(action==='probe-mapping'){
    // Any authenticated, active workspace member may prove ONLY their own
    // pre-provisioned SCC identity. This action never grants a subscription.
    if(!access.role)return respond(res,403,{error:'WORKSPACE_ROLE_REQUIRED'});
    if(!link || !isActiveEntitlement(byKey.get(requestedProgram)))
      return respond(res,403,{error:'PROGRAM_ENTITLEMENT_REQUIRED'});
    const {data:tenantLink,error:tenantError}=await sb.from('company_program_makkin_links')
      .select('workspace_link_id,makkin_tenant_id,state').eq('workspace_link_id',link.id).maybeSingle();
    if(tenantError)throw tenantError;
    const {data:userLink,error:userError}=await sb.from('company_program_makkin_user_links')
      .select('workspace_link_id,bonds_user_id,makkin_user_id,state')
      .eq('workspace_link_id',link.id).eq('bonds_user_id',user.id).maybeSingle();
    if(userError)throw userError;
    if(!tenantLink || !userLink || tenantLink.state==='suspended' ||
       userLink.state==='suspended' || userLink.bonds_user_id!==user.id)
      return respond(res,404,{error:'MAPPING_NOT_AVAILABLE'});
    const privateKey=process.env.BONDS_MAKKIN_SIGNING_PRIVATE_KEY_PEM;
    const endpoint=process.env.MAKKIN_MAPPING_VERIFY_URL;
    if(!privateKey || !endpoint)return respond(res,503,{error:'MAPPING_PROBE_NOT_CONFIGURED'});
    let target;
    try{
      target=new URL(endpoint);
      if(target.protocol!=='https:' || target.hostname!=='scc380-api.onrender.com' || target.port ||
         target.username || target.password || target.search ||
         target.hash || target.pathname!=='/integrations/bonds/verify-mapping')
        throw new Error('Invalid proof endpoint');
    }catch{return respond(res,503,{error:'MAPPING_PROBE_NOT_CONFIGURED'});}
    let assertion;
    try{
      assertion=signMakkinMappingProof({
        workspaceLinkId:link.id,bondsUserId:user.id,
        makkinTenantId:tenantLink.makkin_tenant_id,
        makkinUserId:userLink.makkin_user_id,
        programKey:requestedProgram,email:user.email,emailConfirmed:true
      },privateKey);
    }catch{return respond(res,503,{error:'MAPPING_PROBE_NOT_CONFIGURED'});}
    try{
      const remote=await fetch(target.toString(),{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({assertion}),redirect:'error',signal:AbortSignal.timeout(5000)
      });
      if(!remote.ok)return respond(res,502,{error:'MAPPING_PROBE_FAILED'});
      const proof=await remote.json();
      if(typeof proof?.matched!=='boolean')return respond(res,502,{error:'MAPPING_PROBE_FAILED'});
      return respond(res,200,{
        workspace:{id:workspaceId,source:workspaceType},
        program_key:requestedProgram,
        matched:proof.matched,operationalReady:false,runtimeIntegration:'not_verified'
      });
    }catch{return respond(res,502,{error:'MAPPING_PROBE_FAILED'});}
  }
  if(action==='integration-status'){
    // Connection readiness, not a login or Makkin API authorization.
    // Never expose the external tenant/user IDs to the browser.
    let tenantLink=null,userLink=null;
    if(link && isActiveEntitlement(byKey.get(requestedProgram))){
      const {data:tenant,error:tenantError}=await sb.from('company_program_makkin_links')
        .select('workspace_link_id,state,verified_at,verified_by,makkin_tenant_id')
        .eq('workspace_link_id',link.id).maybeSingle();
      if(tenantError)throw tenantError;
      tenantLink=tenant;
      if(tenantLink?.state==='verified'){
        const {data:member,error:memberError}=await sb.from('company_program_makkin_user_links')
          .select('workspace_link_id,bonds_user_id,state,verified_at,verified_by,makkin_user_id')
          .eq('workspace_link_id',link.id).eq('bonds_user_id',user.id).maybeSingle();
        if(memberError)throw memberError;
        userLink=member;
      }
    }
    const readiness=evaluateMakkinBridgeReadiness({
      entitlement:byKey.get(requestedProgram),tenantLink,userLink,
      workspaceLinkId:link?.id,bondsUserId:user.id
    });
    return respond(res,200,{
      workspace:{id:workspaceId,source:workspaceType},program_key:requestedProgram,
      mappingReady:readiness.eligible,mappingStatus:readiness.reason,
      operationalReady:false,
      runtimeIntegration:'not_verified'
    });
  }
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
