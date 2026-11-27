'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createCommercialWorkflow}=require('../../lib/portable-intelligence/commercial-workflow');
const A='12345678-1234-4123-8123-1234567890ab';
describe('AES-256-GCM encrypted commercial fields, keyed names, and recovery behavior',()=>{
 test('names, email and provenance stay encrypted at rest; read back with correct key',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-field-crypto-'));
  const filename=path.join(dir,'sensitive.sqlite'),key=crypto.randomBytes(32);
  const getMembership=async({workspaceId,actorId})=>({workspace_id:workspaceId,actor_id:actorId,role:'owner',active:true});
  let wf=createCommercialWorkflow({filename,getMembership,encryptionKey:key});
  try{
   const analyzed=await wf.analyze({workspaceId:A,actorId:'owner',file:{filename:'client.html',buffer:Buffer.from('<p>اسم الشركة: شركة سرية</p><p>البريد: secret@example.org</p>')}});
   const proposal=wf.prepareEntityReview({workspaceId:A,analysis:analyzed,identity:{type:'organization',name:'شركة سرية',email:'secret@example.org'}});
   await wf.approve({workspaceId:A,actorId:'owner',proposal,approvedIndices:[0]});
   const existing=await wf.list({workspaceId:A,actorId:'owner'});
   expect(existing[0].record).toMatchObject({name:'شركة سرية',email:'secret@example.org'});
   const raw=fs.readFileSync(filename);
   for(const text of ['شركة سرية','secret@example.org','client.html'])expect(raw.includes(Buffer.from(text))).toBe(false);
   wf.close();wf=null;
   const reopened=createCommercialWorkflow({filename,getMembership,encryptionKey:key});
   expect((await reopened.search({workspaceId:A,actorId:'owner',query:'سرية'}))).toHaveLength(1);
   await expect(reopened.approve({workspaceId:A,actorId:'owner',proposal,approvedIndices:[0]})).rejects.toThrow('DUPLICATE_REVIEW_REQUIRED');
   reopened.close();
   expect(()=>createCommercialWorkflow({filename,getMembership,encryptionKey:crypto.randomBytes(32)})).toThrow('RECORD_INTEGRITY_FAILED');
   expect(()=>createCommercialWorkflow({filename,getMembership,encryptionKey:null})).not.toThrow();
  }finally{try{wf?.close()}catch{}fs.rmSync(dir,{recursive:true,force:true})}
 });
 test('plaintext imported data cannot silently become encrypted without explicit migration',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-field-crypto-'));
  const filename=path.join(dir,'store.sqlite');
  const getMembership=async({workspaceId,actorId})=>({workspace_id:workspaceId,actor_id:actorId,role:'owner',active:true});
  let wf=createCommercialWorkflow({filename,getMembership});
  try{
   const a=await wf.analyze({workspaceId:A,actorId:'owner',file:{filename:'company.html',buffer:Buffer.from('<p>اسم الشركة: شركة عامة</p>')}});
   const p=wf.prepareEntityReview({workspaceId:A,analysis:a,identity:{type:'organization',name:'شركة عامة'}});
   await wf.approve({workspaceId:A,actorId:'owner',proposal:p,approvedIndices:[0]});
   wf.close();wf=null;
   expect(()=>createCommercialWorkflow({filename,getMembership,encryptionKey:crypto.randomBytes(32)})).toThrow('PLAINTEXT_DATABASE_MIGRATION_REQUIRED');
  }finally{try{wf?.close()}catch{}fs.rmSync(dir,{recursive:true,force:true})}
 });
});
