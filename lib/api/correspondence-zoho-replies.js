'use strict';

// Conservative Zoho reply verification: sender address alone never attributes
// a reply. A provider Sent message ID and a matching Inbox thread are mandatory.
const { MAIL_HOSTS } = require('./correspondence-zoho-oauth');
const DIGITS=/^[0-9]{4,30}$/;
const EMAILS=/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function deny(code){throw new Error(code);}
function emails(s){return new Set((String(s||'').match(EMAILS)||[]).map(x=>x.toLowerCase()));}
function clean(s,n=300){return String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);}
function normalizedId(v){const s=String(v||'');return DIGITS.test(s)?s:null;}
function verifiedMatches({sent,inbox,jobs,recipients,mailboxAddress}){
 const mailbox=String(mailboxAddress||'').toLowerCase();
 if(!mailbox||!Array.isArray(sent)||!Array.isArray(inbox)||!Array.isArray(jobs)||!Array.isArray(recipients))
   deny('INVALID_REPLY_INPUT');
 const recipientsById=new Map(recipients.map(r=>[r.id,r]));
 const outboundByThread=new Map();
 for(const m of sent){
  const mid=normalizedId(m.messageId),thread=normalizedId(m.threadId);
  if(!mid||!thread||!emails(m.fromAddress).has(mailbox))continue;
  for(const job of jobs){
   if(job.status!=='accepted'||String(job.provider_message_id||'')!==mid)continue;
   const recipient=recipientsById.get(job.recipient_id);
   if(!recipient||!emails(m.toAddress).has(String(recipient.email||'').toLowerCase()))continue;
   const key=thread;
   const existing=outboundByThread.get(key);
   if(existing&&existing.recipient_id!==recipient.id){
    // Ambiguous thread containing different campaign recipients: never attribute.
    outboundByThread.set(key,null);
   }else if(!outboundByThread.has(key))outboundByThread.set(key,{job,recipient,recipient_id:recipient.id});
  }
 }
 const matches=[],seen=new Set();
 for(const incoming of inbox){
  const mid=normalizedId(incoming.messageId),thread=normalizedId(incoming.threadId);
  if(!mid||!thread||seen.has(mid)||!outboundByThread.has(thread))continue;
  const original=outboundByThread.get(thread);if(!original)continue;
  const from=String(original.recipient.email||'').toLowerCase();
  if(!emails(incoming.fromAddress).has(from)||!emails(incoming.toAddress).has(mailbox))continue;
  if(mid===String(original.job.provider_message_id))continue;
  seen.add(mid);
  const received=Number(incoming.receivedTime);
  matches.push({
   recipient_id:original.recipient_id,provider_message_id:mid,provider_thread_id:thread,
   from_address:from,subject:clean(incoming.subject,300),preview:clean(incoming.summary,500),
   received_at:Number.isFinite(received)&&received>0?new Date(received).toISOString():null
  });
 }
 return matches;
}
async function getJson(fetcher,url,token){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const resp=await fetcher(url,{method:'GET',headers:{Accept:'application/json',Authorization:'Zoho-oauthtoken '+token},signal:controller.signal});
  const body=await resp.json().catch(()=>null);
  if(!resp.ok||Number(body?.status?.code)!==200||!Array.isArray(body?.data))deny('ZOHO_REPLY_LOOKUP_FAILED');
  return body.data;
 }finally{clearTimeout(timer);}
}
async function fetchMailboxReplies({mailbox,token,fetcher=fetch}){
 if(!mailbox||!MAIL_HOSTS[mailbox.region]||!DIGITS.test(String(mailbox.account_id||''))||
    typeof token!=='string'||token.length<10)deny('INVALID_MAILBOX_CREDENTIALS');
 const base='https://'+MAIL_HOSTS[mailbox.region]+'/api/accounts/'+mailbox.account_id;
 const folders=await getJson(fetcher,base+'/folders',token);
 const sentFolder=folders.find(x=>String(x.folderType||'').toLowerCase()==='sent'&&DIGITS.test(String(x.folderId||'')));
 const inboxFolder=folders.find(x=>String(x.folderType||'').toLowerCase()==='inbox'&&DIGITS.test(String(x.folderId||'')));
 if(!sentFolder||!inboxFolder)deny('ZOHO_REQUIRED_FOLDERS_MISSING');
 const sent=await getJson(fetcher,base+'/messages/view?folderId='+encodeURIComponent(sentFolder.folderId)+'&start=1&limit=100&threadedMails=true&includeto=true',token);
 const inbox=await getJson(fetcher,base+'/messages/view?folderId='+encodeURIComponent(inboxFolder.folderId)+'&start=1&limit=100&threadedMails=true&includeto=true',token);
 return {sent,inbox,scan_limit:100};
}
module.exports={verifiedMatches,fetchMailboxReplies,emails};
