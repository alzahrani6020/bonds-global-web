'use strict';
const {deliverReviewedDirectory}=require('../../lib/portable-intelligence/destination-delivery');
const A='12345678-1234-4123-8123-1234567890ab';
function setup(){
 const workflow={exportDirectory:jest.fn(async()=>({schema_version:1,target:'crm',workspace_id:A,records:[{id:1,type:'organization',name:'Sample Approved'}],commit_destination:false,send_mail:false}))};
 return {workflow,workspaceId:A,actorId:'trusted-local-owner',target:'crm',recordIds:[1],remoteEndpoint:'https://destination.example.org/api/import-reviewed',allowedOrigin:'https://destination.example.org',bearerToken:'example-trusted-remote-token-1234567890'};
}
const headers={get:()=> 'application/json'};
describe('real transport contract, without access to SaaS production',()=>{
 test('sends only approved records and requires remote workspace receipt',async()=>{
  const args=setup();
  const fetchImpl=jest.fn(async(_url,options)=>{
   const payload=JSON.parse(options.body);
   expect(payload).toMatchObject({workspace_id:A,approved:true,send_mail:false,create_hr_employee:false});
   expect(options.redirect).toBe('manual');
   expect(options.headers.Authorization).toMatch(/^Bearer /);
   return {ok:true,status:200,headers,json:async()=>({accepted:true,workspace_id:A,target:'crm',accepted_count:1,receipt_id:'receipt-verified-0001',verified:true})};
  });
  const r=await deliverReviewedDirectory({...args,fetchImpl});
  expect(r).toMatchObject({delivered:true,verified_destination_ack:true,send_mail:false,create_hr_employee:false});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });
 test('remote committed 202 without readback never reports delivered and must be reconciled',async()=>{
  const args=setup();
  const fetchImpl=jest.fn(async()=>({ok:true,status:202,headers,json:async()=>({accepted:true,verified:false,workspace_id:A,target:'crm',accepted_count:1,receipt_id:'receipt-unverified-0001'})}));
  const result=await deliverReviewedDirectory({...args,fetchImpl});
  expect(result).toMatchObject({delivered:false,accepted:true,requires_reconciliation:true,verified_destination_ack:false,receipt_id:'receipt-unverified-0001'});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
 });
 test('legacy 200 receipt without independent readback is rejected',async()=>{
  const args=setup();
  const fetchImpl=jest.fn(async()=>({ok:true,status:200,headers,json:async()=>({accepted:true,workspace_id:A,target:'crm',accepted_count:1,receipt_id:'receipt-legacy-0001'})}));
  await expect(deliverReviewedDirectory({...args,fetchImpl})).rejects.toThrow('DESTINATION_READBACK_UNVERIFIED');
 });
 test('rejects non-pinned domains and HTTP without exporting records',async()=>{
  const args=setup();
  await expect(deliverReviewedDirectory({...args,remoteEndpoint:'https://untrusted.example.org/import',fetchImpl:jest.fn()})).rejects.toThrow('DESTINATION_NOT_ALLOWLISTED');
  await expect(deliverReviewedDirectory({...args,remoteEndpoint:'http://destination.example.org/import',fetchImpl:jest.fn()})).rejects.toThrow('SECURE_DESTINATION_REQUIRED');
  expect(args.workflow.exportDirectory).not.toHaveBeenCalled();
 });
 test('rejects remote tenant mismatch and redirects',async()=>{
  const args=setup();
  const wrong=async()=>({ok:true,status:200,headers,json:async()=>({accepted:true,workspace_id:'12345678-1234-4123-8123-1234567890ac',target:'crm',accepted_count:1,receipt_id:'receipt-mismatch-0001'})});
  await expect(deliverReviewedDirectory({...args,fetchImpl:wrong})).rejects.toThrow('INVALID_DESTINATION_RECEIPT');
  const redirect=async()=>({ok:false,status:302,headers});
  await expect(deliverReviewedDirectory({...args,fetchImpl:redirect})).rejects.toThrow('DESTINATION_REDIRECT_FORBIDDEN');
 });
 test('denied source export never invokes network',async()=>{
  const args=setup(),fetchImpl=jest.fn();
  args.workflow.exportDirectory=async()=>{throw Error('EXPORT_NOT_AUTHORIZED')};
  await expect(deliverReviewedDirectory({...args,fetchImpl})).rejects.toThrow('EXPORT_NOT_AUTHORIZED');
  expect(fetchImpl).not.toHaveBeenCalled();
 });
});
