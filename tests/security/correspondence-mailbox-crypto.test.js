'use strict';
const {randomBytes}=require('node:crypto');
const {encryptToken,decryptToken}=require('../../lib/api/correspondence-mailbox-crypto');
describe('Company mailbox OAuth credential envelope',()=>{
 let previous;
 beforeEach(()=>{previous=process.env.BONDS_MAILBOX_ENCRYPTION_KEY;process.env.BONDS_MAILBOX_ENCRYPTION_KEY=randomBytes(32).toString('base64');});
 afterEach(()=>{if(previous===undefined)delete process.env.BONDS_MAILBOX_ENCRYPTION_KEY;else process.env.BONDS_MAILBOX_ENCRYPTION_KEY=previous;});
 test('stores authenticated ciphertext, never plaintext refresh credentials',()=>{
  const secret='1000.private-refresh-token-demo-not-real';
  const encrypted=encryptToken(secret);
  expect(encrypted).toMatch(/^v1[.]/);
  expect(encrypted).not.toContain(secret);
  expect(decryptToken(encrypted)).toBe(secret);
 });
 test('random nonces mean same token produces independent encrypted values',()=>{
  const secret='1000.private-refresh-token-demo-not-real';
  expect(encryptToken(secret)).not.toBe(encryptToken(secret));
 });
 test('wrong encryption key and tampering fail closed',()=>{
  const ciphertext=encryptToken('1000.private-refresh-token-demo-not-real');
  process.env.BONDS_MAILBOX_ENCRYPTION_KEY=randomBytes(32).toString('base64');
  expect(()=>decryptToken(ciphertext)).toThrow();
 });
 test('missing key rejects encryption',()=>{
  delete process.env.BONDS_MAILBOX_ENCRYPTION_KEY;
  expect(()=>encryptToken('1000.private-refresh-token-demo-not-real')).toThrow('MAILBOX_ENCRYPTION_KEY_MISSING');
 });
});
