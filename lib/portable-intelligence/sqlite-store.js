'use strict';
// Customer-owned local SQLite persistence; identity and memberships come from a trusted host.
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function context(workspaceId,actorId){
 if(typeof workspaceId!=='string'||!UUID.test(workspaceId))throw Error('WORKSPACE_ID_REQUIRED');
 if(typeof actorId!=='string'||!actorId.trim())throw Error('ACTOR_REQUIRED');
 return workspaceId.toLowerCase();
}
function identityKey(type,name){return type+':'+String(name).normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[\u064b-\u065f]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ')}
function createSqliteTenantStore({filename,authorize,encryptionKey=null}={}){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||filename===':memory:')throw Error('ABSOLUTE_DB_PATH_REQUIRED');
 if(typeof authorize!=='function')throw Error('TRUSTED_AUTHORIZATION_REQUIRED');
 if(encryptionKey!==null&&(!Buffer.isBuffer(encryptionKey)||encryptionKey.length!==32))throw Error('INVALID_DATA_ENCRYPTION_KEY');
 const secret=encryptionKey?Buffer.from(encryptionKey):null;
 function seal(data,wid,field){
  const json=JSON.stringify(data);
  if(!secret)return json;
  const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secret,nonce);
  cipher.setAAD(Buffer.from(wid+'|'+field));
  const encrypted=Buffer.concat([cipher.update(json,'utf8'),cipher.final()]);
  return 'enc1:'+nonce.toString('base64url')+':'+cipher.getAuthTag().toString('base64url')+':'+encrypted.toString('base64url');
 }
 function open(data,wid,field){
  if(!secret)return JSON.parse(data);
  if(typeof data!=='string'||!data.startsWith('enc1:'))throw Error('ENCRYPTED_RECORD_REQUIRED');
  const parts=data.split(':');
  if(parts.length!==4)throw Error('INVALID_ENCRYPTED_RECORD');
  try{
   const decipher=crypto.createDecipheriv('aes-256-gcm',secret,Buffer.from(parts[1],'base64url'));
   decipher.setAAD(Buffer.from(wid+'|'+field));
   decipher.setAuthTag(Buffer.from(parts[2],'base64url'));
   return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8'));
  }catch{throw Error('RECORD_INTEGRITY_FAILED')}
 }
 function nameAtRest(wid,type,name){return secret?crypto.createHmac('sha256',secret).update(wid+'|'+identityKey(type,name)).digest('hex'):name}

 const db=new DatabaseSync(filename,{timeout:5000});
 db.exec("PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS imported_records (id INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('organization','contact')),name TEXT NOT NULL,record_json TEXT NOT NULL,source_json TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))); CREATE INDEX IF NOT EXISTS idx_imported_records_workspace ON imported_records(workspace_id,id); CREATE TABLE IF NOT EXISTS import_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,record_count INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))); CREATE INDEX IF NOT EXISTS idx_import_audit_workspace ON import_audit(workspace_id,id);");
 const insert=db.prepare('INSERT INTO imported_records(workspace_id,type,name,record_json,source_json,created_by) VALUES(?,?,?,?,?,?)');
 // Backward-compatible additive migration; preserve old audit records.
 if(!db.prepare('PRAGMA table_info(import_audit)').all().some(col=>col.name==='details_json'))db.exec('ALTER TABLE import_audit ADD COLUMN details_json TEXT');
 if(!secret){
  const existing=db.prepare('SELECT record_json FROM imported_records LIMIT 1').get();
  if(existing&&String(existing.record_json).startsWith('enc1:')){db.close();throw Error('ENCRYPTION_KEY_REQUIRED')}
 }
 if(secret){
  const existing=db.prepare('SELECT workspace_id,record_json FROM imported_records LIMIT 1').get();
  if(existing){
   if(!String(existing.record_json).startsWith('enc1:')){db.close();throw Error('PLAINTEXT_DATABASE_MIGRATION_REQUIRED')}
   try{open(existing.record_json,existing.workspace_id,'record')}catch(e){db.close();throw e}
  }
 }
 const audit=db.prepare('INSERT INTO import_audit(workspace_id,actor_id,action,record_count,details_json) VALUES(?,?,?,?,?)');
 const read=db.prepare('SELECT id,record_json,source_json,created_at FROM imported_records WHERE workspace_id=? ORDER BY id');
 const readAudit=db.prepare('SELECT id,actor_id,action,record_count,details_json,created_at FROM import_audit WHERE workspace_id=? ORDER BY id');
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
   const record=seal(item.record,wid,'record'),source=seal(item.source,wid,'source');
   if(record.length>16384||source.length>4096)throw Error('IMPORT_RECORD_TOO_LARGE');
   return {type:item.record.type,name:item.record.name,storedName:nameAtRest(wid,item.record.type,item.record.name),record,source};
  });
  if(duplicateOverrideReason!==null&&(typeof duplicateOverrideReason!=='string'||duplicateOverrideReason.trim().length<12||duplicateOverrideReason.length>500))throw Error('INVALID_DUPLICATE_OVERRIDE_REASON');
  db.exec('BEGIN IMMEDIATE');
  try{
   // BEGIN IMMEDIATE serializes SQLite writers: avoid a check-then-insert race.
   const existingKeys=new Set(read.all(wid).map(row=>{const record=open(row.record_json,wid,'record');return identityKey(record.type,record.name)}));
   const duplicate=valid.some(item=>{const key=identityKey(item.type,item.name);const existed=existingKeys.has(key);existingKeys.add(key);return existed;});
   if(duplicate&&!duplicateOverrideReason)throw Error('DUPLICATE_IN_WORKSPACE');
   if(!duplicate&&duplicateOverrideReason)throw Error('DUPLICATE_OVERRIDE_NOT_APPLICABLE');
   const ids=valid.map(item=>Number(insert.run(wid,item.type,item.storedName,item.record,item.source,actorId).lastInsertRowid));
   audit.run(wid,actorId,duplicate?'import.reviewed.duplicate_override':'import.reviewed',ids.length,duplicate?seal({duplicate_override_reason:duplicateOverrideReason.trim()},wid,'audit'):null);
   db.exec('COMMIT');
   return {ids};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 async function list({workspaceId,actorId}={}){
  const wid=await requireAccess(workspaceId,actorId,'records.read');
  return read.all(wid).map(row=>({id:row.id,workspace_id:wid,record:open(row.record_json,wid,'record'),source:open(row.source_json,wid,'source'),created_at:row.created_at}));
 }
 async function search({workspaceId,actorId,query}={}){
  const wid=await requireAccess(workspaceId,actorId,'records.read');
  if(typeof query!=='string'||query.length>200)throw Error('INVALID_SEARCH_QUERY');
  const needle=query.trim().toLocaleLowerCase();
  if(!needle)return [];
  // Scan only rows of the authorized workspace. Do not interpolate user input into SQL.
  const rows=read.all(wid);
  return rows.filter(row=>{
   const record=open(row.record_json,wid,'record');
   return ['name','email','phone','city','sector','role','legal_name']
    .some(field=>String(record[field]||'').toLocaleLowerCase().includes(needle));
  }).slice(0,200).map(row=>({id:row.id,workspace_id:wid,record:open(row.record_json,wid,'record'),source:open(row.source_json,wid,'source'),created_at:row.created_at}));
 }
 async function update({workspaceId,actorId,id,changes}={}){
  const wid=await requireAccess(workspaceId,actorId,'records.write');
  if(!Number.isSafeInteger(id)||id<1||!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('INVALID_UPDATE');
  const allowed=new Set(['name','email','phone','city','sector','legal_name','country','role']);
  const keys=Object.keys(changes);
  if(!keys.length||keys.length>8||keys.some(k=>!allowed.has(k)))throw Error('INVALID_UPDATE_FIELDS');
  const existing=db.prepare('SELECT record_json FROM imported_records WHERE id=? AND workspace_id=?').get(id,wid);
  if(!existing)throw Error('RECORD_NOT_FOUND');
  const original=open(existing.record_json,wid,'record');
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
   if(read.all(wid).some(row=>row.id!==id&&identityKey(open(row.record_json,wid,'record').type,open(row.record_json,wid,'record').name)===key))throw Error('DUPLICATE_IN_WORKSPACE');
   const result=db.prepare('UPDATE imported_records SET name=?,record_json=? WHERE id=? AND workspace_id=?').run(nameAtRest(wid,edited.type,edited.name),seal(edited,wid,'record'),id,wid);
   if(result.changes!==1)throw Error('RECORD_NOT_FOUND');
   audit.run(wid,actorId,'records.update',1,null);
   db.exec('COMMIT');
   return {id,workspace_id:wid,record:edited};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 async function recordExport({workspaceId,actorId,target,count}={}){
  const actions={crm:'crm.export',correspondence:'correspondence.directory.export',hr:'hr.directory.export'};
  if(!Object.hasOwn(actions,target))throw Error('INVALID_EXPORT_TARGET');
  const wid=await requireAccess(workspaceId,actorId,actions[target]);
  if(!Number.isSafeInteger(count)||count<1||count>200)throw Error('INVALID_EXPORT_COUNT');
  audit.run(wid,actorId,'directory.export.'+target,count,null);
  return {recorded:true};
 }
 async function listAudit({workspaceId,actorId}={}){
  const wid=await requireAccess(workspaceId,actorId,'audit.read');
  return readAudit.all(wid).map(row=>({...row,details_json:row.details_json?(secret?JSON.stringify(open(row.details_json,wid,'audit')):row.details_json):null}));
 }
 return {commit,list,search,update,recordExport,listAudit,close:()=>db.close()};
}
module.exports={createSqliteTenantStore};
