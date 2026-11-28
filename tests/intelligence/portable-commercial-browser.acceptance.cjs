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
