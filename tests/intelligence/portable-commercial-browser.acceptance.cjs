'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {createLocalIdentityStore}=require('../../lib/portable-intelligence/local-identity');
const {createCommercialServer}=require('../../lib/portable-intelligence/commercial-server');
const WID='12345678-1234-4123-8123-1234567890ab';
test('Windows Chromium: local login -> source review -> approved SQLite -> edit -> archive -> audit -> logout',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-commercial-browser-'));
 const filename=path.join(dir,'customer.sqlite');
 const identity=createLocalIdentityStore({filename});
 identity.createUser({username:'local-owner',password:'isolated-browser-passphrase-2026',workspaceId:WID,role:'owner'});
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const raw=Buffer.from(JSON.stringify({version:1,workspace_id:WID,expires_at:Math.floor(Date.now()/1000)+1800,features:['document-intelligence','crm.export','correspondence.export','hr.export']}));
 const token=raw.toString('base64url')+'.'+crypto.sign(null,raw,privateKey).toString('base64url');
 const server=createCommercialServer({
  workspaceId:WID,databasePath:filename,licenseToken:token,licensePublicKey:publicKey.export({format:'pem',type:'spki'}),
  getMembership:identity.getMembership,verifyCredentials:identity.verifyCredentials,encryptionKey:crypto.randomBytes(32)
 });
 let browser;
 try{
  const url=await server.listen();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA'});
  const page=await context.newPage();
  await page.goto(url+'/');
  await page.locator('#username').fill('local-owner');
  await page.locator('#password').fill('isolated-browser-passphrase-2026');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  assert.equal(await page.locator('#loginPanel').isVisible(),false);
  const html='<p>اسم الشركة: شركة أولى</p><p>البريد: first@example.org</p><p>اسم الشركة: شركة ثانية</p><p>البريد: second@example.org</p>';
  await page.locator('#file').setInputFiles({name:'two-companies.html',mimeType:'text/html',buffer:Buffer.from(html)});
  await page.locator('#uploadForm button[type="submit"]').click();
  await page.locator('#reviewPanel').waitFor({state:'visible'});
  assert.equal(await page.locator('#candidate option').count(),2);
  await page.locator('#candidate').selectOption('1');
  assert.equal(await page.locator('#name').inputValue(),'شركة ثانية');
  assert.equal(await page.locator('#email').inputValue(),'second@example.org');
  await page.locator('#reviewForm button[type="submit"]').click();
  await page.locator('#approve:enabled').waitFor();
  await page.locator('#approve').click();
  await page.getByText('شركة ثانية',{exact:true}).waitFor();
  const rows=page.locator('#recordsOutput tr');
  assert.equal(await rows.count(),2);
  assert.equal((await page.locator('#recordsOutput').innerText()).includes('شركة أولى'),false);
  await page.locator('#recordsOutput button').first().click();
  await page.locator('#editPanel').waitFor({state:'visible'});
  await page.locator('#editCity').fill('الرياض');
  await page.locator('#editForm button[type="submit"]').click();
  await page.getByText('الرياض',{exact:true}).waitFor();
  await page.locator('#recordsOutput button').first().click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#archive').click();
  await page.getByText('لا توجد سجلات مطابقة').waitFor();
  const audit=await (await page.request.get(url+'/audit')).json();
  assert.deepEqual(audit.items.map(x=>x.action),['import.reviewed','records.update','records.archive']);
  await page.locator('#logout').click();
  await page.locator('#loginPanel').waitFor({state:'visible'});
  assert.equal((await page.request.get(url+'/records')).status(),401);
  await context.close();
 }finally{
  await browser?.close();
  await server.close();
  identity.close();fs.rmSync(dir,{recursive:true,force:true});
 }
});


