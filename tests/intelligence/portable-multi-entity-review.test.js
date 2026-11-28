'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCommercialWorkflow}=require('../../lib/portable-intelligence/commercial-workflow');
const A='12345678-1234-4123-8123-1234567890ab';
describe('portable multi-entity source provenance and review',()=>{
 test('separates organizations and their explicitly labeled contacts',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-multiple-'));
  const wf=createCommercialWorkflow({filename:path.join(dir,'store.sqlite'),getMembership:async({workspaceId,actorId})=>({workspace_id:workspaceId,actor_id:actorId,active:true,role:'owner'})});
  try{
   const html='<section><p>اسم الشركة: شركة الأول</p><p>البريد: first@example.org</p><p>المدينة: جدة</p><p>اسم الشركة: شركة الثاني</p><p>البريد: second@example.org</p><p>المدينة: الرياض</p></section>';
   const data=await wf.analyze({workspaceId:A,actorId:'owner',file:{filename:'two.html',buffer:Buffer.from(html)}});
   const candidates=data.entity_suggestions.items;
   expect(candidates).toHaveLength(2);
   expect(candidates[0].fields).toMatchObject({email:'first@example.org',city:'جدة'});
   expect(candidates[1].fields).toMatchObject({email:'second@example.org',city:'الرياض'});
   await expect(()=>wf.prepareEntityReview({workspaceId:A,analysis:data,entityIndex:1,identity:{type:'organization',name:'شركة الثاني',email:'first@example.org'}})).toThrow('EVIDENCE_MISMATCH');
   const review=wf.prepareEntityReview({workspaceId:A,analysis:data,entityIndex:1,identity:{type:'organization',name:'شركة الثاني',email:'second@example.org',city:'الرياض'}});
   expect(review.items[0].source.evidence.email.line).toBeGreaterThan(review.items[0].source.evidence.name.line);
   await wf.approve({workspaceId:A,actorId:'owner',proposal:review,approvedIndices:[0]});
   const stored=await wf.list({workspaceId:A,actorId:'owner'});
   expect(stored).toHaveLength(1);
   expect(stored[0].record.name).toBe('شركة الثاني');
   expect(stored[0].record.email).toBe('second@example.org');
   expect(stored[0].source.entity_index).toBe(1);
  }finally{wf.close();fs.rmSync(dir,{recursive:true,force:true})}
 });
 test('unlabeled global email never silently assigned to a second organization',async()=>{
  const {analyzeEntities}=require('../../lib/portable-intelligence/entity-intelligence');
  const r=analyzeEntities('اسم الشركة: شركة الأول\ninfo@first.example\nاسم الشركة: شركة الثاني\ninfo@second.example');
  expect(r.items).toHaveLength(2);
  expect(r.items[1].fields.email).toBeUndefined();
  expect(r.records).toEqual([]);
 });
});
