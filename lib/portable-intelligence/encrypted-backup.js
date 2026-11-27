'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const MAGIC=Buffer.from('BONDSBK1');
function validatePass(passphrase){if(typeof passphrase!=='string'||passphrase.length<16)throw Error('BACKUP_PASSPHRASE_REQUIRED')}
function createEncryptedBackup({databasePath,destination,passphrase}={}){
 validatePass(passphrase);
 if(!path.isAbsolute(databasePath||'')||!path.isAbsolute(destination||''))throw Error('ABSOLUTE_PATH_REQUIRED');
 if(path.resolve(databasePath)===path.resolve(destination))throw Error('SAME_PATH');
 if(!fs.statSync(databasePath).isFile())throw Error('DATABASE_PATH_REQUIRED');
 for(const suffix of ['-wal','-journal'])if(fs.existsSync(databasePath+suffix))throw Error('DATABASE_MUST_BE_OFFLINE');
 const plain=fs.readFileSync(databasePath);
 if(plain.subarray(0,16).toString('ascii')!=='SQLite format 3\0')throw Error('NOT_SQLITE');
 const salt=crypto.randomBytes(16),nonce=crypto.randomBytes(12);
 const key=crypto.scryptSync(passphrase,salt,32,{N:16384,r:8,p:1,maxmem:32*1024*1024});
 const cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(MAGIC);
 const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
 const output=Buffer.concat([MAGIC,salt,nonce,cipher.getAuthTag(),encrypted]);
 fs.writeFileSync(destination,output,{flag:'wx',mode:0o600});
 return {encrypted_bytes:output.length,sha256:crypto.createHash('sha256').update(output).digest('hex')};
}
function restoreEncryptedBackup({source,destination,passphrase}={}){
 validatePass(passphrase);
 if(!path.isAbsolute(source||'')||!path.isAbsolute(destination||''))throw Error('ABSOLUTE_PATH_REQUIRED');
 if(path.resolve(source)===path.resolve(destination))throw Error('SAME_PATH');
 const raw=fs.readFileSync(source);
 if(raw.length<64||!raw.subarray(0,8).equals(MAGIC))throw Error('INVALID_BACKUP_FORMAT');
 const salt=raw.subarray(8,24),nonce=raw.subarray(24,36),tag=raw.subarray(36,52),body=raw.subarray(52);
 const key=crypto.scryptSync(passphrase,salt,32,{N:16384,r:8,p:1,maxmem:32*1024*1024});
 let plain;
 try{const decipher=crypto.createDecipheriv('aes-256-gcm',key,nonce);decipher.setAAD(MAGIC);decipher.setAuthTag(tag);plain=Buffer.concat([decipher.update(body),decipher.final()])}
 catch{throw Error('BACKUP_AUTHENTICATION_FAILED')}
 if(plain.subarray(0,16).toString('ascii')!=='SQLite format 3\0')throw Error('INVALID_SQLITE_BACKUP');
 fs.writeFileSync(destination,plain,{flag:'wx',mode:0o600});
 try{const db=new DatabaseSync(destination,{readOnly:true});try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('BACKUP_INTEGRITY_FAILED')}finally{db.close()}}
 catch(error){fs.rmSync(destination,{force:true});throw error}
 return {restored_bytes:plain.length};
}

async function createOnlineEncryptedBackup({database,destination,passphrase,tempRoot}={}){
 validatePass(passphrase);
 if(!(database instanceof DatabaseSync))throw Error('OPEN_SQLITE_REQUIRED');
 if(typeof destination!=='string'||!path.isAbsolute(destination))throw Error('ABSOLUTE_PATH_REQUIRED');
 if(tempRoot!==undefined&&(!path.isAbsolute(tempRoot)||!fs.statSync(tempRoot).isDirectory()))throw Error('INVALID_TEMP_ROOT');
 // SQLite backup API takes a consistent snapshot of the live database, including WAL.
 // The temporary plaintext snapshot MUST be on an encrypted volume in production.
 const {backup}=require('node:sqlite');
 const scratch=fs.mkdtempSync(path.join(tempRoot||require('node:os').tmpdir(),'bonds-online-backup-'));
 fs.chmodSync(scratch,0o700);
 const snapshot=path.join(scratch,'snapshot.sqlite');
 try{
  await backup(database,snapshot);
  fs.chmodSync(snapshot,0o600);
  const result=createEncryptedBackup({databasePath:snapshot,destination,passphrase});
  return {...result,mode:'consistent-live-snapshot',plaintext_temp_cleaned:true};
 }finally{
  fs.rmSync(scratch,{recursive:true,force:true});
 }
}

module.exports={createEncryptedBackup,restoreEncryptedBackup,createOnlineEncryptedBackup};
