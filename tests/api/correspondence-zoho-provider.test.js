'use strict';
const {sendIssuedPdf}=require('../../lib/api/correspondence-zoho-provider');
const mailbox={provider:'zoho',verified:true,fromVerified:true,enabled:true,address:'info@bonds-global.com',region:'com',accountId:'123456789'};
const message={to:'investor@example.com',subject:'BONDS Clix investor letter',content:'<p>Attached issued letter</p>',pdf:Buffer.from('%PDF-1.5 mock data'),filename:'BONDS-2026-000001.pdf'};
const token='token-xxxxxxxxxxxxxxxxxxx';
describe('Zoho official correspondence delivery adapter',()=>{
 test('accepts only provider-confirmed separate recipient message after attachment upload',async()=>{
  const calls=[];
  const fetcher=jest.fn(async (url,options)=>{
   calls.push({url,options});
   if(url.includes('attachments'))return {ok:true,json:async()=>({status:{code:200},data:{storeName:'store',attachmentPath:'/path',attachmentName:'a.pdf'}})};
   return {ok:true,json:async()=>({status:{code:200},data:{messageId:'123456',fromAddress:mailbox.address,toAddress:message.to}})};
  });
  const res=await sendIssuedPdf({mailbox,message,accessToken:token,fetcher});
  expect(res.accepted).toBe(true);
  expect(res.to).toBe(message.to);
  expect(calls).toHaveLength(2);
  expect(calls[1].url).toBe('https://mail.zoho.com/api/accounts/123456789/messages');
  const body=JSON.parse(calls[1].options.body);
  expect(body.toAddress).toBe(message.to);
  expect(body.fromAddress).toBe(mailbox.address);
  expect(body).not.toHaveProperty('ccAddress');
  expect(body).not.toHaveProperty('bccAddress');
  expect(body.attachments).toHaveLength(1);
 });
 test.each([
  [{verified:false},'MAILBOX_NOT_VERIFIED'],
  [{fromVerified:false},'SENDER_IDENTITY_NOT_VERIFIED'],
  [{address:'other@example.com\r\nBcc:test@evil.com'},'INVALID_EMAIL'],
  [{region:'unknown'},'ZOHO_REGION_NOT_SUPPORTED'],
  [{accountId:'../../evil'},'INVALID_ZOHO_ACCOUNT_ID']
 ])('rejects unverified sender identity',async(override,reason)=>{
  const fetcher=jest.fn();
  await expect(sendIssuedPdf({mailbox:{...mailbox,...override},message,accessToken:token,fetcher})).rejects.toThrow(reason);
  expect(fetcher).not.toHaveBeenCalled();
 });
 test('does not call message send if attachment rejected',async()=>{
  const fetcher=jest.fn(async()=>({ok:true,json:async()=>({status:{code:500},data:{}})}));
  await expect(sendIssuedPdf({mailbox,message,accessToken:token,fetcher})).rejects.toThrow('ZOHO_ATTACHMENT_NOT_ACCEPTED');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 test('does not claim accepted when provider returns incomplete or mismatched receipt',async()=>{
  const fetcher=jest.fn(async(url)=>url.includes('attachments')
   ?{ok:true,json:async()=>({status:{code:200},data:{storeName:'a',attachmentName:'b',attachmentPath:'/c'}})}
   :{ok:true,json:async()=>({status:{code:200},data:{messageId:'123',fromAddress:mailbox.address,toAddress:'wrong@example.com'}})});
  await expect(sendIssuedPdf({mailbox,message,accessToken:token,fetcher})).rejects.toThrow('ZOHO_SEND_NOT_CONFIRMED');
 });
 test('rejects malformed recipient and invented headers before network call',async()=>{
  const fetcher=jest.fn();
  await expect(sendIssuedPdf({mailbox,message:{...message,bcc:'secret@example.com'},accessToken:token,fetcher})).rejects.toThrow('UNAPPROVED_MAIL_HEADERS');
  expect(fetcher).not.toHaveBeenCalled();
 });
});