test('Windows Chromium: independent authenticated company sessions keep approved records and cookies isolated',async()=>{
 const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-two-tenants-browser-'));
 const instances=[];
 let browser;
 async function startTenant(workspaceId,username,password){
  const filename=path.join(dir,workspaceId+'.sqlite');
  const identity=createLocalIdentityStore({filename});
  identity.createUser({username,password,workspaceId,role:'owner'});
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
  const raw=Buffer.from(JSON.stringify({version:1,workspace_id:workspaceId,expires_at:Math.floor(Date.now()/1000)+1800,features:['document-intelligence','crm.export']}));
  const licenseToken=raw.toString('base64url')+'.'+crypto.sign(null,raw,privateKey).toString('base64url');
  const server=createCommercialServer({workspaceId,databasePath:filename,licenseToken,licensePublicKey:publicKey.export({format:'pem',type:'spki'}),getMembership:identity.getMembership,verifyCredentials:identity.verifyCredentials,encryptionKey:crypto.randomBytes(32)});
  instances.push({identity,server});
  return {url:await server.listen(),workspaceId,username,password};
 }
 try{
  const a=await startTenant(A,'owner-company-a','isolated-company-a-password-2026');
  const b=await startTenant(B,'owner-company-b','isolated-company-b-password-2026');
  browser=await chromium.launch({headless:true});
  const contextA=await browser.newContext({viewport:{width:1280,height:800},locale:'ar-SA'});
  const contextB=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA'});
  const pageA=await contextA.newPage(),pageB=await contextB.newPage();
  async function saveReviewed(page,tenant,name){
   await page.goto(tenant.url+'/');
   await page.locator('#username').fill(tenant.username);
   await page.locator('#password').fill(tenant.password);
   await page.locator('#loginForm button[type="submit"]').click();
   await page.locator('#workspace').waitFor({state:'visible'});
   const data='<p>اسم الشركة: '+name+'</p>';
   await page.locator('#file').setInputFiles({name:'reviewed-company.html',mimeType:'text/html',buffer:Buffer.from(data)});
   await page.locator('#uploadForm button[type="submit"]').click();
   await page.locator('#reviewPanel').waitFor({state:'visible'});
   await page.locator('#reviewForm button[type="submit"]').click();
   await page.locator('#approve:enabled').waitFor();
   await page.locator('#approve').click();
   await page.getByText(name,{exact:true}).waitFor();
   await page.reload();
   await page.locator('#workspace').waitFor({state:'visible'});
   await page.getByText(name,{exact:true}).waitFor();
  }
  await saveReviewed(pageA,a,'شركة ألف المعزولة');
  await saveReviewed(pageB,b,'شركة باء المعزولة');
  assert.equal((await pageA.locator('#recordsOutput').innerText()).includes('شركة باء المعزولة'),false);
  assert.equal((await pageB.locator('#recordsOutput').innerText()).includes('شركة ألف المعزولة'),false);
  const cookiesA=await contextA.cookies(a.url),cookiesB=await contextB.cookies(b.url);
  const cookieA=cookiesA.find(x=>x.name==='bondscommercial');
  const cookieB=cookiesB.find(x=>x.name==='bondscommercial');
  assert.ok(cookieA&&cookieB);
  assert.notEqual(cookieA.value,cookieB.value);
  const crossover=await fetch(b.url+'/records',{headers:{Cookie:'bondscommercial='+cookieA.value}});
  assert.equal(crossover.status,401,'company A session must not authenticate at company B');
  const reverse=await fetch(a.url+'/records',{headers:{Cookie:'bondscommercial='+cookieB.value}});
  assert.equal(reverse.status,401,'company B session must not authenticate at company A');
  const authorizedA=await pageA.request.get(a.url+'/records');
  const authorizedB=await pageB.request.get(b.url+'/records');
  assert.equal(authorizedA.status(),200);
  assert.equal(authorizedB.status(),200);
  assert.deepEqual((await authorizedA.json()).items.map(x=>x.record.name),['شركة ألف المعزولة']);
  assert.deepEqual((await authorizedB.json()).items.map(x=>x.record.name),['شركة باء المعزولة']);
  await contextA.close();await contextB.close();
 }finally{
  await browser?.close();
  for(const x of instances.reverse()){await x.server.close();x.identity.close();}
  fs.rmSync(dir,{recursive:true,force:true});
 }
});


