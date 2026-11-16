/** @jest-environment node */
'use strict';
const { generateKeyPairSync, verify } = require('node:crypto');
const { signMakkinMappingProof } = require('../../lib/company-programs/makkin-mapping-proof');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const pem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
const input={
 workspaceLinkId:'11111111-1111-4111-8111-111111111111',
 bondsUserId:'22222222-2222-4222-8222-222222222222',
 makkinTenantId:'tenant-a',makkinUserId:'user-a',programKey:'hr',
 email:'Verified@example.org',emailConfirmed:true
};
test('BONDS produces a 40-second signed identity proof, not an SCC login token',()=>{
 const assertion=signMakkinMappingProof(input,pem,1000*1000);
 const [data,sig]=assertion.split('.');
 expect(verify(null,Buffer.from(data),publicKey,Buffer.from(sig,'base64url'))).toBe(true);
 const payload=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));
 expect(payload).toMatchObject({
   iss:'bonds-global',aud:'scc380:mapping-verification',
   purpose:'verify-identity-only',iat:1000,exp:1040,
   email:'verified@example.org',tenantId:'tenant-a',userId:'user-a',
   programKey:'hr'
 });
 expect(payload).not.toHaveProperty('accessToken');
 expect(payload).not.toHaveProperty('refreshToken');
});
test('proof does not allow arbitrary program or unverified email claims',()=>{
 for(const change of [
  {programKey:'all'}, {emailConfirmed:false},
  {bondsUserId:'not-uuid'}, {makkinTenantId:''},
  {workspaceLinkId:'other'}, {email:'invalid'},
 ])expect(()=>signMakkinMappingProof({...input,...change},pem)).toThrow();
});
test('missing signing key fails closed',()=>{
 expect(()=>signMakkinMappingProof(input,'')).toThrow('BRIDGE_SIGNING_NOT_CONFIGURED');
});
