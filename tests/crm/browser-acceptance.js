'use strict';
// UI acceptance with a fake in-memory Supabase transport; no production API, auth
// credentials or customer data. Complementary to isolated-postgres-acceptance.js.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/env*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__ENV={};'}));
  await page.route('**/bonds-auth-2026.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* stub: BondsAuth injected in isolated test */'}));
  await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* mock */'}));
  await page.addInitScript(()=>{
   const db=Object.fromEntries(['crm_app_workspaces','crm_app_companies','crm_app_contacts','crm_app_deals','crm_app_activities','crm_app_renewals','crm_app_success','crm_app_pipelines','crm_app_pipeline_stages','crm_app_members','crm_app_audit'].map(x=>[x,[]]));
   const writes=[];let sequence=0;
   window.__crmTestState={db,writes};
   const defaults={
    crm_app_companies:{status:'prospect'},crm_app_contacts:{status:'lead',is_decision_maker:false},
    crm_app_deals:{stage:'lead',currency:'SAR',probability:10,value_amount:0},
    crm_app_activities:{kind:'task',status:'open'},crm_app_pipelines:{is_active:true,is_default:false},
    crm_app_pipeline_stages:{probability:10,sort_order:0,is_active:true}
   };
   function builder(table){
    let mode='read',payload=null,filters=[],limit=null,offset=0,sort=null;
    const api={
     select(){return api;},
     eq(k,v){filters.push(x=>x[k]===v);return api;},
     is(k,v){filters.push(x=>x[k]===v);return api;},
     order(k,opt={}){if(!sort)sort=[k,opt.ascending!==false];return api;},
     limit(n){limit=n;return api;},
     range(a,b){offset=a;limit=b-a+1;return api;},
     insert(value){mode='insert';payload=value;return api;},
     update(value){mode='update';payload=value;return api;},
     async execute(one=false){
      let data=[];
      if(mode==='insert'){
       const values=Array.isArray(payload)?payload:[payload];
       data=values.map(v=>{
        if(table==='crm_app_deals'&&Object.hasOwn(v,'currency')&&v.currency==null)throw Error('null currency');
        const row={...(defaults[table]||{}),...v,id:'00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        db[table].push(row);writes.push({table,mode:'insert',row:{...v}});return row;
       });
      }else{
       data=db[table].filter(x=>filters.every(fn=>fn(x)));
       if(mode==='update'){
        data=data.map(row=>{Object.assign(row,payload);writes.push({table,mode:'update',row:{...payload}});return row;});
       }else{
        if(sort)data.sort((a,b)=>{const left=a[sort[0]],right=b[sort[0]];return (String(left??'')<String(right??'')?-1:String(left??'')>String(right??'')?1:0)*(sort[1]?1:-1);});
        data=data.slice(offset,limit==null?undefined:offset+limit);
       }
      }
      return {data:one?data[0]||null:data,error:null,count:data.length};
     },
     single(){return api.execute(true);},
     maybeSingle(){return api.execute(true);},
     then(ok,bad){return api.execute().then(ok,bad);}
    };
    return api;
   }
   const supabase={auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})},from:builder};
   window.BondsAuth={ensureEnv:async()=>({}),getSupabase:()=>supabase};
   window.matchMedia=window.matchMedia||(()=>({matches:false,addListener(){}}));
  });
  const base=process.env.CRM_TEST_BASE_URL||'http://localhost:3005';
  const res=await page.goto(base+'/my-bonds/crm/',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(res?.status(),200,'CRM page not served');
  await page.locator('#workspace-form input[name="name"]').fill('Isolated Company');
  await page.locator('#workspace-form button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#workspace-content')?.hidden===false);
  // Owner manages membership in a real UI; server policy is separately tested.
  await page.locator('#crm-nav [data-section="members"]').click();
  await page.locator('#member-form [name="member_user_id"]').fill('22222222-2222-4222-8222-222222222222');
  await page.locator('#member-form [name="role"]').selectOption('editor');
  await page.locator('#member-form [type="submit"]').click();
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_members.length===1);
  assert.equal(await page.locator('#members-body [data-member-role]').inputValue(),'editor');
  await page.locator('#members-body [data-member-role]').selectOption('viewer');
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_members[0]?.role==='viewer');
  await page.locator('#members-body [data-member]').click();
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_members[0]?.active===false);
  await page.locator('#crm-nav [data-section="audit"]').click();
  assert.equal(await page.locator('#audit-section').isVisible(),true);
  await page.locator('#crm-nav [data-section="companies"]').click();
  await page.locator('#new-record').click();
  await page.locator('#record-form [name="name"]').fill('Company A');
  await page.locator('#save-record').click();
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_companies.length===1);
  await page.locator('#crm-nav [data-section="pipeline"]').click();
  await page.locator('#new-record').click();
  await page.locator('#record-form [name="name"]').fill('Primary sales');
  await page.locator('#save-record').click();
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_pipelines.length===1);
  await page.locator('#crm-nav [data-section="stages"]').click();
  await page.locator('#new-record').click();
  await page.locator('#record-form [name="pipeline_id"]').selectOption({index:1});
  await page.locator('#record-form [name="name"]').fill('Qualified');
  await page.locator('#save-record').click();
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_pipeline_stages.length===1);
  await page.locator('#crm-nav [data-section="deals"]').click();
  await page.locator('#new-record').click();
  await page.locator('#record-form [name="title"]').fill('Deal A');
  await page.locator('#record-form [name="pipeline_id"]').selectOption({index:1});
  assert.equal(await page.locator('#record-form [name="pipeline_stage_id"] option').count(),2,'Pipeline stages unavailable after selection');
  await page.locator('#record-form [name="pipeline_stage_id"]').selectOption({index:1});
  await page.locator('#save-record').click();
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_deals.length===1);
  const state=await page.evaluate(()=>window.__crmTestState);
  assert.equal(state.db.crm_app_deals[0].currency,'SAR');
  assert.equal(state.db.crm_app_deals[0].title,'Deal A');
  assert.equal(state.db.crm_app_deals[0].pipeline_stage_id,state.db.crm_app_pipeline_stages[0].id);
  assert.ok(!state.writes.find(x=>x.table==='crm_app_deals').row.hasOwnProperty('currency'),'Blank currency was sent instead of default');

  // Contact CSV import: one bounded batch, validated before any DB write.
  await page.locator('#crm-nav [data-section="contacts"]').click();
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#csv-file').setInputFiles({name:'contacts.csv',mimeType:'text/csv',buffer:Buffer.from('name,email,phone,status\nAlice,alice@example.com,123,lead\n')});
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_contacts.length===1);
  assert.equal(await page.locator('#records-body tr').count(),1);
  assert.deepEqual(errors,[],'CRM browser errors');
  await page.goto(base+'/en/my-bonds/crm/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#crm-nav [data-section="companies"]').innerText(),'Companies');
  const manifest=await page.locator('link[rel="manifest"]').getAttribute('href');
  assert.equal(manifest,'/en/my-bonds/crm/crm-manifest.webmanifest');
  console.log('CRM BROWSER ACCEPTANCE: PASS — onboarding, companies, pipelines, stages, deals, CSV, English UI');
 }finally{await browser.close();}
}
main().catch(error=>{console.error('CRM BROWSER ACCEPTANCE: FAIL',error.stack||error);process.exitCode=1;});
