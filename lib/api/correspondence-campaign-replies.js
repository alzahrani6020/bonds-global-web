'use strict';
// Zoho reply syncing is an explicit, read-only provider action followed by
// tenant-scoped metadata archival. It never sends mail or mutates issued PDFs.
const getSupabase=require('./supabase');
const {internal:{actor,context,mailboxFor,checked,validId,reply}}=require('./correspondence-campaign-dispatch');
const {refreshToken}=require('./correspondence-zoho-oauth');
const {decryptToken}=require('./correspondence-mailbox-crypto');
const {fetchMailboxReplies,verifiedMatches}=require('./correspondence-zoho-replies');

function deny(code,status=409){const e=new Error(code);e.status=status;throw e;}
async function crmActivity(sb,row,recipient){
 const contacts=await checked(sb.from('crm_app_contacts')
  .select('id,email').eq('workspace_id',row.workspace_id).eq('email',recipient.email).limit(2));
 const contactId=contacts?.length===1?contacts[0].id:null;
 const detail='campaign_reply_id:'+row.id+'; provider:zoho; campaign:'+row.campaign_id+
  '; original email:'+row.from_address;
 await checked(sb.from('crm_app_activities').upsert({
   id:row.id,workspace_id:row.workspace_id,contact_id:contactId,kind:'email',
   subject:('رد وارد على الحملة: '+String(row.subject||recipient.organization||'')).slice(0,300),
   status:'completed',completed_at:row.received_at||new Date().toISOString(),details:detail
 },{onConflict:'id'}));
 await checked(sb.from('correspondence_campaign_replies').update({
   crm_activity_id:row.id,crm_synced_at:new Date().toISOString()
 }).eq('id',row.id).eq('workspace_id',row.workspace_id).is('crm_synced_at',null));
}
async function synchronize(sb,campaign,mailboxId){
 if(!process.env.ZOHO_OAUTH_CLIENT_ID||!process.env.ZOHO_OAUTH_CLIENT_SECRET||!process.env.BONDS_MAILBOX_ENCRYPTION_KEY)
  deny('ZOHO_OAUTH_NOT_CONFIGURED',503);
 const mailbox=await mailboxFor(sb,mailboxId,campaign.workspace_id);
 const jobs=await checked(sb.from('correspondence_campaign_dispatch_jobs')
  .select('recipient_id,provider_message_id,status')
  .eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id)
  .eq('mailbox_id',mailboxId).eq('status','accepted').limit(251));
 if(!jobs?.length)return {scanned:0,new_replies:0,crm_linked:0,unresolved:0};
 const recipients=await checked(sb.from('correspondence_campaign_recipients')
  .select('id,workspace_id,email,organization,contact_id,status').eq('campaign_id',campaign.id)
  .eq('workspace_id',campaign.workspace_id).limit(251));
 const token=decryptToken(mailbox.encrypted_refresh_token);
 const renewed=await refreshToken({region:mailbox.region,clientId:process.env.ZOHO_OAUTH_CLIENT_ID,
  clientSecret:process.env.ZOHO_OAUTH_CLIENT_SECRET,refreshToken:token});
 const provider=await fetchMailboxReplies({mailbox,token:renewed.access_token});
 const matches=verifiedMatches({sent:provider.sent,inbox:provider.inbox,jobs,recipients,mailboxAddress:mailbox.address});
 let archived=0,linked=0;
 for(const result of matches){
  const target=recipients.find(r=>r.id===result.recipient_id);
  if(!target)continue;
  const row={...result,campaign_id:campaign.id,workspace_id:campaign.workspace_id,mailbox_id:mailbox.id};
  // Unique mailbox/message ID allows replay without duplicating a reply.
  await checked(sb.from('correspondence_campaign_replies')
   .upsert(row,{onConflict:'mailbox_id,provider_message_id',ignoreDuplicates:true}));
  const existing=await checked(sb.from('correspondence_campaign_replies').select('*')
   .eq('mailbox_id',mailbox.id).eq('provider_message_id',result.provider_message_id)
   .eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id).maybeSingle());
  if(!existing)continue;
  archived++;
  if(!existing.crm_synced_at){
   try {await crmActivity(sb,existing,target);linked++;}
   catch(_e) {/* Leave crm_synced_at null for idempotent reconciliation. */}
  }
  await checked(sb.from('correspondence_campaign_recipients').update({
   status:'replied',updated_at:new Date().toISOString()
  }).eq('id',target.id).eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id)
   .in('status',['accepted','replied']));
 }
 return {scanned:(provider.sent?.length||0)+(provider.inbox?.length||0),
  matched:matches.length,archived,crm_linked:linked,unresolved:Math.max(0,archived-linked),
  scan_limit_per_folder:provider.scan_limit};
}
async function handler(req,res,makeClient=getSupabase){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(res,503,{error:'REPLY_BACKEND_NOT_CONFIGURED'});
 try{
  const sb=makeClient(),user=await actor(sb,req);
  const url=new URL(req.url||'/', 'https://bonds-global.com');
  const body=req.method==='POST'?req.body||{}:{};
  const id=validId(body.campaign_id||req.query?.campaign_id||url.searchParams.get('campaign_id'));
  const campaign=await context(sb,id,user.id);
  if(req.method==='GET'){
   const rows=await checked(sb.from('correspondence_campaign_replies')
    .select('id,recipient_id,provider_message_id,from_address,subject,received_at,crm_synced_at')
    .eq('campaign_id',campaign.id).eq('workspace_id',campaign.workspace_id)
    .order('created_at',{ascending:false}).limit(250));
   return reply(res,200,{campaign_id:id,replies:rows||[]});
  }
  if(req.method!=='POST')return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
  if(body.action!=='sync')return reply(res,400,{error:'UNKNOWN_REPLY_ACTION'});
  const result=await synchronize(sb,campaign,validId(body.mailbox_id));
  return reply(res,200,{campaign_id:id,...result});
 }catch(err){return reply(res,err.status||503,{error:err.status?err.message:'REPLY_SYNC_UNAVAILABLE'});}
}
module.exports=handler;
module.exports.createHandler=makeClient=>(req,res)=>handler(req,res,makeClient);
module.exports.verifiedMatches=verifiedMatches;
