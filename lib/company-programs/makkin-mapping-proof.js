'use strict';
const {createPrivateKey, sign, randomUUID} = require('node:crypto');
const {PROGRAMS} = require('./catalog');
const KEYS=new Set(PROGRAMS.map(p=>p.key));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function signMakkinMappingProof(input, privateKeyPem, now=Date.now()){
  if(!privateKeyPem || typeof privateKeyPem!=='string')throw Error('BRIDGE_SIGNING_NOT_CONFIGURED');
  if(!input || !UUID.test(input.workspaceLinkId) || !UUID.test(input.bondsUserId) ||
     !input.makkinTenantId || !input.makkinUserId ||
     typeof input.makkinTenantId!=='string'||input.makkinTenantId.length>128||
     typeof input.makkinUserId!=='string'||input.makkinUserId.length>128||
     !KEYS.has(input.programKey) ||
     typeof input.email!=='string'||input.email.length>254||
     !/^[^@\s]+@[^@\s]+$/.test(input.email)||input.emailConfirmed!==true ||
     !Number.isFinite(now)) throw Error('BRIDGE_PROOF_INVALID');
  const key=createPrivateKey(privateKeyPem.replace(/\\n/g,'\n'));
  if(key.asymmetricKeyType!=='ed25519')throw Error('BRIDGE_KEY_TYPE_INVALID');
  const iat=Math.floor(now/1000);
  const claims={
    iss:'bonds-global',aud:'scc380:mapping-verification',purpose:'verify-identity-only',
    workspaceLinkId:input.workspaceLinkId,bondsUserId:input.bondsUserId,
    tenantId:input.makkinTenantId,userId:input.makkinUserId,
    programKey:input.programKey,email:input.email.trim().toLowerCase(),
    emailConfirmed:true,iat,exp:iat+40,jti:randomUUID()
  };
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature=sign(null,Buffer.from(payload,'utf8'),key).toString('base64url');
  return payload+'.'+signature;
}
module.exports={signMakkinMappingProof};
