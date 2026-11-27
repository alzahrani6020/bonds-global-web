'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createLocalIdentityStore}=require('../../lib/portable-intelligence/local-identity');
const {createCommercialWorkflow}=require('../../lib/portable-intelligence/commercial-workflow');
const {restoreEncryptedBackup}=require('../../lib/portable-intelligence/encrypted-backup');
const WID='12345678-1234-4123-8123-1234567890ab';
test('SQLCipher encrypted entire SQLite file persists customer users, records and audit without plaintext header',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-cipher-'));
 const filename=path.join(dir,'company.sqlite'),key=crypto.randomBytes(32);
 let identity=createLocalIdentityStore({filename,encryptionKey:key,fullDatabaseEncryption:true});
 let workflow=null;
 try{
  const user=identity.createUser({username:'company-owner',password:'standalone-strong-pass-2026',workspaceId:WID,role:'owner'});
  workflow=createCommercialWorkflow({filename,encryptionKey:key,fullDatabaseEncryption:true,getMembership:identity.getMembership});
  const data=await workflow.analyze({workspaceId:WID,actorId:user.actor_id,file:{filename:'company.html',buffer:Buffer.from('<p>اسم الشركة: شركة تجريبية خاصة</p><p>البريد: secret@private.example</p>')}});
  const proposal=workflow.prepareEntityReview({workspaceId:WID,analysis:data,identity:{type:'organization',name:'شركة تجريبية خاصة',email:'secret@private.example'}});
  await workflow.approve({workspaceId:WID,actorId:user.actor_id,proposal,approvedIndices:[0]});
  assert.equal((await workflow.list({workspaceId:WID,actorId:user.actor_id})).length,1);
  const backupFile=path.join(dir,'full-cipher.backup.enc'),restoredFile=path.join(dir,'restored-cipher.sqlite');
  const result=await workflow.backup({workspaceId:WID,actorId:user.actor_id,destination:backupFile,passphrase:'independent-restore-passphrase-2026',tempRoot:dir});
  assert.equal(result.cipher_database,true);
  assert.equal(fs.readFileSync(backupFile).includes(Buffer.from('company-owner')),false);
  restoreEncryptedBackup({source:backupFile,destination:restoredFile,passphrase:'independent-restore-passphrase-2026',databaseEncryptionKey:key});
  const restored=createCommercialWorkflow({filename:restoredFile,encryptionKey:key,fullDatabaseEncryption:true,getMembership:identity.getMembership});
  try{assert.equal((await restored.list({workspaceId:WID,actorId:user.actor_id})).length,1)}finally{restored.close()}

  workflow.close();workflow=null;identity.close();identity=null;
  const raw=fs.readFileSync(filename);
  assert.notEqual(raw.subarray(0,16).toString('ascii'),'SQLite format 3\0');
  for(const secret of ['company-owner','شركة تجريبية خاصة','secret@private.example'])assert.equal(raw.includes(Buffer.from(secret)),false);
  assert.throws(()=>createLocalIdentityStore({filename,encryptionKey:crypto.randomBytes(32),fullDatabaseEncryption:true}),/ENCRYPTED_DATABASE_OPEN_FAILED/);
  assert.throws(()=>createLocalIdentityStore({filename,encryptionKey:null,fullDatabaseEncryption:true}),/FULL_DATABASE_KEY_REQUIRED/);
  assert.throws(()=>createLocalIdentityStore({filename}),/not a database|SQLITE_NOTADB|database is encrypted/i);
  identity=createLocalIdentityStore({filename,encryptionKey:key,fullDatabaseEncryption:true});
  assert.equal(await identity.verifyCredentials({username:'company-owner',password:'standalone-strong-pass-2026'}),user.actor_id);
  workflow=createCommercialWorkflow({filename,encryptionKey:key,fullDatabaseEncryption:true,getMembership:identity.getMembership});
  const rows=await workflow.search({workspaceId:WID,actorId:user.actor_id,query:'تجريبية'});
  assert.equal(rows.length,1);
  assert.equal((await workflow.audit({workspaceId:WID,actorId:user.actor_id})).length,1);
 }finally{try{workflow?.close()}catch{}try{identity?.close()}catch{}fs.rmSync(dir,{recursive:true,force:true})}
});
