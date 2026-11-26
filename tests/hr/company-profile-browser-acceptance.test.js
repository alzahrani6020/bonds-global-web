'use strict';
// Browser acceptance of the production HR company-profile script against a
// persistent browser-side fixture. No production credentials, DB or user writes.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'my-bonds/crm/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'my-bonds/crm/company-hr-company-profile.js'), 'utf8');
const section = html.match(/<section id="hr-company-profile"[\s\S]*?<\/section>/);
if (!section) throw new Error('HR company profile section is missing');

test('company profile: save, readback after reload, private logo, owner gate, no membership writes', async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const context = await browser.newContext();
  const pageErrors = [];
  const workspaceId = '90000000-0000-4000-8000-000000000007';
  const userId = '10000000-0000-4000-8000-000000000001';
  const host = 'http://localhost:3005';
  const testPath = '/__test-only-hr-profile-acceptance';
  const fixtureHtml = '<!doctype html><html lang="ar"><head><meta charset="utf-8"></head><body>' +
   section[0] + '<script src="/__test-only-hr-profile-app.js"></script></body></html>';

  await context.route('**'+testPath+'*', route => route.fulfill({
   status:200, contentType:'text/html; charset=utf-8', body:fixtureHtml
  }));
  await context.route('**/__test-only-hr-profile-app.js', route => route.fulfill({
   status:200, contentType:'application/javascript', body:app
  }));
  await context.addInitScript(({userId,workspaceId})=>{
   const isOther = new URLSearchParams(location.search).has('other');
   const user = {id:isOther?'20000000-0000-4000-8000-000000000002':userId};
   const ownerWorkspace = {id:'50000000-0000-4000-8000-000000000001',
    crm_workspace_id:workspaceId,owner_user_id:userId};
   const key = '__hr_profile_browser_fixture';
   const read = () => JSON.parse(localStorage.getItem(key)||'{"rows":{},"writes":0,"uploads":[]}');
   const store = value => localStorage.setItem(key,JSON.stringify(value));
   const database = {
    from(table){
     if(table!=='hr_company_profiles')throw new Error('Unexpected production table write/read '+table);
     let id,writeValue;
     const q={
      select(){return q},
      eq(field,value){
       if(field!=='crm_workspace_id')throw Error('Unexpected filter '+field);
       id=value;return q;
      },
      upsert(value,{onConflict}={}){
       if(onConflict!=='crm_workspace_id')throw Error('Missing profile upsert identity');
       const state=read();
       state.rows[value.crm_workspace_id]={...(state.rows[value.crm_workspace_id]||{}),...value};
       state.writes++;
       store(state);
       writeValue=value;
       return q;
      },
      async maybeSingle(){
       const state=read();
       return {data:state.rows[id]||null,error:null};
      },
      async single(){
       const state=read();
       const data=state.rows[id||(writeValue&&writeValue.crm_workspace_id)]||null;
       return {data,error:null};
      }
     };
     return q;
    },
    storage:{from(bucket){
     if(bucket!=='hr-company-branding')throw Error('Unexpected branding bucket');
     return {
      async upload(objectPath,file,options){
       if(!objectPath.startsWith(workspaceId+'/logo.')||options.upsert!==true)throw Error('Incorrect branding scope');
       const state=read();
       state.uploads.push({path:objectPath,size:file.size,type:file.type});
       store(state);
       return {data:{path:objectPath},error:null};
      },
      async createSignedUrl(objectPath,seconds){
       if(seconds!==120||!objectPath.startsWith(workspaceId+'/logo.'))throw Error('Incorrect logo signed URL request');
       return {data:{signedUrl:'data:image/png;base64,iVBORw0KGgo='},error:null};
      }
     };
    }}
   };
   window.BondsHRContext={db:database,user,ownerLicense:true,ownerWorkspace};
  },{userId,workspaceId});
  const page = await context.newPage();
  page.on('pageerror',error=>pageErrors.push(error.message));
  const url = host+testPath;
  await page.goto(url,{waitUntil:'load'});
  await page.waitForFunction(()=>!document.getElementById('hr-company-profile').hidden);
  await page.locator('[name=legal_name]').fill('BONDS HR browser acceptance');
  await page.locator('[name=trading_name]').fill('BONDS');
  await page.locator('[name=city]').fill('Jeddah');
  await page.locator('[name=email]').fill('test@example.test');
  await page.locator('#hr-company-logo-file').setInputFiles({
   name:'logo.png',mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a','hex')
  });
  await page.locator('#hr-company-profile-form button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('hr-company-profile-status').textContent.includes('حُفظ ملف المنشأة'));
  const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('__hr_profile_browser_fixture')));
  expect(Object.keys(saved.rows)).toEqual([workspaceId]);
  expect(saved.rows[workspaceId].city).toBe('Jeddah');
  expect(saved.rows[workspaceId].logo_path).toBe(workspaceId+'/logo.png');
  expect(saved.uploads).toHaveLength(1);
  expect(saved.writes).toBe(1);

  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('[name=legal_name]')?.value==='BONDS HR browser acceptance');
  expect(await page.locator('[name=city]').inputValue()).toBe('Jeddah');
  expect(await page.locator('#hr-company-logo-preview').isVisible()).toBe(true);
  await page.locator('#hr-company-profile-form button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('hr-company-profile-status').textContent.includes('حُفظ ملف المنشأة'));
  const repeat = await page.evaluate(()=>JSON.parse(localStorage.getItem('__hr_profile_browser_fixture')));
  expect(Object.keys(repeat.rows)).toHaveLength(1);
  expect(repeat.uploads).toHaveLength(1);
  expect(repeat.writes).toBe(2);

  const other = await context.newPage();
  other.on('pageerror',error=>pageErrors.push(error.message));
  await other.goto(url+'?other=1',{waitUntil:'load'});
  expect(await other.locator('#hr-company-profile').isVisible()).toBe(false);
  await other.locator('#hr-company-profile-form').evaluate(form=>form.requestSubmit());
  const after = await other.evaluate(()=>JSON.parse(localStorage.getItem('__hr_profile_browser_fixture')));
  expect(after.writes).toBe(2);
  expect(Object.keys(after.rows)).toHaveLength(1);
  expect(pageErrors).toEqual([]);
  await context.close();
 } finally {
  await browser.close();
 }
},90000);
