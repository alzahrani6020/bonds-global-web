'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createSqliteTenantStore}=require('../../lib/portable-intelligence/sqlite-store');
const {normalizeRows}=require('../../lib/portable-intelligence/core');
const {commitReviewedProposals}=require('../../lib/portable-intelligence/review-gate');
const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-tenant-'));
 const filename=path.join(dir,'customer.sqlite');
 const members=new Map([['alice',A],['bob',B]]);
 const authorize=({actorId,workspaceId})=>members.get(actorId)===workspaceId;
 return {dir,filename,authorize,store:createSqliteTenantStore({filename,authorize})};
}
function proposal(wid,name){
 return normalizeRows({workspaceId:wid,source:{filename:'organizations.csv',kind:'csv'},defaultType:'organization',rows:[{name}]});
}
test('review gate to SQLite: two companies remain isolated after closing and reopening database',async()=>{
 const {store,dir,filename,authorize}=setup();
 try{
  const save=(wid,actor,name)=>commitReviewedProposals({proposal:proposal(wid,name),workspaceId:wid,actorId:actor,approvedIndices:[0],authorize,commit:store.commit});
  assert.equal((await save(A,'alice','Alpha')).saved,1);
  assert.equal((await save(B,'bob','Beta')).saved,1);
  await assert.rejects(store.list({workspaceId:B,actorId:'alice'}),/TENANT_ACCESS_DENIED/);
  await assert.rejects(save(B,'alice','Intruder'),/IMPORT_NOT_AUTHORIZED/);
  assert.equal((await store.listAudit({workspaceId:A,actorId:'alice'})).length,1);
  store.close();
  const reopened=createSqliteTenantStore({filename,authorize});
  assert.deepEqual((await reopened.list({workspaceId:A,actorId:'alice'})).map(x=>x.record.name),['Alpha']);
  assert.deepEqual((await reopened.list({workspaceId:B,actorId:'bob'})).map(x=>x.record.name),['Beta']);
  reopened.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CSV file bytes to explicit review to SQLite readback',async()=>{
 const {analyzeFile}=require('../../lib/portable-intelligence/file-adapters');
 const {store,dir,authorize}=setup();
 try{
  const parsed=await analyzeFile({file:{filename:'organizations.csv',buffer:Buffer.from('type,name,email\norganization,Example Factory,info@example.org\n')},workspaceId:A});
  assert.equal(parsed.items.length,1);
  assert.equal(parsed.auto_saved,false);
  assert.equal((await store.list({workspaceId:A,actorId:'alice'})).length,0);
  await commitReviewedProposals({proposal:parsed,workspaceId:A,actorId:'alice',approvedIndices:[0],authorize,commit:store.commit});
  const saved=await store.list({workspaceId:A,actorId:'alice'});
  assert.deepEqual(saved.map(x=>x.record.name),['Example Factory']);
  assert.equal(saved[0].source.filename,'organizations.csv');
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('database-level audit failure rolls back already inserted records',async()=>{
 const {DatabaseSync}=require('node:sqlite');
 const {store,filename,dir}=setup();
 try{
  const adminDb=new DatabaseSync(filename);
  adminDb.exec("CREATE TRIGGER reject_import_audit BEFORE INSERT ON import_audit BEGIN SELECT RAISE(ABORT,'AUDIT_BLOCKED'); END;");
  adminDb.close();
  await assert.rejects(store.commit({workspaceId:A,actorId:'alice',action:'import.reviewed',entries:[{record:{type:'organization',name:'Must Roll Back'},source:{filename:'x.csv'}}]}),/AUDIT_BLOCKED/);
  assert.equal((await store.list({workspaceId:A,actorId:'alice'})).length,0);
  assert.equal((await store.listAudit({workspaceId:A,actorId:'alice'})).length,0);
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('invalid import batch rejects all inserts and creates no audit row',async()=>{
 const {store,dir}=setup();
 try{
  await assert.rejects(store.commit({workspaceId:A,actorId:'alice',action:'import.reviewed',entries:[{record:{type:'organization',name:'Valid'},source:{filename:'x.csv'}},{record:{type:'admin',name:'Invalid'},source:{filename:'x.csv'}}]}),/INVALID_IMPORT_RECORD/);
  assert.equal((await store.list({workspaceId:A,actorId:'alice'})).length,0);
  assert.equal((await store.listAudit({workspaceId:A,actorId:'alice'})).length,0);
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('real XLSX bytes: deliberate approval -> closed/reopened SQLite -> tenant isolation -> audit',async()=>{
 const XLSX=require('xlsx');
 const {analyzeFile}=require('../../lib/portable-intelligence/file-adapters');
 const {store,dir,filename,authorize}=setup();
 let reopened;
 try{
  const book=XLSX.utils.book_new();
  const sheet=XLSX.utils.aoa_to_sheet([
   ['نوع','الاسم','البريد الإلكتروني','المدينة'],
   ['organization','مصنع جدة التجريبي','factory@example.org','جدة'],
   ['organization','مؤسسة الرياض التجريبية','office@example.org','الرياض']
  ]);
  XLSX.utils.book_append_sheet(book,sheet,'دليل الشركات');
  const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  const parsed=await analyzeFile({file:{filename:'synthetic-companies.xlsx',buffer:bytes},workspaceId:A});
  assert.equal(parsed.auto_saved,false);
  assert.equal(parsed.requires_manual_approval,true);
  assert.deepEqual(parsed.items.map(x=>x.record.name),['مصنع جدة التجريبي','مؤسسة الرياض التجريبية']);
  assert.deepEqual(parsed.items.map(x=>x.source.sheet),['دليل الشركات','دليل الشركات']);
  assert.deepEqual(parsed.items.map(x=>x.source.row),[2,3]);
  assert.equal((await store.list({workspaceId:A,actorId:'alice'})).length,0,'extraction must not save');

  await assert.rejects(
   commitReviewedProposals({proposal:parsed,workspaceId:A,actorId:'bob',approvedIndices:[0],authorize,commit:store.commit}),
   /IMPORT_NOT_AUTHORIZED/
  );
  assert.equal((await store.list({workspaceId:A,actorId:'alice'})).length,0);
  const saved=await commitReviewedProposals({proposal:parsed,workspaceId:A,actorId:'alice',approvedIndices:[0,1],authorize,commit:store.commit});
  assert.equal(saved.saved,2);
  assert.equal((await store.listAudit({workspaceId:A,actorId:'alice'})).length,1);
  store.close();
  reopened=createSqliteTenantStore({filename,authorize});
  const records=await reopened.list({workspaceId:A,actorId:'alice'});
  assert.deepEqual(records.map(x=>({name:x.record.name,city:x.record.city,email:x.record.email})),[
   {name:'مصنع جدة التجريبي',city:'جدة',email:'factory@example.org'},
   {name:'مؤسسة الرياض التجريبية',city:'الرياض',email:'office@example.org'}
  ]);
  assert.deepEqual(records.map(x=>x.source.row),[2,3]);
  assert.deepEqual((await reopened.listAudit({workspaceId:A,actorId:'alice'})).map(x=>x.action),['import.reviewed']);
  await assert.rejects(reopened.list({workspaceId:A,actorId:'bob'}),/TENANT_ACCESS_DENIED/);
  assert.deepEqual(await reopened.list({workspaceId:B,actorId:'bob'}),[]);
  await assert.rejects(
   commitReviewedProposals({proposal:parsed,workspaceId:A,actorId:'bob',approvedIndices:[0],authorize,commit:reopened.commit}),
   /IMPORT_NOT_AUTHORIZED/
  );
 }finally{
  try{reopened?.close()}catch{}
  try{store.close()}catch{}
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
