'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createLicensedCommercialWorkflow}=require('../../lib/portable-intelligence/licensed-commercial-workflow');
const A='12345678-1234-4123-8123-1234567890ab';
function signed({workspaceId=A,expires_at=Math.floor(Date.now()/1000)+3600,features=['document-intelligence']}={}){
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const payload=Buffer.from(JSON.stringify({version:1,workspace_id:workspaceId,expires_at,features}));
 const signature=crypto.sign(null,payload,privateKey);
 return {licenseToken:payload.toString('base64url')+'.'+signature.toString('base64url'),licensePublicKey:publicKey.export({type:'spki',format:'pem'})};
}
function setup(options){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-licensed-'));
 try{
  const workflow=createLicensedCommercialWorkflow({filename:path.join(dir,'local.sqlite'),workspaceId:A,getMembership:async({workspaceId,actorId})=>({workspace_id:workspaceId,actor_id:actorId,active:true,role:'owner'}),...options});
  return {workflow,cleanup(){workflow.close();fs.rmSync(dir,{recursive:true,force:true})}};
 }catch(e){fs.rmSync(dir,{recursive:true,force:true});throw e}
}
describe('commercial licensing is enforced across operations',()=>{
 test('valid signed scope permits directory read but not unlicensed CRM export',async()=>{
  const {workflow,cleanup}=setup(signed());
  try{
   await expect(workflow.list({workspaceId:A,actorId:'owner'})).resolves.toEqual([]);
   await expect(workflow.exportDirectory({workspaceId:A,actorId:'owner',target:'crm',recordIds:[1]})).rejects.toThrow('LICENSE_FEATURE_DENIED');
  }finally{cleanup()}
 });
 test('denies a request for another workspace before SQL access',async()=>{
  const {workflow,cleanup}=setup(signed());
  try{await expect(workflow.list({workspaceId:'12345678-1234-4123-8123-1234567890ac',actorId:'owner'})).rejects.toThrow('LICENSE_WORKSPACE_MISMATCH')}
  finally{cleanup()}
 });
 test('expired or foreign scope cannot initialize',()=>{
  expect(()=>setup(signed({expires_at:Math.floor(Date.now()/1000)-60}))).toThrow('LICENSE_EXPIRED');
  expect(()=>setup(signed({workspaceId:'12345678-1234-4123-8123-1234567890ac'}))).toThrow('INVALID_LICENSE_SCOPE');
 });
 test('denies tampered signature',()=>{
  const token=signed();token.licenseToken=token.licenseToken.slice(0,-1)+(token.licenseToken.endsWith('A')?'B':'A');
  expect(()=>setup(token)).toThrow('LICENSE_SIGNATURE_INVALID');
 });
});