test('Windows Chromium: remote 202 unverified receipt displays reconciliation warning, not delivery success',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-delivery-ui-browser-'));
 const filename=path.join(dir,'customer.sqlite');
 const identity=createLocalIdentityStore({filename});
 identity.createUser({username:'local-owner',password:'isolated-browser-passphrase-2026',workspaceId:WID,role:'owner'});
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const raw=Buffer.from(JSON.stringify({version:1,workspace_id:WID,expires_at:Math.floor(Date.now()/1000)+1800,features:['document-intelligence','crm.export']}));
 const token=raw.toString('base64url')+'.'+crypto.sign(null,raw,privateKey).toString('base64url');
 let verified=false;
 const fakeFetch=async(_url,opts)=>{
  const payload=JSON.parse(opts.body);
  assert.equal(payload.workspace_id,WID);
  assert.equal(payload.send_mail,false);
  return {ok:true,status:verified?200:202,headers:{get:()=> 'application/json'},json:async()=>({
   accepted:true,verified,workspace_id:WID,target:'crm',accepted_count:1,receipt_id:'browser-test-receipt-123456'
  })};
 };
 const server=createCommercialServer({
  workspaceId:WID,databasePath:filename,licenseToken:token,licensePublicKey:publicKey.export({format:'pem',type:'spki'}),
  getMembership:identity.getMembership,verifyCredentials:identity.verifyCredentials,encryptionKey:crypto.randomBytes(32),
  destinationConfig:{crm:{endpoint:'https://reviewed.example.org/import',allowedOrigin:'https://reviewed.example.org'}},
  getDestinationToken:async()=> 'test-destination-token-1234567890123456',
  destinationFetch:fakeFetch
 });
 let browser;
 try{
  const url=await server.listen();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA'});
  const page=await context.newPage();
  await page.goto(url+'/');
  await page.locator('#username').fill('local-owner');
  await page.locator('#password').fill('isolated-browser-passphrase-2026');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  await page.locator('#file').setInputFiles({name:'source.html',mimeType:'text/html',buffer:Buffer.from('<p>اسم الشركة: مؤسسة أطلس</p>')});
  await page.locator('#uploadForm button[type="submit"]').click();
  await page.locator('#reviewPanel').waitFor({state:'visible'});
  await page.locator('#reviewForm button[type="submit"]').click();
  await page.locator('#approve:enabled').waitFor();
  await page.locator('#approve').click();
  await page.getByText('مؤسسة أطلس',{exact:true}).waitFor();
  const id=await page.locator('#recordsOutput tr').nth(1).locator('td').first().innerText();
  await page.locator('#recordIds').fill(id);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#deliver').click();
  await page.locator('#notice').getByText('الحالة تتطلب مصالحة يدوية',{exact:false}).waitFor();
  const pending=JSON.parse(await page.locator('#exportOutput').innerText());
  assert.equal(pending.delivered,false);
  assert.equal(pending.verified_destination_ack,false);
  assert.equal(pending.requires_reconciliation,true);
  assert.equal((await page.locator('#notice').innerText()).includes('تم تأكيد التسليم'),false);
  verified=true;
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#deliver').click();
  await page.locator('#notice').getByText('تم تأكيد التسليم وإعادة القراءة',{exact:false}).waitFor();
  const receipt=JSON.parse(await page.locator('#exportOutput').innerText());
  assert.equal(receipt.delivered,true);
  assert.equal(receipt.verified_destination_ack,true);
  await context.close();
 }finally{
  await browser?.close();
  await server.close();
  identity.close();
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
