'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createCommercialServer}=require('../../lib/portable-intelligence/commercial-server');
const {createLocalIdentityStore}=require('../../lib/portable-intelligence/local-identity');
const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
function licensedToken(){
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const payload=Buffer.from(JSON.stringify({version:1,workspace_id:A,expires_at:Math.floor(Date.now()/1000)+7200,features:['document-intelligence','crm.export','correspondence.export','hr.export']}));
 return {licenseToken:payload.toString('base64url')+'.'+crypto.sign(null,payload,privateKey).toString('base64url'),licensePublicKey:publicKey.export({type:'spki',format:'pem'})};
}
async function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-local-http-'));
 const members=new Map([
  ['owner',{workspace_id:A,actor_id:'owner',role:'owner',active:true}],
  ['viewer',{workspace_id:A,actor_id:'viewer',role:'viewer',active:true}]
 ]);
 const app=createCommercialServer({
  workspaceId:A,databasePath:path.join(dir,'client.sqlite'),
  ...licensedToken(),getMembership:async({workspaceId,actorId})=>workspaceId===A?members.get(actorId)||null:null,
  verifyCredentials:async({username,password})=>password==='isolated-fixture-password-25'&&members.has(username)?username:null
 });
 const url=await app.listen();
 async function login(username='owner',password='isolated-fixture-password-25'){
  const res=await fetch(url+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  return {res,cookie:(res.headers.get('set-cookie')||'').split(';')[0]};
 }
 async function request(endpoint,cookie,body){
  const headers={'Cookie':cookie};if(body)headers['Content-Type']='application/json';
  return fetch(url+endpoint,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
 }
 return {url,app,login,request,members,async close(){await app.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
describe('commercial installed-loopback API acceptance',()=>{
 test('login, HTML multi-entity, reviewed approval, reopen readback and permissioned export',async()=>{
  const f=await fixture();try{
   expect((await f.request('/records','')).status).toBe(401);
   expect((await f.login('owner','incorrect')).res.status).toBe(401);
   const auth=await f.login();expect(auth.res.status).toBe(200);
   const index=await f.request('/',auth.cookie);expect(index.status).toBe(200);
   expect(await index.text()).toContain('محرك البيانات التجاري المحلي');
   const file='<p>اسم الشركة: شركة الأولى</p><p>البريد: first@example.org</p><p>اسم الشركة: شركة الثانية</p><p>البريد: second@example.org</p>';
   const analyzed=await f.request('/analyze',auth.cookie,{filename:'companies.html',base64:Buffer.from(file).toString('base64'),workspaceId:B});
   expect(analyzed.status).toBe(200);
   const draft=await analyzed.json();expect(draft.analysis.entity_suggestions.items).toHaveLength(2);
   expect((await f.request('/records',auth.cookie)).status).toBe(200);
   expect((await (await f.request('/records',auth.cookie)).json()).items).toHaveLength(0);
   const review=await f.request('/review',auth.cookie,{preview_id:draft.preview_id,entityIndex:1,identity:{type:'organization',name:'شركة الثانية',email:'second@example.org'}});
   expect(review.status).toBe(200);
   expect((await review.json()).proposal.items[0].record.email).toBe('second@example.org');
   const forbidden=await f.request('/commit',auth.cookie,{preview_id:draft.preview_id,approvedIndices:[0],approve:false});
   expect(forbidden.status).toBe(400);
   const saved=await f.request('/commit',auth.cookie,{preview_id:draft.preview_id,approvedIndices:[0],approve:true});
   expect(saved.status).toBe(200);
   const list=await (await f.request('/records',auth.cookie)).json();expect(list.items).toHaveLength(1);expect(list.items[0].record.name).toBe('شركة الثانية');
   const exported=await f.request('/export',auth.cookie,{target:'crm',recordIds:[list.items[0].id]});
   expect(exported.status).toBe(200);
   expect((await exported.json()).commit_destination).toBe(false);
   const history=await (await f.request('/audit',auth.cookie)).json();
   expect(history.items.map(x=>x.action)).toEqual(['import.reviewed','directory.export.crm']);
   await f.request('/logout',auth.cookie,{});
   expect((await f.request('/records',auth.cookie)).status).toBe(401);
  }finally{await f.close()}
 });
 test('viewer cannot analyze, approve, update, or export; malicious origin denied',async()=>{
  const f=await fixture();try{
   const auth=await f.login('viewer');expect(auth.res.status).toBe(200);
   const analyze=await f.request('/analyze',auth.cookie,{filename:'x.html',base64:Buffer.from('<p>اسم الشركة: مصنع المعالي</p>').toString('base64')});
   expect(analyze.status).toBe(403);
   expect((await f.request('/update',auth.cookie,{id:1,changes:{name:'Hijack'}})).status).toBe(403);
   expect((await f.request('/export',auth.cookie,{target:'hr',recordIds:[1]})).status).toBe(403);
   const csrf=await fetch(f.url+'/logout',{method:'POST',headers:{Origin:'https://outside.example',Cookie:auth.cookie,'Content-Type':'application/json'},body:'{}'});
   expect(csrf.status).toBe(403);
  }finally{await f.close()}
 });
 test('persisted local identities enforce real role revocation across HTTP sessions',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-local-user-http-'));
  const filename=path.join(dir,'customer.sqlite'),identity=createLocalIdentityStore({filename}),dataKey=crypto.randomBytes(32);
  const owner=identity.createUser({username:'alice',password:'trusted-local-password-2026',workspaceId:A,role:'owner'});
  const viewer=identity.createUser({username:'bob',password:'another-local-password-2026',workspaceId:A,role:'viewer'});
  const app=createCommercialServer({workspaceId:A,databasePath:filename,...licensedToken(),encryptionKey:dataKey,getMembership:identity.getMembership,verifyCredentials:identity.verifyCredentials});
  const url=await app.listen();
  try{
   const login=async(username,password)=>{
    const res=await fetch(url+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    return {status:res.status,cookie:(res.headers.get('set-cookie')||'').split(';')[0]};
   };
   const ownerAuth=await login('alice','trusted-local-password-2026'),viewAuth=await login('bob','another-local-password-2026');
   expect(ownerAuth.status).toBe(200);expect(viewAuth.status).toBe(200);
   expect((await fetch(url+'/records',{headers:{Cookie:viewAuth.cookie}})).status).toBe(200);
   identity.setMembershipActive({workspaceId:A,actorId:viewer.actor_id,active:false});
   expect((await fetch(url+'/records',{headers:{Cookie:viewAuth.cookie}})).status).toBe(403);
   expect((await fetch(url+'/records',{headers:{Cookie:ownerAuth.cookie}})).status).toBe(200);
   expect(owner.actor_id).not.toBe(viewer.actor_id);
  }finally{await app.close();identity.close();fs.rmSync(dir,{recursive:true,force:true})}
 });
 test('server refuses non-loopback host and invalid signatures',()=>{
  const fields={workspaceId:A,databasePath:path.join(os.tmpdir(),'customer-test.sqlite'),getMembership:async()=>null,verifyCredentials:async()=>null,...licensedToken()};
  expect(()=>createCommercialServer({...fields,host:'0.0.0.0'})).toThrow('LOOPBACK_ONLY');
  expect(()=>createCommercialServer({...fields,licenseToken:'invalid'})).toThrow('INVALID_LICENSE');
 });
});
