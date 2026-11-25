'use strict';
// Owner-authorized HR invitation email endpoint. Invitation tokens never appear in API responses.
const getSupabase=require('./supabase');
const {sendEmail,getEmailConfigStatus}=require('./email');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origin='https://bonds-global.com';
function reply(res,status,body){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 return res.status(status).json(body);
}
module.exports=async function hrInvite(req,res){
 if(req.method!=='POST')return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(res,503,{error:'HR_AUTH_SERVICE_UNAVAILABLE'});
 const mail=getEmailConfigStatus();
 if(!mail.hasResend&&!mail.hasSmtp)return reply(res,503,{error:'HR_EMAIL_UNAVAILABLE'});
 const header=String(req.headers.authorization||'');
 if(!header.startsWith('Bearer '))return reply(res,401,{error:'AUTH_REQUIRED'});
 let body=req.body;
 if(typeof body==='string'){try{body=JSON.parse(body);}catch{return reply(res,400,{error:'INVALID_JSON'});}}
 if(!body||typeof body!=='object'||Array.isArray(body))return reply(res,400,{error:'INVALID_BODY'});
 const id=String(body.invitation_id||'').trim();
 if(!uuid.test(id))return reply(res,400,{error:'INVALID_INVITATION_ID'});
 try{
  const sb=getSupabase();
  const {data:{user}={},error:authError}=await sb.auth.getUser(header.slice(7));
  if(authError||!user)return reply(res,401,{error:'AUTH_REQUIRED'});
  const {data:invite,error:inviteError}=await sb.from('hr_saas_invitations')
   .select('id,workspace_id,employee_id,invited_email,role,status,token,created_by,expires_at')
   .eq('id',id).eq('created_by',user.id).maybeSingle();
  if(inviteError)throw inviteError;
  if(!invite)return reply(res,403,{error:'INVITATION_NOT_OWNED'});
  if(invite.status!=='pending'||Date.parse(invite.expires_at)<=Date.now())
   return reply(res,409,{error:'INVITATION_NO_LONGER_ACTIVE'});
  if(!uuid.test(invite.token)||!['employee','hr_manager'].includes(invite.role))
   return reply(res,409,{error:'INVITATION_INVALID'});
  const {data:workspace,error:workspaceError}=await sb.from('hr_saas_workspaces')
   .select('id,name,owner_user_id').eq('id',invite.workspace_id).eq('owner_user_id',user.id).maybeSingle();
  if(workspaceError)throw workspaceError;
  if(!workspace)return reply(res,403,{error:'OWNER_REQUIRED'});
  const {data:employee,error:employeeError}=await sb.from('hr_saas_employees')
   .select('id,full_name').eq('id',invite.employee_id).eq('workspace_id',workspace.id).maybeSingle();
  if(employeeError)throw employeeError;
  if(!employee)return reply(res,409,{error:'EMPLOYEE_NOT_FOUND'});
  const link=origin+'/my-bonds/crm/?program=hr#invite='+encodeURIComponent(invite.token);
  const subject='BONDS Global HR - Invitation to '+workspace.name;
  const text=[
   'You have been invited to BONDS Global HR.',
   'Company: '+workspace.name,
   'Employee: '+employee.full_name,
   'Role: '+invite.role,
   'Accept invitation: '+link,
   'Sign in with the exact email address receiving this message.',
   'Expires: '+new Date(invite.expires_at).toISOString(),
   'Do not share this private invitation link.'
  ].join('\\n');
  // Resend supports safe replay after a timeout. SMTP does not offer this guarantee.
  const options={to:invite.invited_email,subject,text};
  if(mail.hasResend)options.idempotencyKey='hr-invite-'+invite.id;
  const sent=await sendEmail(options);
  if(sent.success!==true){
   console.error('[hr-invite] mail not accepted:',sent.reason||'provider_error');
   return reply(res,503,{error:'HR_EMAIL_NOT_SENT'});
  }
  return reply(res,202,{success:true,delivery:'accepted_by_provider',provider:sent.provider,invitation_id:invite.id});
 }catch(err){
  console.error('[hr-invite] unexpected failure:',err?.code||'INTERNAL');
  return reply(res,500,{error:'HR_INVITATION_EMAIL_SERVICE_ERROR'});
 }
};
