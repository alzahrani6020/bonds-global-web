'use strict';
// Vendor-side only. Never package a private signing key with the customer app.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_FEATURES=new Set(['document-intelligence','crm.export','correspondence.export','hr.export','backup']);
function issueLicense({workspaceId,expiresAt,features,privateKeyPem,licenseId=crypto.randomUUID(),issuedAt=Math.floor(Date.now()/1000)}={}){
 if(!UUID.test(workspaceId||'')||!UUID.test(licenseId||''))throw Error('INVALID_LICENSE_IDENTITY');
 if(!Number.isSafeInteger(expiresAt)||!Number.isSafeInteger(issuedAt)||expiresAt<=issuedAt)throw Error('INVALID_LICENSE_PERIOD');
 if(!Array.isArray(features)||!features.length||new Set(features).size!==features.length||features.some(x=>!ALLOWED_FEATURES.has(x)))throw Error('INVALID_LICENSE_FEATURES');
 if(typeof privateKeyPem!=='string'||!privateKeyPem.includes('PRIVATE KEY'))throw Error('PRIVATE_KEY_REQUIRED');
 const payload=Buffer.from(JSON.stringify({version:1,workspace_id:workspaceId.toLowerCase(),license_id:licenseId.toLowerCase(),issued_at:issuedAt,expires_at:expiresAt,features}));
 let signature;
 try{signature=crypto.sign(null,payload,privateKeyPem)}catch{throw Error('INVALID_SIGNING_KEY')}
 return {token:payload.toString('base64url')+'.'+signature.toString('base64url'),licenseId,workspaceId,expiresAt,features};
}
function run(args,env=process.env){
 const get=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
 const keyPath=get('--key'),output=get('--out'),workspaceId=get('--workspace'),expires=get('--expires');
 const features=String(get('--features')||'').split(',').filter(Boolean);
 if(!keyPath||!output||!workspaceId||!expires||!path.isAbsolute(keyPath)||!path.isAbsolute(output))throw Error('ABSOLUTE_PATHS_REQUIRED');
 const pem=fs.readFileSync(keyPath,'utf8');
 const signed=issueLicense({workspaceId,expiresAt:Number(expires),features,privateKeyPem:pem});
 fs.writeFileSync(output,signed.token+'\n',{flag:'wx',mode:0o600});
 return {license_id:signed.licenseId,output};
}
if(require.main===module){
 try{const result=run(process.argv.slice(2));process.stdout.write('LICENSE_CREATED: '+result.license_id+'\n')}
 catch(e){process.stderr.write('ERROR: '+e.message+'\n');process.exitCode=1}
}
module.exports={issueLicense,run};
