'use strict';

// Zoho Mail adapter, bound to a verified account. No automatic retries after
// ambiguous provider outcomes. Never log access tokens or message contents.
const URLS=Object.freeze({
  com:'https://mail.zoho.com',eu:'https://mail.zoho.eu',in:'https://mail.zoho.in',
  comau:'https://mail.zoho.com.au',jp:'https://mail.zoho.jp',ca:'https://mail.zohocloud.ca',
  comcn:'https://mail.zoho.com.cn'
});
const EMAIL=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
function reject(code,status=400){const e=new Error(code);e.status=status;throw e;}
function validEmail(value){
  if(typeof value!=='string'||value.length>320||!EMAIL.test(value)||/[\r\n]/.test(value))reject('INVALID_EMAIL');
  return value.trim().toLowerCase();
}
function endpoint(region,accountId){
  const base=URLS[region];if(!base)reject('ZOHO_REGION_NOT_SUPPORTED');
  if(!/^\d{4,24}$/.test(String(accountId||'')))reject('INVALID_ZOHO_ACCOUNT_ID');
  return base+'/api/accounts/'+accountId+'/messages';
}
function validate(mailbox,message){
  if(!mailbox||mailbox.provider!=='zoho'||mailbox.enabled!==true||mailbox.verified!==true)reject('MAILBOX_NOT_VERIFIED',409);
  const from=validEmail(mailbox.address),to=validEmail(message?.to);
  if(mailbox.fromVerified!==true)reject('SENDER_IDENTITY_NOT_VERIFIED',403);
  if(typeof message.subject!=='string'||!message.subject.trim()||message.subject.length>200||/[\r\n]/.test(message.subject))reject('INVALID_SUBJECT');
  if(typeof message.content!=='string'||message.content.length<1||message.content.length>100000)reject('INVALID_CONTENT');
  if(message.cc!==undefined||message.bcc!==undefined||message.replyTo!==undefined||message.from!==undefined)reject('UNAPPROVED_MAIL_HEADERS',403);
  if(!Buffer.isBuffer(message.pdf)||message.pdf.length<1||message.pdf.length>10*1024*1024)reject('OFFICIAL_PDF_REQUIRED');
  if(!/^[A-Za-z0-9_-]{1,90}\.pdf$/.test(String(message.filename||'')))reject('INVALID_PDF_FILENAME');
  return {from,to,url:endpoint(mailbox.region,mailbox.accountId)};
}
function codeOf(response){
  const code=response?.status?.code;
  return typeof code==='number'?code:Number(code);
}
function validateProviderResponse(response){
  if(!response||codeOf(response)!==200)return null;
  return response.data&&typeof response.data==='object'?response.data:null;
}
async function fetchJson(fetcher,url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetcher(url,{...options,signal:controller.signal});
    const parsed=await response.json().catch(()=>null);
    if(!response.ok||!parsed)return {ok:false,data:parsed};
    return {ok:true,data:parsed};
  }finally{clearTimeout(timer);}
}
async function sendIssuedPdf({mailbox,message,accessToken,fetcher=fetch}){
  const {from,to,url}=validate(mailbox,message);
  if(typeof accessToken!=='string'||accessToken.length<20)reject('ZOHO_ACCESS_TOKEN_MISSING',503);
  const headers={Accept:'application/json',Authorization:'Zoho-oauthtoken '+accessToken};
  // No message submission occurs if the attachment upload fails.
  const attachUrl=url+'/attachments?fileName='+encodeURIComponent(message.filename)+'&isInline=false';
  const attached=await fetchJson(fetcher,attachUrl,{
    method:'POST',headers:{...headers,'Content-Type':'application/pdf'},body:message.pdf
  });
  const attachment=attached.ok?validateProviderResponse(attached.data):null;
  if(!attachment||!attachment.attachmentPath||!attachment.storeName||!attachment.attachmentName)reject('ZOHO_ATTACHMENT_NOT_ACCEPTED',502);
  const response=await fetchJson(fetcher,url,{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
      fromAddress:from,toAddress:to,subject:message.subject.trim(),
      content:message.content,mailFormat:'html',
      attachments:[{storeName:attachment.storeName,attachmentPath:attachment.attachmentPath,attachmentName:attachment.attachmentName}]
    })
  });
  const sent=response.ok?validateProviderResponse(response.data):null;
  if(!sent||!sent.messageId||String(sent.fromAddress||'').toLowerCase()!==from||
      String(sent.toAddress||'').toLowerCase()!==to)reject('ZOHO_SEND_NOT_CONFIRMED',502);
  return Object.freeze({accepted:true,provider:'zoho',messageId:String(sent.messageId),from,to});
}
module.exports={sendIssuedPdf,endpoint,validate,URLS};
