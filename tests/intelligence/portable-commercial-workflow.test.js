'use strict';
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createCommercialWorkflow}=require('../../lib/portable-intelligence/commercial-workflow');
const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-commercial-workflow-'));
 const members=new Map([
  ['alice:'+A,{workspace_id:A,actor_id:'alice',role:'owner',active:true}],
  ['bob:'+B,{workspace_id:B,actor_id:'bob',role:'owner',active:true}],
  ['viewer:'+A,{workspace_id:A,actor_id:'viewer',role:'viewer',active:true}]
 ]);
 const workflow=createCommercialWorkflow({filename:path.join(dir,'client.sqlite'),getMembership:async({workspaceId,actorId})=>members.get(actorId+':'+workspaceId)||null});
 return {workflow,cleanup(){workflow.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
function html(name){return Buffer.from('<p>اسم الشركة: '+name+'</p><p>المدينة: جدة</p><p>البريد: sales@company.example</p>')}
describe('complete portable commercial workflow from source to destination intent',()=>{
 test('HTML -> evidence -> explicit review -> SQLite -> search -> edit -> export',async()=>{
  const {workflow,cleanup}=setup();
  try{
   const analysis=await workflow.analyze({workspaceId:A,actorId:'alice',file:{filename:'business.html',buffer:html('شركة الأفق')}});
   expect(analysis.auto_saved).toBe(false);
   expect(analysis.entity_suggestions.candidates.organization_name).toBe('شركة الأفق');
   expect(await workflow.list({workspaceId:A,actorId:'alice'})).toHaveLength(0);
   const proposal=workflow.prepareEntityReview({workspaceId:A,analysis,identity:{type:'organization',name:'شركة الأفق',city:'جدة',sector:'other'}});
   expect(await workflow.duplicates({workspaceId:A,actorId:'alice',proposal})).toEqual([{index:0,matches:[]}]);
   const approved=await workflow.approve({workspaceId:A,actorId:'alice',proposal,approvedIndices:[0]});
   expect(approved.saved).toBe(1);
   const rows=await workflow.search({workspaceId:A,actorId:'alice',query:'الأفق'});
   expect(rows).toHaveLength(1);
   const id=rows[0].id;
   const changed=await workflow.update({workspaceId:A,actorId:'alice',id,changes:{city:'الرياض'}});
   expect(changed.record.city).toBe('الرياض');
   const exportResult=await workflow.exportDirectory({workspaceId:A,actorId:'alice',target:'correspondence',recordIds:[id]});
   expect(exportResult).toMatchObject({send_mail:false,commit_destination:false,create_hr_employee:false});
   expect(exportResult.records[0].city).toBe('الرياض');
   const audit=await workflow.audit({workspaceId:A,actorId:'alice'});
   expect(audit.map(a=>a.action)).toEqual(['import.reviewed','records.update']);
  }finally{cleanup()}
 });
 test('cross-company and viewer cannot approve, edit or export',async()=>{
  const {workflow,cleanup}=setup();
  try{
   const analysis=await workflow.analyze({workspaceId:A,actorId:'alice',file:{filename:'company.html',buffer:html('شركة الأفق')}});
   const proposal=workflow.prepareEntityReview({workspaceId:A,analysis,identity:{type:'organization',name:'شركة الأفق'}});
   await expect(workflow.approve({workspaceId:B,actorId:'bob',proposal,approvedIndices:[0]})).rejects.toThrow('WORKSPACE_MISMATCH');
   await expect(workflow.approve({workspaceId:A,actorId:'viewer',proposal,approvedIndices:[0]})).rejects.toThrow('TENANT_ACCESS_DENIED');
   await expect(workflow.update({workspaceId:A,actorId:'viewer',id:1,changes:{name:'Intruder'}})).rejects.toThrow('TENANT_ACCESS_DENIED');
   await expect(workflow.exportDirectory({workspaceId:B,actorId:'bob',target:'crm',recordIds:[1]})).rejects.toThrow('EXPORT_RECORD_NOT_FOUND');
  }finally{cleanup()}
 });
 test('identical entity requires duplicate decision before second save',async()=>{
  const {workflow,cleanup}=setup();
  try{
   const analysis=await workflow.analyze({workspaceId:A,actorId:'alice',file:{filename:'first.html',buffer:html('شركة الأفق')}});
   const proposal=workflow.prepareEntityReview({workspaceId:A,analysis,identity:{type:'organization',name:'شركة الأفق'}});
   await workflow.approve({workspaceId:A,actorId:'alice',proposal,approvedIndices:[0]});
   await expect(workflow.approve({workspaceId:A,actorId:'alice',proposal,approvedIndices:[0]})).rejects.toThrow('DUPLICATE_REVIEW_REQUIRED');
   expect(await workflow.list({workspaceId:A,actorId:'alice'})).toHaveLength(1);
  }finally{cleanup()}
 });
});
