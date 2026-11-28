'use strict';
// Entire-page encryption using a native cipher-enabled SQLite driver.
// Strictly opt-in; never converts or rekeys a preexisting plaintext DB in place.
const fs=require('node:fs'),path=require('node:path');
function openEncryptedSqlite({filename,encryptionKey}={}){
 if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('ABSOLUTE_DB_PATH_REQUIRED');
 if(!Buffer.isBuffer(encryptionKey)||encryptionKey.length!==32)throw Error('FULL_DATABASE_KEY_REQUIRED');
 const exists=fs.existsSync(filename);
 if(exists){
  const stat=fs.statSync(filename);
  if(!stat.isFile())throw Error('INVALID_DATABASE_PATH');
  if(stat.size>0){
   const header=Buffer.alloc(16),fd=fs.openSync(filename,'r');
   try{fs.readSync(fd,header,0,16,0)}finally{fs.closeSync(fd)}
   if(header.toString('ascii')==='SQLite format 3\0')throw Error('PLAINTEXT_DATABASE_MIGRATION_REQUIRED');
  }
 }
 let Database;
 try{Database=require('better-sqlite3-multiple-ciphers')}
 catch{throw Error('ENCRYPTED_SQLITE_NATIVE_DRIVER_MISSING')}
 const db=new Database(filename,{timeout:5000});
 try{
  // Pick SQLCipher AES-256 before setting raw key material.
  db.pragma("cipher='sqlcipher'");
  db.pragma('legacy=4');
  db.key(Buffer.from(encryptionKey));
  // PRAGMA key itself cannot detect an incorrect key: always test a page read.
  db.prepare('SELECT count(*) AS count FROM sqlite_master').get();
  db.pragma('foreign_keys=ON');
  db.pragma('secure_delete=ON');
  return db;
 }catch{
  db.close();
  throw Error('ENCRYPTED_DATABASE_OPEN_FAILED');
 }
}
module.exports={openEncryptedSqlite};
