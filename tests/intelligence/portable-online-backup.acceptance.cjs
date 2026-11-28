'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createCommercialWorkflow}=require('../../lib/portable-intelligence/commercial-workflow');
const {restoreEncryptedBackup}=require('../../lib/portable-intelligence/encrypted-backup');
const A='12345678-1234-4123-8123-1234567890ab';
test('online consistent snapshot, encrypted restore and tenant-authorized backup',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-online-backup-'));
 const filename=path.join(dir,'source.sqlite'),out=path.join(dir,'snapshot.enc'),restored=path.join(dir,'restored.sqlite');
 const key=crypto.randomBytes(32),passphrase='isolated-recovery-test-passphrase-2026';
 const getMembership=async({workspaceId,actorId})=>({workspace_id:workspaceId,actor_id:actorId,role:actorId==='owner'?'owner':'viewer',active:true});
 let wf=createCommercialWorkflow({filename,getMembership,encryptionKey:key});
 try{
  const data=await wf.analyze({workspaceId:A,actorId:'owner',file:{filename:'customer.html',buffer:Buffer.from('<p>اسم الشركة: شركة مميزة</p>')}});
  const proposal=wf.prepareEntityReview({workspaceId:A,analysis:data,identity:{type:'organization',name:'شركة مميزة'}});
  await wf.approve({workspaceId:A,actorId:'owner',proposal,approvedIndices:[0]});
  await assert.rejects(wf.backup({workspaceId:A,actorId:'viewer',destination:out,passphrase,tempRoot:dir}),/TENANT_ACCESS_DENIED/);
  assert.equal(fs.existsSync(out),false);
  const result=await wf.backup({workspaceId:A,actorId:'owner',destination:out,passphrase,tempRoot:dir});
  assert.equal(result.mode,'consistent-live-snapshot');assert.ok(fs.statSync(out).size>100);
  assert.equal(fs.readFileSync(out).includes(Buffer.from('شركة مميزة')),false);
  await assert.rejects(Promise.resolve().then(()=>restoreEncryptedBackup({source:out,destination:restored,passphrase:'invalid-recovery-passphrase-2026'})),/BACKUP_AUTHENTICATION_FAILED/);
  assert.equal(fs.existsSync(restored),false);
  restoreEncryptedBackup({source:out,destination:restored,passphrase});
  const recovered=createCommercialWorkflow({filename:restored,getMembership,encryptionKey:key});
  try{
   const rows=await recovered.list({workspaceId:A,actorId:'owner'});
   assert.equal(rows.length,1);
   assert.equal(rows[0].record.name,'شركة مميزة');
   assert.equal((await recovered.audit({workspaceId:A,actorId:'owner'})).filter(x=>x.action==='import.reviewed').length,1);
  }finally{recovered.close()}
  assert.equal((await wf.audit({workspaceId:A,actorId:'owner'})).at(-1).action,'database.encrypted_backup');
  const scratch=fs.readdirSync(dir).filter(x=>x.startsWith('bonds-online-backup-'));
  assert.deepEqual(scratch,[]);
 }finally{wf.close();fs.rmSync(dir,{recursive:true,force:true})}
});
