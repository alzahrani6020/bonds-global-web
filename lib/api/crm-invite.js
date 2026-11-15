'use strict';
// Server-only CRM employee invitation endpoint.
// Opaque invitation tokens are emailed, never returned in the JSON response.
const {randomBytes,createHash}=require('node:crypto');
const getSupabase=require('./supabase');
const {sendEmail,getEmailConfigStatus}=require('./email');

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailRegex=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const roles=new Set(['viewer','editor','admin']);
const origin='https://bonds-global.com';

function respond(res,status,payload){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 return res.status(status).json(payload);
}

module.exports=async function crmInvite(req,res){
 if(req.method!=='POST')return respond(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return respond(res,503,{error:'CRM_SERVER_AUTH_UNAVAILABLE'});
 const mailConfig=getEmailConfigStatus();
 if(!mailConfig.hasResend&&!mailConfig.hasSmtp)return respond(res,503,{error:'CRM_EMAIL_UNAVAILABLE'});
 const authorization=String(req.headers.authorization||'');
 if(!authorization.startsWith('Bearer '))return respond(res,401,{error:'AUTH_REQUIRED'});
 let body=req.body;
 if(typeof body==='string'){
  try{body=JSON.parse(body);}catch{return respond(res,400,{error:'INVALID_JSON'});}
 }
 if(!body||typeof body!=='object'||Array.isArray(body))return respond(res,400,{error:'INVALID_BODY'});
 const workspaceId=String(body.workspace_id||'').trim();
 const email=String(body.email||'').trim().toLowerCase();
 const role=String(body.role||'').trim();
 if(!uuid.test(workspaceId)||email.length>254||!emailRegex.test(email)||!roles.has(role))
  return respond(res,400,{error:'INVALID_INVITATION'});
 try{
  const sb=getSupabase();
  const {data:{user}={},error:authError}=await sb.auth.getUser(authorization.slice(7));
  if(authError||!user)return respond(res,401,{error:'AUTH_REQUIRED'});
  const {data:owner,error:ownerError}=await sb.from('crm_app_workspaces')
    .select('id,name').eq('id',workspaceId).eq('owner_user_id',user.id).maybeSingle();
  if(ownerError)throw ownerError;
  if(!owner)return respond(res,403,{error:'OWNER_REQUIRED'});
  const {count,error:quotaError}=await sb.from('crm_app_invitations').select('id',{head:true,count:'exact'})
    .eq('workspace_id',workspaceId).gte('created_at',new Date(Date.now()-86400000).toISOString());
  if(quotaError)throw quotaError;
  if((count||0)>=30)return respond(res,429,{error:'INVITATION_DAILY_LIMIT'});
  const {data:pending,error:pendingError}=await sb.from('crm_app_invitations')
    .select('id,expires_at').eq('workspace_id',workspaceId).eq('invited_email',email).is('accepted_at',null).limit(1);
  if(pendingError)throw pendingError;
  if(pending?.length){
   if(Date.parse(pending[0].expires_at)>Date.now())
    return respond(res,409,{error:'INVITATION_ALREADY_PENDING'});
   // Only an owner-authorized request can clear an expired pending invitation.
   // This never touches a membership or an accepted invitation.
   const {error:expiredError}=await sb.from('crm_app_invitations').delete()
    .eq('id',pending[0].id).eq('workspace_id',workspaceId).is('accepted_at',null);
   if(expiredError)throw expiredError;
  }
  const secret=randomBytes(32).toString('base64url');
  const hash=createHash('sha256').update(secret).digest('hex');
  const expires=new Date(Date.now()+48*3600000).toISOString();
  const {data:row,error:insertError}=await sb.from('crm_app_invitations').insert({
   workspace_id:workspaceId,invited_by:user.id,invited_email:email,
   invited_role:role,token_hash:hash,expires_at:expires
  }).select('id').single();
  if(insertError){
   if(insertError.code==='23505')return respond(res,409,{error:'INVITATION_ALREADY_PENDING'});
   throw insertError;
  }
  const link=origin+'/my-bonds/crm/?invite='+encodeURIComponent(secret);
  const message=[
   'BONDS CRM - Company workspace invitation',
   'Company: '+owner.name,
   'Role: '+role,
   'Open this invitation link to join:',
   link,
   'Sign in or register with this exact email address, verify it, then reopen the invitation link if needed.',
   'This invitation expires in 48 hours. Never forward the invitation link.'
  ].join('\n');
  const result=await sendEmail({to:email,subject:'BONDS CRM - Company workspace invitation',text:message});
  if(result.success!==true){
   const {error:cleanupError}=await sb.from('crm_app_invitations').delete().eq('id',row.id).eq('workspace_id',workspaceId);
   if(cleanupError)return respond(res,503,{error:'INVITATION_DELIVERY_UNCERTAIN'});
   return respond(res,503,{error:'INVITATION_NOT_DELIVERED'});
  }
  return respond(res,202,{success:true,delivery:'accepted_by_provider',expires_at:expires});
 }catch(error){
  // Never leak database or mail-provider internals, user existence, or tokens.
  console.error('[crm-invite] request failed:',error?.code||'INTERNAL');
  return respond(res,500,{error:'INVITATION_SERVICE_ERROR'});
 }
};
