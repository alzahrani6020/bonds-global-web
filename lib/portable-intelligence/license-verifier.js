'use strict';
// Offline verification only. No license issuance, billing, hardware binding or revocation.
const crypto=require('node:crypto');
function verifyLicense({token,publicKey,workspaceId,now=Date.now()}={}){
 if(typeof token!=='string'||token.length>8192||!token.includes('.'))throw Error('INVALID_LICENSE');
 const pieces=token.split('.');if(pieces.length!==2||!pieces.every(x=>/^[a-zA-Z0-9_-]+$/.test(x)))throw Error('INVALID_LICENSE');
 if(typeof publicKey!=='string')throw Error('LICENSE_PUBLIC_KEY_REQUIRED');
 const payload=Buffer.from(pieces[0],'base64url');let data;
 try{data=JSON.parse(payload.toString('utf8'))}catch{throw Error('INVALID_LICENSE')}
 if(data.version!==1||data.workspace_id!==workspaceId||!Number.isSafeInteger(data.expires_at)||!Array.isArray(data.features)||data.features.some(x=>typeof x!=='string'))throw Error('INVALID_LICENSE_SCOPE');
 if(!crypto.verify(null,payload,publicKey,Buffer.from(pieces[1],'base64url')))throw Error('LICENSE_SIGNATURE_INVALID');
 if(data.expires_at*1000<=now)throw Error('LICENSE_EXPIRED');
 return Object.freeze({workspace_id:data.workspace_id,expires_at:data.expires_at,features:[...data.features]});
}
module.exports={verifyLicense};
