'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {issueLicense,run}=require('../../scripts/issue-portable-commercial-license');
const {verifyLicense}=require('../../lib/portable-intelligence/license-verifier');
const WID='12345678-1234-4123-8123-1234567890ab';
describe('vendor-only customer license issuance',()=>{
 test('signed license verified for assigned tenant and features, with unique license ID',()=>{
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
  const key=privateKey.export({format:'pem',type:'pkcs8'}),pub=publicKey.export({format:'pem',type:'spki'});
  const issuedAt=Math.floor(Date.now()/1000),expiresAt=issuedAt+3600;
  const result=issueLicense({workspaceId:WID,issuedAt,expiresAt,features:['document-intelligence','crm.export'],privateKeyPem:key});
  const verified=verifyLicense({token:result.token,publicKey:pub,workspaceId:WID,now:issuedAt*1000});
  expect(verified.license_id).toBe(result.licenseId);
  expect(verified.features).toEqual(['document-intelligence','crm.export']);
  expect(()=>verifyLicense({token:result.token,publicKey:pub,workspaceId:'12345678-1234-4123-8123-1234567890ac'})).toThrow('INVALID_LICENSE_SCOPE');
 });
 test('issuance fails closed on missing private key, improper features and replayed destination path',()=>{
  const {privateKey}=crypto.generateKeyPairSync('ed25519');
  const pem=privateKey.export({format:'pem',type:'pkcs8'}),expiresAt=Math.floor(Date.now()/1000)+3600;
  expect(()=>issueLicense({workspaceId:WID,expiresAt,features:['all'],privateKeyPem:pem})).toThrow('INVALID_LICENSE_FEATURES');
  expect(()=>issueLicense({workspaceId:WID,expiresAt,features:['document-intelligence']})).toThrow('PRIVATE_KEY_REQUIRED');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-license-'));
  const key=path.join(dir,'private.pem'),out=path.join(dir,'license.token');
  try{
   fs.writeFileSync(key,pem,{mode:0o600});
   const args=['--key',key,'--out',out,'--workspace',WID,'--expires',String(expiresAt),'--features','document-intelligence,hr.export'];
   run(args);
   expect(fs.readFileSync(out,'utf8')).toContain('.');
   expect(()=>run(args)).toThrow(/EEXIST/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 });
});
