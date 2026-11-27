'use strict';
// Customer-owned, local identity provider. Provisioning is offline-only.
// Host MUST never expose createUser or disableUser as unauthenticated API routes.
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path'),crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES=new Set(['owner','admin','reviewer','viewer']);
function createLocalIdentityStore({filename}={}){
 if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('ABSOLUTE_DB_PATH_REQUIRED');
 const db=new DatabaseSync(filename,{timeout:5000});
 db.exec("PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS commercial_users(actor_id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,password_salt BLOB NOT NULL,password_hash BLOB NOT NULL,active INTEGER NOT NULL CHECK(active IN (0,1)),created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))); CREATE TABLE IF NOT EXISTS commercial_memberships(workspace_id TEXT NOT NULL,actor_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','admin','reviewer','viewer')),active INTEGER NOT NULL CHECK(active IN (0,1)),PRIMARY KEY(workspace_id,actor_id),FOREIGN KEY(actor_id) REFERENCES commercial_users(actor_id));");
 const find=db.prepare('SELECT actor_id,password_salt,password_hash,active FROM commercial_users WHERE username=?');
 const member=db.prepare('SELECT workspace_id,actor_id,role,active FROM commercial_memberships WHERE workspace_id=? AND actor_id=?');
 function countUsers(){return db.prepare('SELECT COUNT(*) AS n FROM commercial_users').get().n}
 function createUser({username,password,workspaceId,role='viewer',actorId=crypto.randomUUID()}={}){
  if(typeof username!=='string'||!/^[a-zA-Z0-9._@-]{3,100}$/.test(username))throw Error('INVALID_USERNAME');
  if(typeof password!=='string'||password.length<16||password.length>512)throw Error('WEAK_PASSWORD');
  if(!UUID.test(workspaceId||'')||!UUID.test(actorId||'')||!ROLES.has(role))throw Error('INVALID_MEMBER');
  const salt=crypto.randomBytes(16),hash=crypto.scryptSync(password,salt,64);
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare('INSERT INTO commercial_users(actor_id,username,password_salt,password_hash,active) VALUES(?,?,?,?,1)').run(actorId,username,salt,hash);
   db.prepare('INSERT INTO commercial_memberships(workspace_id,actor_id,role,active) VALUES(?,?,?,1)').run(workspaceId.toLowerCase(),actorId,role);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
  return Object.freeze({actor_id:actorId,workspace_id:workspaceId.toLowerCase(),role});
 }
 function addMembership({workspaceId,actorId,role='viewer'}={}){
  if(!UUID.test(workspaceId||'')||!UUID.test(actorId||'')||!ROLES.has(role))throw Error('INVALID_MEMBER');
  db.prepare('INSERT INTO commercial_memberships(workspace_id,actor_id,role,active) VALUES(?,?,?,1)').run(workspaceId.toLowerCase(),actorId,role);
 }
 function setMembershipActive({workspaceId,actorId,active}={}){
  if(!UUID.test(workspaceId||'')||!UUID.test(actorId||'')||typeof active!=='boolean')throw Error('INVALID_MEMBER');
  const result=db.prepare('UPDATE commercial_memberships SET active=? WHERE workspace_id=? AND actor_id=?').run(active?1:0,workspaceId.toLowerCase(),actorId);
  if(result.changes!==1)throw Error('MEMBER_NOT_FOUND');
 }
 async function verifyCredentials({username,password}={}){
  if(typeof username!=='string'||typeof password!=='string'||username.length>150||password.length>512)return null;
  const user=find.get(username);
  // Constant-cost verification for unknown users too.
  const salt=user?.password_salt||Buffer.alloc(16,0),expected=user?.password_hash||Buffer.alloc(64,0);
  const computed=crypto.scryptSync(password,salt,64);
  if(!user||user.active!==1||!crypto.timingSafeEqual(computed,expected))return null;
  return user.actor_id;
 }
 async function getMembership({workspaceId,actorId}={}){
  if(!UUID.test(workspaceId||'')||!UUID.test(actorId||''))return null;
  const user=db.prepare('SELECT active FROM commercial_users WHERE actor_id=?').get(actorId);
  if(!user||user.active!==1)return null;
  const row=member.get(workspaceId.toLowerCase(),actorId);
  if(!row)return null;
  return {workspace_id:row.workspace_id,actor_id:row.actor_id,role:row.role,active:row.active===1};
 }
 return {countUsers,createUser,addMembership,setMembershipActive,verifyCredentials,getMembership,close:()=>db.close()};
}
module.exports={createLocalIdentityStore};
