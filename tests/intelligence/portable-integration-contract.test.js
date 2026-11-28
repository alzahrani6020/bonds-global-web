'use strict';
const {normalizeRows}=require('../../lib/portable-intelligence/core');
const {prepareImportIntent}=require('../../lib/portable-intelligence/integration-contract');
const A='12345678-1234-4123-8123-1234567890ab';
const B='12345678-1234-4123-8123-1234567890ac';
const proposal=normalizeRows({workspaceId:A,source:{filename:'contacts.csv'},rows:[{type:'organization',name:'Company A',email:'info@example.org'}]});
describe('portable integration intents',()=>{
 test('CRM and correspondence remain review-only and never send mail',()=>{
  for(const target of ['crm','correspondence']){
   const intent=prepareImportIntent({proposal,workspaceId:A,target,approvedIndices:[0]});
   expect(intent).toMatchObject({target,workspace_id:A,auto_saved:false,send_mail:false,requires_manual_approval:true});
   expect(intent.records[0].fields.name).toBe('Company A');
  }
 });
 test('refuses cross-company and unapproved or duplicate selections',()=>{
  expect(()=>prepareImportIntent({proposal,workspaceId:B,target:'crm',approvedIndices:[0]})).toThrow('WORKSPACE_MISMATCH');
  expect(()=>prepareImportIntent({proposal,workspaceId:A,target:'crm',approvedIndices:[]})).toThrow('INVALID_APPROVAL_SELECTION');
  expect(()=>prepareImportIntent({proposal,workspaceId:A,target:'crm',approvedIndices:[0,0]})).toThrow('INVALID_APPROVAL_SELECTION');
 });
 test('HR cannot create employee profiles from unverified business contacts',()=>{
  expect(()=>prepareImportIntent({proposal,workspaceId:A,target:'hr',approvedIndices:[0]})).toThrow('HR_EMPLOYEE_LINK_REVIEW_REQUIRED');
 });
});
