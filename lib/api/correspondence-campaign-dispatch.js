'use strict';
const {createHash}=require('node:crypto');
const getSupabase=require('./supabase');
const {transitionCampaign}=require('./correspondence-campaign-workflow');
const {sendIssuedPdf}=require('./correspondence-zoho-provider');
const {refreshToken}=require('./correspondence-zoho-oauth');
const {decryptToken}=require('./correspondence-mailbox-crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function deny(code,status=409){const e=new Error(code);e.status=status;throw e;}
function validId(v){if(!UUID.test(String(v||'')))deny('INVALID_ID',400);return v.toLowerCase();}
function reply(res,code,data){res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Authorization');return res.status(code).json(data);}
async function checked(q){const r=await q;if(r.error)throw r.error;return r.data;}
async function actor(sb,req){
 const h=String(req.headers?.authorization||'');
 if(!/^Bearer [^\s]+$/.test(h))deny('AUTH_REQUIRED',401);
 const r=await sb.auth.getUser(h.slice(7));
 if(r.error||!r.data?.user||r.data.user.is_anonymous)deny('AUTH_REQUIRED',401);
 return r.data.user;
}
async function companyPermission(sb,workspaceId,userId){
 const company=await checked(sb.from('crm_app_workspaces').select('owner_user_id').eq('id',workspaceId).maybeSingle());
 if(!company)deny('WORKSPACE_NOT_FOUND',404);
 if(company.owner_user_id===userId)return true;
 const member=await checked(sb.from('crm_app_members').select('role').eq('workspace_id',workspaceId).eq('member_user_id',userId).eq('active',true).maybeSingle());
 if(!member||member.role!=='admin')deny('DISPATCH_PERMISSION_DENIED',403);
 return true;
}
async function context(sb,campaignId,userId){
 const campaign=await checked(sb.from('correspondence_campaigns').select('*').eq('id',campaignId).maybeSingle());
 if(!campaign)deny('CAMPAIGN_NOT_FOUND',404);
 await companyPermission(sb,campaign.workspace_id,userId);
 return campaign;
}
async function mailboxFor(sb,id,workspaceId){
 const m=await checked(sb.from('correspondence_mailboxes').select('*').eq('id',id)
  .eq('workspace_id',workspaceId).eq('enabled',true).maybeSingle());
 if(!m||m.provider!=='zoho'||!m.verified_at||!m.encrypted_refresh_token)deny('VERIFIED_MAILBOX_REQUIRED',409);
 return m;
}
async function rowsFor(sb,campaign){
 const recipients=await checked(sb.from('correspondence_campaign_recipients').select('*')
  .eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id).order('created_at',{ascending:true}).limit(251));
 if(!recipients?.length||recipients.length>250||recipients.some(r=>r.status!=='issued'||!r.document_id))deny('CAMPAIGN_LETTERS_NOT_ALL_ISSUED',409);
 const ids=recipients.map(r=>r.document_id);
 if(new Set(ids).size!==ids.length)deny('ISSUED_DOCUMENT_REUSED',409);
 const docs=await checked(sb.from('correspondence_documents').select('id,company_id,workspace_context,status,recipient_email,issued_hash,artifact_hash,stamp_hash,verification_token')
  .in('id',ids).limit(251));
 const issues=await checked(sb.from('correspondence_issues')
  .select('document_id,state,pdf_hash,stamp_hash,issued_hash,verification_token')
  .in('document_id',ids).eq('state','active').limit(251));
 if(!docs||docs.length!==ids.length||!issues||issues.length!==ids.length)deny('ISSUED_DOCUMENT_VERIFICATION_FAILED',409);
 for(const r of recipients){
  const doc=docs.find(d=>d.id===r.document_id),issue=issues.find(i=>i.document_id===r.document_id);
  if(!doc||!issue||doc.workspace_context?.campaign_workspace_id!==campaign.workspace_id||doc.status!=='issued'||doc.recipient_email?.toLowerCase()!==r.email.toLowerCase()||
    !doc.issued_hash||!doc.artifact_hash||!doc.stamp_hash||!doc.verification_token||
    issue.pdf_hash!==doc.artifact_hash||issue.issued_hash!==doc.issued_hash||
    issue.stamp_hash!==doc.stamp_hash||issue.verification_token!==doc.verification_token)
   deny('ISSUED_DOCUMENT_VERIFICATION_FAILED',409);
 }
 return {recipients,docs};
}
function jobHash(campaign,r,doc,mailbox){
 return createHash('sha256').update([campaign.workspace_id,campaign.id,r.id,doc.id,doc.issued_hash,mailbox.id].join(':')).digest('hex');
}
async function start(sb,campaign,mailboxId,user){
 if(!process.env.ZOHO_OAUTH_CLIENT_ID||!process.env.ZOHO_OAUTH_CLIENT_SECRET||!process.env.BONDS_MAILBOX_ENCRYPTION_KEY)deny('ZOHO_OAUTH_NOT_CONFIGURED',503);
 if(campaign.status!=='approved')deny('CAMPAIGN_MUST_BE_APPROVED',409);
 const mailbox=await mailboxFor(sb,mailboxId,campaign.workspace_id);
 const {recipients,docs}=await rowsFor(sb,campaign);
 const jobs=recipients.map(r=>{
  const doc=docs.find(d=>d.id===r.document_id);
  return {campaign_id:campaign.id,workspace_id:campaign.workspace_id,recipient_id:r.id,
    document_id:doc.id,mailbox_id:mailbox.id,issued_hash:doc.issued_hash,
    idempotency_key:jobHash(campaign,r,doc,mailbox),status:'ready'};
 });
 transitionCampaign({status:campaign.status,tenantId:campaign.workspace_id},'start',{
  authorization:'verified-server-side',actorTenantId:campaign.workspace_id,actorId:user.id,
  canSend:true,mailboxVerified:true,lettersValidated:true,dispatchApproval:true
 });
 // The unique recipient+document+key constraints make repeated preparation safe.
 await checked(sb.from('correspondence_campaign_dispatch_jobs').upsert(jobs,{onConflict:'campaign_id,recipient_id',ignoreDuplicates:true}));
 const changed=await checked(sb.from('correspondence_campaigns')
  .update({status:'running',updated_at:new Date().toISOString()}).eq('id',campaign.id)
  .eq('workspace_id',campaign.workspace_id).eq('status','approved').select('id,status').maybeSingle());
 if(!changed)deny('CAMPAIGN_CHANGED',409);
 await checked(sb.from('correspondence_campaign_events').insert({
  campaign_id:campaign.id,actor_user_id:user.id,action:'dispatch_started',details:{count:jobs.length,mailbox_id:mailbox.id}
 }));
 return {campaign:changed,queued:jobs.length};
}
function htmlEscape(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
async function verifiedPdf(sb,docId,expectedHash,workspaceId){
 const doc=await checked(sb.from('correspondence_documents')
  .select('id,company_id,workspace_context,status,recipient_email,subject,title,reference_number,artifact_path,artifact_hash,issued_hash,stamp_hash,verification_token,current_version')
  .eq('id',docId).maybeSingle());
 if(!doc||doc.workspace_context?.campaign_workspace_id!==workspaceId||doc.status!=='issued'||doc.issued_hash!==expectedHash||!doc.artifact_path||!doc.artifact_hash)deny('DOCUMENT_REVERIFY_FAILED',409);
 const issue=await checked(sb.from('correspondence_issues')
  .select('pdf_hash,issued_hash,stamp_hash,verification_token')
  .eq('document_id',docId).eq('state','active').limit(1).maybeSingle());
 if(!issue||issue.pdf_hash!==doc.artifact_hash||issue.issued_hash!==doc.issued_hash||
   issue.stamp_hash!==doc.stamp_hash||issue.verification_token!==doc.verification_token)deny('DOCUMENT_REVERIFY_FAILED',409);
 const {data:blob,error}=await sb.storage.from('correspondence-artifacts').download(doc.artifact_path);
 if(error||!blob)deny('OFFICIAL_PDF_UNAVAILABLE',409);
 const buffer=Buffer.from(await blob.arrayBuffer()),hash=createHash('sha256').update(buffer).digest('hex');
 if(hash!==doc.artifact_hash)deny('OFFICIAL_PDF_INTEGRITY_FAILED',409);
 return {doc,pdf:buffer};
}
async function next(sb,campaign,user){
 if(!process.env.ZOHO_OAUTH_CLIENT_ID||!process.env.ZOHO_OAUTH_CLIENT_SECRET||!process.env.BONDS_MAILBOX_ENCRYPTION_KEY)deny('ZOHO_OAUTH_NOT_CONFIGURED',503);
 if(campaign.status!=='running')deny('CAMPAIGN_NOT_RUNNING',409);
 const ready=await checked(sb.from('correspondence_campaign_dispatch_jobs').select('*')
  .eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id).eq('status','ready')
  .order('created_at',{ascending:true}).limit(1));
 if(!ready?.length)return {pending:false};
 const task=ready[0];
 const claimed=await checked(sb.from('correspondence_campaign_dispatch_jobs')
  .update({status:'sending',claimed_by:user.id,claimed_at:new Date().toISOString(),
    attempt_count:task.attempt_count+1,updated_at:new Date().toISOString()})
  .eq('id',task.id).eq('workspace_id',campaign.workspace_id).eq('status','ready').select('*').maybeSingle());
 if(!claimed)return {pending:true,claimed_elsewhere:true};
 try{
  const recipient=await checked(sb.from('correspondence_campaign_recipients').select('*')
    .eq('id',claimed.recipient_id).eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id).maybeSingle());
  const mailbox=await mailboxFor(sb,claimed.mailbox_id,campaign.workspace_id);
  if(!recipient||recipient.document_id!==claimed.document_id||recipient.status!=='issued')deny('RECIPIENT_REVERIFY_FAILED',409);
  const {doc,pdf}=await verifiedPdf(sb,claimed.document_id,claimed.issued_hash,campaign.workspace_id);
  if(doc.recipient_email?.toLowerCase()!==recipient.email.toLowerCase())deny('RECIPIENT_REVERIFY_FAILED',409);
  const version=await checked(sb.from('correspondence_versions').select('text_content')
    .eq('document_id',doc.id).eq('version',doc.current_version).maybeSingle());
  if(!version)deny('ISSUED_CONTENT_NOT_FOUND',409);
  const encrypted=decryptToken(mailbox.encrypted_refresh_token);
  if(!process.env.ZOHO_OAUTH_CLIENT_ID||!process.env.ZOHO_OAUTH_CLIENT_SECRET)deny('ZOHO_OAUTH_NOT_CONFIGURED',503);
  const refreshed=await refreshToken({region:mailbox.region,clientId:process.env.ZOHO_OAUTH_CLIENT_ID,
    clientSecret:process.env.ZOHO_OAUTH_CLIENT_SECRET,refreshToken:encrypted});
  const plain=String(version.text_content||'').slice(0,20000);
  const result=await sendIssuedPdf({
   mailbox:{provider:'zoho',enabled:true,verified:true,fromVerified:true,address:mailbox.address,
    region:mailbox.region,accountId:mailbox.account_id},
   message:{to:recipient.email,subject:(doc.reference_number||'BONDS')+' — '+String(doc.subject||doc.title||'Official correspondence').slice(0,130),
    content:'<div dir="rtl">'+htmlEscape(plain||'يرجى الاطلاع على الخطاب الرسمي المرفق.').replace(/\r?\n/g,'<br>')+'</div>',
    pdf,filename:(String(doc.reference_number||'BONDS-'+doc.id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,80))+'.pdf'},
   accessToken:refreshed.access_token
  });
  // A provider-confirmed message ID is required; otherwise never mark accepted.
  const accepted=await checked(sb.from('correspondence_campaign_dispatch_jobs')
   .update({status:'accepted',provider_message_id:result.messageId,accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()})
   .eq('id',claimed.id).eq('workspace_id',campaign.workspace_id).eq('status','sending').select('id,status,provider_message_id').maybeSingle());
  if(!accepted)deny('PROVIDER_ACCEPTED_DB_UNCERTAIN',503);
  await checked(sb.from('correspondence_campaign_recipients')
   .update({status:'accepted',provider_message_id:result.messageId,updated_at:new Date().toISOString()})
   .eq('id',recipient.id).eq('workspace_id',campaign.workspace_id));
  return {pending:true,accepted:true,recipient_id:recipient.id,provider_message_id:result.messageId};
 }catch(e){
  // Even a timeout could mean Zoho accepted the email. Never resend automatically.
  await sb.from('correspondence_campaign_dispatch_jobs')
   .update({status:'unknown',error_code:String(e.message||'DELIVERY_UNKNOWN').slice(0,100),updated_at:new Date().toISOString()})
   .eq('id',claimed.id).eq('workspace_id',campaign.workspace_id).eq('status','sending');
  return {pending:true,accepted:false,uncertain:true,recipient_id:claimed.recipient_id};
 }
}
async function status(sb,campaign){
 const jobs=await checked(sb.from('correspondence_campaign_dispatch_jobs')
  .select('id,recipient_id,status,provider_message_id,created_at,updated_at')
  .eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id).limit(251));
 const counts={ready:0,sending:0,accepted:0,unknown:0,failed:0,cancelled:0};
 for(const job of jobs||[])counts[job.status]=(counts[job.status]||0)+1;
 return {campaign_id:campaign.id,status:campaign.status,counts,jobs:jobs||[]};
}
async function handler(req,res,makeClient=getSupabase){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(res,503,{error:'DISPATCH_BACKEND_NOT_CONFIGURED'});
 if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
 try{
  const sb=makeClient(),user=await actor(sb,req);
  const url=new URL(req.url||'/', 'https://bonds-global.com'),body=req.method==='POST'?(req.body||{}):{};
  const id=validId(body.campaign_id||req.query?.campaign_id||url.searchParams.get('campaign_id'));
  const campaign=await context(sb,id,user.id);
  if(req.method==='GET')return reply(res,200,await status(sb,campaign));
  if(body.action==='start')return reply(res,200,await start(sb,campaign,validId(body.mailbox_id),user));
  if(body.action==='next')return reply(res,200,await next(sb,campaign,user));
  return reply(res,400,{error:'UNKNOWN_DISPATCH_ACTION'});
 }catch(e){return reply(res,e.status||503,{error:e.status?e.message:'DISPATCH_UNAVAILABLE'});}
}
module.exports=handler;
module.exports.createHandler=makeClient=>(req,res)=>handler(req,res,makeClient);
