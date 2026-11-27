'use strict';
const {verifiedMatches,fetchMailboxReplies}=require('../../lib/api/correspondence-zoho-replies');
const mailbox='info@bonds-global.com';
const recipients=[{id:'contact-one',email:'investor@example.com'}];
const jobs=[{recipient_id:'contact-one',provider_message_id:'12345678',status:'accepted'}];
const sent=[{messageId:'12345678',threadId:'98765432',fromAddress:mailbox,toAddress:'Investor <investor@example.com>'}];
const inbox=[{messageId:'87654321',threadId:'98765432',fromAddress:'investor@example.com',toAddress:mailbox,subject:'Re: Investor outreach',summary:'Interested in a call',receivedTime:'1775000000000'}];
describe('Zoho investor reply matching',()=>{
 test('requires provider-confirmed sent message AND matching inbound thread and addresses',()=>{
   const matches=verifiedMatches({sent,inbox,jobs,recipients,mailboxAddress:mailbox});
   expect(matches).toHaveLength(1);
   expect(matches[0]).toMatchObject({recipient_id:'contact-one',provider_message_id:'87654321',provider_thread_id:'98765432',from_address:'investor@example.com'});
 });
 test('rejects subject-only or sender-only lookalike matches',()=>{
   for(const bad of [
     {...inbox[0],threadId:'11111111'},
     {...inbox[0],fromAddress:'spoof@example.com'},
     {...inbox[0],toAddress:'other@bonds-global.com'}
   ])expect(verifiedMatches({sent,inbox:[bad],jobs,recipients,mailboxAddress:mailbox})).toEqual([]);
 });
 test('refuses ambiguous thread attributed to different campaign recipients',()=>{
   const otherRecipient={id:'contact-two',email:'second@example.com'};
   const s2={messageId:'55555555',threadId:'98765432',fromAddress:mailbox,toAddress:otherRecipient.email};
   const j2={recipient_id:'contact-two',provider_message_id:'55555555',status:'accepted'};
   expect(verifiedMatches({sent:[...sent,s2],inbox,jobs:[...jobs,j2],recipients:[...recipients,otherRecipient],mailboxAddress:mailbox})).toEqual([]);
 });
 test('cannot assign a reply to a job that was not accepted',()=>{
   const modified=[{...jobs[0],status:'unknown'}];
   expect(verifiedMatches({sent,inbox,jobs:modified,recipients,mailboxAddress:mailbox})).toEqual([]);
 });
 test('uses official mailbox folders API and bounded folder query',async()=>{
   const calls=[];
   const fetcher=jest.fn(async url=>{
     calls.push(url);
     if(url.endsWith('/folders'))return {ok:true,json:async()=>({status:{code:200},data:[
       {folderType:'Inbox',folderId:'4444444'},{folderType:'Sent',folderId:'3333333'}]})};
     return {ok:true,json:async()=>({status:{code:200},data:[]})};
   });
   const r=await fetchMailboxReplies({mailbox:{region:'sa',account_id:'123456789'},token:'fake-connection-token',fetcher});
   expect(r).toMatchObject({sent:[],inbox:[],scan_limit:100});
   expect(calls).toHaveLength(3);
   expect(calls[0]).toBe('https://mail.zoho.sa/api/accounts/123456789/folders');
   expect(calls[1]).toContain('folderId=3333333');
   expect(calls[2]).toContain('folderId=4444444');
 });
});
