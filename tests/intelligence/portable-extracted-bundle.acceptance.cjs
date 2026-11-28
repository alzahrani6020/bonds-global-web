'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),crypto=require('node:crypto');
const bundle=process.env.BONDS_EXTRACTED_BUNDLE;
if(!bundle||!path.isAbsolute(bundle))throw Error('BUNDLE_PATH_REQUIRED');
// Never import source-tree modules: use only the extracted customer ZIP.
const {createLocalIdentityStore}=require(path.join(bundle,'local-identity.js'));
const {createCommercialServer}=require(path.join(bundle,'commercial-server.js'));
const {restoreEncryptedBackup}=require(path.join(bundle,'encrypted-backup.js'));
const wid='12345678-1234-4123-8123-1234567890ab';
test('extracted ZIP only: encrypted local auth -> source review -> approved readback -> encrypted backup + isolated restore',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-extracted-bundle-'));
 const filename=path.join(dir,'tenant.sqlite'),backupDirectory=path.join(dir,'backups'),dataKey=crypto.randomBytes(32);
 fs.mkdirSync(backupDirectory,{mode:0o700});
 const identities=createLocalIdentityStore({filename,encryptionKey:dataKey,fullDatabaseEncryption:true});
 const owner=identities.createUser({username:'bundle-owner',password:'customer-bundle-acceptance-2026',workspaceId:wid,role:'owner'});
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const payload=Buffer.from(JSON.stringify({version:1,workspace_id:wid,expires_at:Math.floor(Date.now()/1000)+3600,features:['document-intelligence','backup','crm.export']}));
 const licenseToken=payload.toString('base64url')+'.'+crypto.sign(null,payload,privateKey).toString('base64url');
 const app=createCommercialServer({
  workspaceId:wid,databasePath:filename,encryptionKey:dataKey,fullDatabaseEncryption:true,
  licenseToken,licensePublicKey:publicKey.export({type:'spki',format:'pem'}),
  getMembership:identities.getMembership,verifyCredentials:identities.verifyCredentials,backupDirectory
 });
 let started=false;
 try{
  const url=await app.listen();started=true;
  async function post(endpoint,cookie,payload){
   return fetch(url+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie||''},body:JSON.stringify(payload)});
  }
  const signed=await post('/login','',{username:'bundle-owner',password:'customer-bundle-acceptance-2026'});
  assert.equal(signed.status,200);
  const cookie=signed.headers.get('set-cookie').split(';')[0];
  const html='<p>اسم الشركة: مؤسسة مرجان</p><p>البريد: hello@marjan.example</p>';
  const analyzed=await post('/analyze',cookie,{filename:'organization.html',base64:Buffer.from(html).toString('base64')});
  assert.equal(analyzed.status,200);
  const view=await analyzed.json();
  assert.equal(view.analysis.auto_saved,false);
  const review=await post('/review',cookie,{preview_id:view.preview_id,identity:{type:'organization',name:'مؤسسة مرجان',email:'hello@marjan.example'}});
  assert.equal(review.status,200);
  const approved=await post('/commit',cookie,{preview_id:view.preview_id,approvedIndices:[0],approve:true});
  assert.equal(approved.status,200);
  const readback=await fetch(url+'/records',{headers:{Cookie:cookie}});
  assert.equal(readback.status,200);
  const records=(await readback.json()).items;
  assert.equal(records.length,1);
  assert.equal(records[0].record.name,'مؤسسة مرجان');
  const backed=await post('/backup',cookie,{confirm:true,passphrase:'independent-customer-backup-2026'});
  assert.equal(backed.status,200);
  const info=await backed.json();
  assert.equal(info.encrypted,true);
  assert.equal(fs.existsSync(info.destination),true);
  const restorePath=path.join(dir,'isolated-restored.sqlite');
  restoreEncryptedBackup({source:info.destination,destination:restorePath,passphrase:'independent-customer-backup-2026',databaseEncryptionKey:dataKey});
  assert.ok(fs.statSync(restorePath).size>0);
  assert.equal(fs.readFileSync(restorePath).subarray(0,16).toString('ascii')==='SQLite format 3\0',false);
  const audit=(await (await fetch(url+'/audit',{headers:{Cookie:cookie}})).json()).items;
  assert.deepEqual(audit.map(x=>x.action),['import.reviewed','database.encrypted_backup']);
  assert.equal(owner.workspace_id,wid);
 }finally{
  if(started)await app.close();
  identities.close();
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
