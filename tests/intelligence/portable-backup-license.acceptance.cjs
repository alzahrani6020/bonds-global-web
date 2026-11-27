'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {createEncryptedBackup,restoreEncryptedBackup}=require('../../lib/portable-intelligence/encrypted-backup');
const {verifyLicense}=require('../../lib/portable-intelligence/license-verifier');
test('AES-GCM backup restoration rejects wrong password, corruption and existing target',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-backup-')),dbfile=path.join(dir,'local.sqlite'),archive=path.join(dir,'backup.bondsbk'),restored=path.join(dir,'restored.sqlite');
 try{
  const db=new DatabaseSync(dbfile);db.exec("CREATE TABLE organizations(name TEXT); INSERT INTO organizations VALUES('Factory A')");db.close();
  assert.ok(createEncryptedBackup({databasePath:dbfile,destination:archive,passphrase:'a-long-test-passphrase-123'}).encrypted_bytes>0);
  assert.equal(fs.readFileSync(archive).includes(Buffer.from('Factory A')),false);
  assert.throws(()=>restoreEncryptedBackup({source:archive,destination:restored,passphrase:'incorrect-password-123'}),/BACKUP_AUTHENTICATION_FAILED/);
  assert.equal(fs.existsSync(restored),false);
  restoreEncryptedBackup({source:archive,destination:restored,passphrase:'a-long-test-passphrase-123'});
  const check=new DatabaseSync(restored,{readOnly:true});assert.equal(check.prepare('SELECT name FROM organizations').get().name,'Factory A');check.close();
  assert.throws(()=>restoreEncryptedBackup({source:archive,destination:restored,passphrase:'a-long-test-passphrase-123'}),/EEXIST/);
  const bytes=fs.readFileSync(archive);bytes[bytes.length-1]^=1;
  const tampered=path.join(dir,'tampered.bondsbk');fs.writeFileSync(tampered,bytes);
  assert.throws(()=>restoreEncryptedBackup({source:tampered,destination:path.join(dir,'tampered.sqlite'),passphrase:'a-long-test-passphrase-123'}),/BACKUP_AUTHENTICATION_FAILED/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('signed offline tenant license rejects cross-tenant, expired and forged licenses',()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
 const key=publicKey.export({type:'spki',format:'pem'});
 const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
 const body=Buffer.from(JSON.stringify({version:1,workspace_id:A,expires_at:1900000000,features:['crm','correspondence']}));
 const token=body.toString('base64url')+'.'+crypto.sign(null,body,privateKey).toString('base64url');
 assert.deepEqual(verifyLicense({token,publicKey:key,workspaceId:A,now:1800000000000}).features,['crm','correspondence']);
 assert.throws(()=>verifyLicense({token,publicKey:key,workspaceId:B,now:1800000000000}),/INVALID_LICENSE_SCOPE/);
 assert.throws(()=>verifyLicense({token,publicKey:key,workspaceId:A,now:2000000000000}),/LICENSE_EXPIRED/);
 const forged=Buffer.from(JSON.stringify({version:1,workspace_id:A,expires_at:1900000001,features:['crm']})).toString('base64url')+'.'+token.split('.')[1];
 assert.throws(()=>verifyLicense({token:forged,publicKey:key,workspaceId:A,now:1800000000000}),/LICENSE_SIGNATURE_INVALID/);
});
