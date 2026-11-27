'use strict';
// Customer-owned local SQLite persistence; identity and memberships come from a trusted host.
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function context(workspaceId,actorId){
 if(typeof workspaceId!=='string'||!UUID.test(workspaceId))throw Error('WORKSPACE_ID_REQUIRED');
 if(typeof actorId!=='string'||!actorId.trim())throw Error('ACTOR_REQUIRED');
 return workspaceId.toLowerCase();
}
function createSqliteTenantStore({filename,authorize}={}){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||filename===':memory:')throw Error('ABSOLUTE_DB_PATH_REQUIRED');
 if(typeof authorize!=='function')throw Error('TRUSTED_AUTHORIZATION_REQUIRED');
 const db=new DatabaseSync(filename,{timeout:5000});
 db.exec("PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS imported_records (id INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('organization','contact')),name TEXT NOT NULL,record_json TEXT NOT NULL,source_json TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))); CREATE INDEX IF NOT EXISTS idx_imported_records_workspace ON imported_records(workspace_id,id); CREATE TABLE IF NOT EXISTS import_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,record_count INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))); CREATE INDEX IF NOT EXISTS idx_import_audit_workspace ON import_audit(workspace_id,id);");
 const insert=db.prepare('INSERT INTO imported_records(workspace_id,type,name,record_json,source_json,created_by) VALUES(?,?,?,?,?,?)');
 const audit=db.prepare('INSERT INTO import_audit(workspace_id,actor_id,action,record_count) VALUES(?,?,?,?)');
 const read=db.prepare('SELECT id,record_json,source_json,created_at FROM imported_records WHERE workspace_id=? ORDER BY id');
 const readAudit=db.prepare('SELECT id,actor_id,action,record_count,created_at FROM import_audit WHERE workspace_id=? ORDER BY id');
 async function requireAccess(workspaceId,actorId,action){
  const wid=context(workspaceId,actorId);
  if(await authorize({workspaceId:wid,actorId,action})!==true)throw Error('TENANT_ACCESS_DENIED');
  return wid;
 }
 async function commit({workspaceId,actorId,action,entries}={}){
  const wid=await requireAccess(workspaceId,actorId,'import.reviewed');
  if(action!=='import.reviewed'||!Array.isArray(entries)||entries.length<1||entries.length>1000)throw Error('INVALID_IMPORT_BATCH');
  const valid=entries.map(item=>{
   if(!item||!item.record||!['organization','contact'].includes(item.record.type)||typeof item.record.name!=='string'||!item.record.name.trim()||!item.source||typeof item.source!=='object')throw Error('INVALID_IMPORT_RECORD');
   const record=JSON.stringify(item.record),source=JSON.stringify(item.source);
   if(record.length>16384||source.length>4096)throw Error('IMPORT_RECORD_TOO_LARGE');
   return {type:item.record.type,name:item.record.name,record,source};
  });
  db.exec('BEGIN IMMEDIATE');
  try{
   const ids=valid.map(item=>Number(insert.run(wid,item.type,item.name,item.record,item.source,actorId).lastInsertRowid));
   audit.run(wid,actorId,'import.reviewed',ids.length);
   db.exec('COMMIT');
   return {ids};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 async function list({workspaceId,actorId}={}){
  const wid=await requireAccess(workspaceId,actorId,'records.read');
  return read.all(wid).map(row=>({id:row.id,workspace_id:wid,record:JSON.parse(row.record_json),source:JSON.parse(row.source_json),created_at:row.created_at}));
 }
 async function listAudit({workspaceId,actorId}={}){
  const wid=await requireAccess(workspaceId,actorId,'audit.read');
  return readAudit.all(wid);
 }
 return {commit,list,listAudit,close:()=>db.close()};
}
module.exports={createSqliteTenantStore};
