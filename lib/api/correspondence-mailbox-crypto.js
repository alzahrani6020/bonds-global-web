'use strict';
const {createCipheriv,createDecipheriv,randomBytes}=require('node:crypto');
function loadKey(){
 const raw=process.env.BONDS_MAILBOX_ENCRYPTION_KEY;
 if(!raw||!/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=?$/.test(raw)) {
   // Key validation is checked again by decoded length to support 32-byte base64.
   if(!raw||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw new Error('MAILBOX_ENCRYPTION_KEY_MISSING');
 }
 const key=Buffer.from(raw,'base64');
 if(key.length!==32)throw new Error('MAILBOX_ENCRYPTION_KEY_INVALID');
 return key;
}
function encryptToken(token){
 if(typeof token!=='string'||token.length<10||token.length>4096)throw new Error('INVALID_REFRESH_TOKEN');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',loadKey(),iv);
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return 'v1.'+iv.toString('base64url')+'.'+cipher.getAuthTag().toString('base64url')+'.'+encrypted.toString('base64url');
}
function decryptToken(envelope){
 const parts=String(envelope||'').split('.');
 if(parts.length!==4||parts[0]!=='v1')throw new Error('INVALID_TOKEN_ENVELOPE');
 const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[2],'base64url'),value=Buffer.from(parts[3],'base64url');
 if(iv.length!==12||tag.length!==16||!value.length)throw new Error('INVALID_TOKEN_ENVELOPE');
 const decipher=createDecipheriv('aes-256-gcm',loadKey(),iv);
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(value),decipher.final()]).toString('utf8');
}
module.exports={encryptToken,decryptToken};
