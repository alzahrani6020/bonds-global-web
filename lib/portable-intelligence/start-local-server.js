#!/usr/bin/env node
'use strict';
// Explicitly provisioned localhost demo: NEVER connects to Supabase/BONDS.
// Use a separate customer-approved encrypted database for real data.
const fs=require('node:fs'),path=require('node:path');
const {createLocalIdentityStore}=require('./local-identity');
const {createCommercialServer}=require('./commercial-server');
const {createLocalOcr}=require('./local-ocr');
process.umask(0o077);
const workspaceId=process.env.BONDS_WORKSPACE_ID;
const databasePath=process.env.BONDS_LOCAL_DB;
if(typeof databasePath!=='string'||!path.isAbsolute(databasePath))throw Error('BONDS_LOCAL_DB_ABSOLUTE_REQUIRED');
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId||''))throw Error('BONDS_WORKSPACE_ID_REQUIRED');

const command=process.argv[2]||'serve';
const encodedKey=process.env.BONDS_DATA_KEY_BASE64;
const encryptionKey=encodedKey?Buffer.from(encodedKey,'base64'):null;
if(encodedKey&&(encryptionKey.length!==32||encryptionKey.toString('base64')!==encodedKey))throw Error('INVALID_DATA_KEY_BASE64');
const fullDatabaseEncryption=process.env.BONDS_SQLCIPHER_ENCRYPTED==='1';
if(fullDatabaseEncryption&&!encryptionKey)throw Error('FULL_DATABASE_KEY_REQUIRED');
if(!fullDatabaseEncryption&&process.env.BONDS_ALLOW_UNENCRYPTED_TEST_DATA!=='1')throw Error('UNENCRYPTED_LIVE_DATABASE_PROHIBITED: TEST_DATA_ONLY');
const identity=createLocalIdentityStore({filename:databasePath,encryptionKey,fullDatabaseEncryption});
try{
 if(command==='bootstrap'){
  if(identity.countUsers()!==0)throw Error('BOOTSTRAP_ALREADY_COMPLETED');
  const username=process.env.BONDS_BOOTSTRAP_USERNAME;
  const password=process.env.BONDS_BOOTSTRAP_PASSWORD;
  const result=identity.createUser({username,password,workspaceId,role:'owner'});
  fs.chmodSync(databasePath,0o600);
  process.stdout.write('LOCAL_BOOTSTRAP_CREATED: '+result.actor_id+'\n');
  identity.close();
 }else if(command==='serve'){
  if(identity.countUsers()===0)throw Error('BOOTSTRAP_REQUIRED');
  const token=process.env.BONDS_LICENSE_TOKEN;
  const pub=process.env.BONDS_LICENSE_PUBLIC_KEY_PATH;
  if(typeof token!=='string'||!token||typeof pub!=='string'||!path.isAbsolute(pub))throw Error('SIGNED_LICENSE_REQUIRED');
  const app=createCommercialServer({
   workspaceId,databasePath,licenseToken:token,licensePublicKey:fs.readFileSync(pub,'utf8'),
   getMembership:identity.getMembership,verifyCredentials:identity.verifyCredentials,encryptionKey,fullDatabaseEncryption,
   backupDirectory:process.env.BONDS_LOCAL_BACKUP_DIR||null,
   ocr:process.env.BONDS_ENABLE_LOCAL_OCR==='1'?createLocalOcr():null,
   host:'127.0.0.1',port:Number(process.env.BONDS_LOCAL_PORT||8788)
  });
  fs.chmodSync(databasePath,0o600);
  app.listen().then(url=>process.stdout.write('BONDS_TEST_ONLY_LOCAL_UI: '+url+'\n')).catch(e=>{process.stderr.write('START_FAILED '+e.message+'\n');process.exitCode=1});
  const stop=()=>app.close().then(()=>identity.close()).then(()=>process.exit(0));
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
 }else{
  identity.close();throw Error('UNKNOWN_COMMAND');
 }
}catch(e){try{identity.close()}catch{};process.stderr.write('ERROR: '+e.message+'\n');process.exitCode=1}
