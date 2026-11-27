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
function identityKey(type,name){return type+':'+String(name).normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[\u064b-\u065f]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ')}
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
 async function commit({workspaceId,actorId,action,entries,duplicateOverrideReason=null}={}){
  const wid=await requireAccess(workspaceId,actorId,'import.reviewed');
  if(action!=='import.reviewed'||!Array.isArray(entries)||entries.length<1||entries.length>1000)throw Error('INVALID_IMPORT_BATCH');
  const valid=entries.map(item=>{
   if(!item||!item.record||!['organization','contact'].includes(item.record.type)||typeof item.record.name!=='string'||!item.record.name.trim()||!item.source||typeof item.source!=='object')throw Error('INVALID_IMPORT_RECORD');
   const record=JSON.stringify(item.record),source=JSON.stringify(item.source);
   if(record.length>16384||source.length>4096)throw Error('IMPORT_RECORD_TOO_LARGE');
   return {type:item.record.type,name:item.record.name,record,source};
  });
  if(duplicateOverrideReason!==null&&(typeof duplicateOverrideReason!=='string'||duplicateOverrideReason.trim().length<12||duplicateOverrideReason.length>500))throw Error('INVALID_DUPLICATE_OVERRIDE_REASON');
  db.exec('BEGIN IMMEDIATE');
  try{
   // BEGIN IMMEDIATE serializes SQLite writers: avoid a check-then-insert race.
   const existingKeys=new Set(read.all(wid).map(row=>{const record=JSON.parse(row.record_json);return identityKey(record.type,record.name)}));
   const duplicate=valid.some(item=>{const key=identityKey(item.type,item.name);const existed=existingKeys.has(key);existingKeys.add(key);return existed;});
   if(duplicate&&!duplicateOverrideReason)throw Error('DUPLICATE_IN_WORKSPACE');
   if(!duplicate&&duplicateOverrideReason)throw Error('DUPLICATE_OVERRIDE_NOT_APPLICABLE');
   const ids=valid.map(item=>Number(insert.run(wid,item.type,item.name,item.record,item.source,actorId).lastInsertRowid));
   audit.run(wid,actorId,duplicate?'import.reviewed.duplicate_override':'import.reviewed',ids.length);
   db.exec('COMMIT');
   return {ids};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 async function list({workspaceId,actorId}={}){
  const wid=await requireAccess(workspaceId,actorId,'records.read');
  return read.all(wid).map(row=>({id:row.id,workspace_id:wid,record:JSON.parse(row.record_json),source:JSON.parse(row.source_json),created_at:row.created_at}));
 }
 async function search({workspaceId,actorId,query}={}){
  const wid=await requireAccess(workspaceId,actorId,'records.read');
  if(typeof query!=='string'||query.length>200)throw Error('INVALID_SEARCH_QUERY');
  const needle=query.trim().toLocaleLowerCase();
  if(!needle)return [];
  // Scan only rows of the authorized workspace. Do not interpolate user input into SQL.
  const rows=read.all(wid);
  return rows.filter(row=>{
   const record=JSON.parse(row.record_json);
   return ['name','email','phone','city','sector','role','legal_name']
    .some(field=>String(record[field]||'').toLocaleLowerCase().includes(needle));
  }).slice(0,200).map(row=>({id:row.id,workspace_id:wid,record:JSON.parse(row.record_json),source:JSON.parse(row.source_json),created_at:row.created_at}));
 }
 async function update({workspaceId,actorId,id,changes}={}){
  const wid=await requireAccess(workspaceId,actorId,'records.write');
  if(!Number.isSafeInteger(id)||id<1||!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('INVALID_UPDATE');
  const allowed=new Set(['name','email','phone','city','sector','legal_name','country','role']);
  const keys=Object.keys(changes);
  if(!keys.length||keys.length>8||keys.some(k=>!allowed.has(k)))throw Error('INVALID_UPDATE_FIELDS');
  const existing=db.prepare('SELECT record_json FROM imported_records WHERE id=? AND workspace_id=?').get(id,wid);
  if(!existing)throw Error('RECORD_NOT_FOUND');
  const original=JSON.parse(existing.record_json);
  const edited={...original};
  for(const key of keys){
   if(typeof changes[key]!=='string'||changes[key].length>254||/[\u0000-\u001f]/.test(changes[key]))throw Error('INVALID_UPDATE_VALUE');
   edited[key]=changes[key].trim();
  }
  if(typeof edited.name!=='string'||!edited.name.trim()||!['organization','contact'].includes(edited.type))throw Error('INVALID_UPDATE_RECORD');
  if(edited.email&&!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(edited.email))throw Error('INVALID_EMAIL');
  if(edited.phone&&!/^[+()0-9 .-]{3,40}$/.test(edited.phone))throw Error('INVALID_PHONE');
  if(JSON.stringify(edited).length>16384)throw Error('IMPORT_RECORD_TOO_LARGE');
  db.exec('BEGIN IMMEDIATE');
  try{
   const key=identityKey(edited.type,edited.name);
   if(read.all(wid).some(row=>row.id!==id&&identityKey(JSON.parse(row.record_json).type,JSON.parse(row.record_json).name)===key))throw Error('DUPLICATE_IN_WORKSPACE');
   const result=db.prepare('UPDATE imported_records SET name=?,record_json=? WHERE id=? AND workspace_id=?').run(edited.name,JSON.stringify(edited),id,wid);
   if(result.changes!==1)throw Error('RECORD_NOT_FOUND');
   audit.run(wid,actorId,'records.update',1);
   db.exec('COMMIT');
   return {id,workspace_id:wid,record:edited};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 async function recordExport({workspaceId,actorId,target,count}={}){
  const actions={crm:'crm.export',correspondence:'correspondence.directory.export',hr:'hr.directory.export'};
  if(!Object.hasOwn(actions,target))throw Error('INVALID_EXPORT_TARGET');
  const wid=await requireAccess(workspaceId,actorId,actions[target]);
  if(!Number.isSafeInteger(count)||count<1||count>200)throw Error('INVALID_EXPORT_COUNT');
  audit.run(wid,actorId,'directory.export.'+target,count);
  return {recorded:true};
 }
 async function listAudit({workspaceId,actorId}={}){
  const wid=await requireAccess(workspaceId,actorId,'audit.read');
  return readAudit.all(wid);
 }
 return {commit,list,search,update,recordExport,listAudit,close:()=>db.close()};
}
module.exports={createSqliteTenantStore};
