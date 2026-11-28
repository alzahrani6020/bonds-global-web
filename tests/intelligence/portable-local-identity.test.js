'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createLocalIdentityStore}=require('../../lib/portable-intelligence/local-identity');
const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
describe('persistent offline identity and tenant membership',()=>{
 test('salted password readback, per-company roles, revocation and no plaintext passwords',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-local-identity-'));
  const filename=path.join(dir,'customer.sqlite');
  let auth=createLocalIdentityStore({filename});
  try{
   const owner=auth.createUser({username:'owner',password:'strong-isolated-passphrase-2026',workspaceId:A,role:'owner'});
   const viewer=auth.createUser({username:'viewer',password:'different-isolated-passphrase',workspaceId:B,role:'viewer'});
   expect(await auth.verifyCredentials({username:'owner',password:'wrong'})).toBeNull();
   expect(await auth.verifyCredentials({username:'missing',password:'not-valid'})).toBeNull();
   expect(await auth.verifyCredentials({username:'owner',password:'strong-isolated-passphrase-2026'})).toBe(owner.actor_id);
   expect(await auth.getMembership({workspaceId:B,actorId:owner.actor_id})).toBeNull();
   expect((await auth.getMembership({workspaceId:A,actorId:owner.actor_id})).role).toBe('owner');
   expect((await auth.getMembership({workspaceId:B,actorId:viewer.actor_id})).role).toBe('viewer');
   auth.setMembershipActive({workspaceId:A,actorId:owner.actor_id,active:false});
   expect((await auth.getMembership({workspaceId:A,actorId:owner.actor_id})).active).toBe(false);
   auth.close();
   auth=createLocalIdentityStore({filename});
   expect((await auth.getMembership({workspaceId:A,actorId:owner.actor_id})).active).toBe(false);
   expect(await auth.verifyCredentials({username:'owner',password:'strong-isolated-passphrase-2026'})).toBe(owner.actor_id);
   expect(fs.readFileSync(filename).includes(Buffer.from('strong-isolated-passphrase-2026'))).toBe(false);
  }finally{auth.close();fs.rmSync(dir,{recursive:true,force:true})}
 });
 test('disallows short passwords, invalid roles and duplicate usernames',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-local-identity-'));
  const auth=createLocalIdentityStore({filename:path.join(dir,'customer.sqlite')});
  try{
   expect(()=>auth.createUser({username:'alice',password:'123',workspaceId:A,role:'owner'})).toThrow('WEAK_PASSWORD');
   expect(()=>auth.createUser({username:'alice',password:'strong-isolated-passphrase-2026',workspaceId:A,role:'superuser'})).toThrow('INVALID_MEMBER');
   auth.createUser({username:'alice',password:'strong-isolated-passphrase-2026',workspaceId:A,role:'owner'});
   expect(()=>auth.createUser({username:'alice',password:'strong-isolated-passphrase-2026',workspaceId:A,role:'owner'})).toThrow();
   expect(auth.countUsers()).toBe(1);
  }finally{auth.close();fs.rmSync(dir,{recursive:true,force:true})}
 });
});
