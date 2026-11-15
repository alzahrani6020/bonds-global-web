'use strict';
const { verifyBearer } = require('../lib/api/auth-helper');
const { PROGRAMS, isActiveEntitlement } = require('../lib/company-programs/catalog');
const { createClient } = require('@supabase/supabase-js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function respond(res,code,body) {
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Vary','Authorization');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(code).json(body);
}
function privilegedDb() {
  const url=process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
/** Read-only access inventory; NEVER activates or grants a program. */
module.exports=async function companyPrograms(req,res) {
  if(req.method!=='GET') return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
  const workspaceId=String(req.query?.workspace_id||'').trim();
  if(!UUID.test(workspaceId)) return respond(res,400,{error:'WORKSPACE_ID_REQUIRED'});
  const sb=privilegedDb();
  if(!sb)return respond(res,503,{error:'SERVER_AUTH_UNAVAILABLE'});
  let user;
  try { user=await verifyBearer(req); } catch { return respond(res,401,{error:'AUTH_REQUIRED'}); }
  try {
    // Explicit authenticated user membership, not tenant header, UI role, or
    // a caller-provided owner ID. Inactive members never qualify.
    const {data:owned,error:ownerError}=await sb.from('crm_app_workspaces')
      .select('id,name').eq('id',workspaceId).eq('owner_user_id',user.id).maybeSingle();
    if(ownerError)throw ownerError;
    let membershipRole=owned?'owner':null, name=owned?.name;
    if(!owned){
      const {data:member,error:memberError}=await sb.from('crm_app_members')
        .select('role').eq('workspace_id',workspaceId).eq('member_user_id',user.id)
        .eq('active',true).maybeSingle();
      if(memberError)throw memberError;
      if(!member)return respond(res,404,{error:'WORKSPACE_NOT_FOUND'});
      const {data:ws,error:wsError}=await sb.from('crm_app_workspaces')
        .select('id,name').eq('id',workspaceId).maybeSingle();
      if(wsError)throw wsError;
      if(!ws)return respond(res,404,{error:'WORKSPACE_NOT_FOUND'});
      membershipRole=member.role; name=ws.name;
    }
    const {data:rows,error:entError}=await sb.from('company_program_entitlements')
      .select('program_key,status,valid_from,valid_until,seats,branches')
      .eq('workspace_id',workspaceId);
    if(entError){
      // Missing migration or permission issue is NOT an empty subscription.
      console.error('[company-programs] entitlements unavailable:',entError.code||'ERROR');
      return respond(res,503,{error:'ENTITLEMENTS_UNAVAILABLE'});
    }
    const byKey=new Map((rows||[]).map(item=>[item.program_key,item]));
    return respond(res,200,{
      workspace:{id:workspaceId,name,role:membershipRole},
      programs:PROGRAMS.map(program=>{
        const item=byKey.get(program.key);
        return {
          key:program.key,nameAr:program.nameAr,nameEn:program.nameEn,
          entitlement: item ? item.status : 'not_subscribed',
          entitled:Boolean(item&&isActiveEntitlement(item)),
          seats:item?.seats??null,branches:item?.branches??null
        };
      }),
      // A commercial entitlement is NOT an operational readiness claim.
      runtimeIntegration:'not_verified'
    });
  }catch(error){
    console.error('[company-programs] request failed:',error?.code||'INTERNAL');
    return respond(res,500,{error:'COMPANY_PROGRAMS_UNAVAILABLE'});
  }
};
