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
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/env*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__ENV={};'}));
  await page.route('**/bonds-auth-2026.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* stub: BondsAuth injected in isolated test */'}));
  await page.route('**/supabase.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* mock */'}));
  await page.addInitScript(()=>{
   const db=Object.fromEntries(['crm_app_workspaces','crm_app_companies','crm_app_contacts','crm_app_deals','crm_app_activities','crm_app_renewals','crm_app_success','crm_app_pipelines','crm_app_pipeline_stages','crm_app_members','crm_app_audit'].map(x=>[x,[]]));
   const writes=[];let sequence=0;
   window.__crmTestState={db,writes,invites:[],accepted:[]};
   const defaults={
    crm_app_companies:{status:'prospect'},crm_app_contacts:{status:'lead',is_decision_maker:false},
    crm_app_deals:{stage:'lead',currency:'SAR',probability:10,value_amount:0},
    crm_app_activities:{kind:'task',status:'open'},crm_app_pipelines:{is_active:true,is_default:false},
    crm_app_pipeline_stages:{probability:10,sort_order:0,is_active:true},crm_app_members:{active:true}
   };
   function builder(table){
    let mode='read',payload=null,filters=[],limit=null,offset=0,sort=[],head=false;
    const api={
     select(_columns,options){head=Boolean(options?.head);return api;},
     eq(k,v){filters.push(x=>x[k]===v);return api;},
     is(k,v){filters.push(x=>x[k]===v);return api;},
     not(k,operator,v){if(operator==='is')filters.push(x=>x[k]!==v);return api;},
     or(expression){
      const terms=expression.split(',').map(term=>{
       const match=/^([a-z_]+)\.ilike\.\*(.*)\*$/.exec(term);
       if(!match)throw Error('Invalid mock PostgREST OR');
       return {column:match[1],needle:match[2].toLowerCase()};
      });
      filters.push(row=>terms.some(term=>String(row[term.column]??'').toLowerCase().includes(term.needle)));
      return api;
     },
     order(k,opt={}){sort.push([k,opt.ascending!==false]);return api;},
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
        if(sort.length)data.sort((a,b)=>{
         for(const [col,ascending] of sort){const left=a[col],right=b[col];
          const cmp=String(left??'').localeCompare(String(right??''));
          if(cmp)return cmp*(ascending?1:-1);
         }
         return 0;
        });
        const matchingCount=data.length;
        data=head?[]:data.slice(offset,limit==null?undefined:offset+limit);
        return {data:one?data[0]||null:data,error:null,count:matchingCount};
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
   const supabase={
    auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})},
    from:builder,
    rpc:async(name,args)=>{window.__crmTestState.accepted.push({name,args});return {data:null,error:null};}
   };
   window.BondsAuth={
    ensureEnv:async()=>({}),getSupabase:()=>supabase,
    authenticatedFetch:async(url,options)=>{
     window.__crmTestState.invites.push({url,payload:JSON.parse(options.body)});
     return {ok:true,status:202,json:async()=>({success:true,delivery:'accepted_by_provider'})};
    }
   };
   window.matchMedia=window.matchMedia||(()=>({matches:false,addListener(){}}));
  });
  const base=process.env.CRM_TEST_BASE_URL||'http://localhost:3005';
  const res=await page.goto(base+'/my-bonds/crm/',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(res?.status(),200,'CRM page not served');
  await page.locator('#workspace-form input[name="name"]').fill('Isolated Company');
  await page.locator('#workspace-form button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#workspace-content')?.hidden===false);
  // A signed-in owner may create and switch between two distinct workspaces.
  const firstWorkspace=await page.evaluate(()=>window.__crmTestState.db.crm_app_workspaces[0].id);
  await page.locator('#workspace-create-open').click();
  await page.locator('#workspace-form input[name="name"]').fill('Second Isolated Company');
  await page.locator('#workspace-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_workspaces.length===2 && document.querySelector('#onboarding')?.hidden===true);
  assert.equal(await page.locator('#workspace-select option').count(),2,'Workspace selection must include both owner spaces');
  assert.equal(await page.locator('#workspace-select').isVisible(),true,'Workspace picker must stay visible');
  await page.locator('#workspace-select').selectOption(firstWorkspace);
  await page.waitForFunction(id=>document.querySelector('#workspace-select')?.value===id,firstWorkspace);
  assert.equal(await page.locator('#workspace-name').textContent(),'Isolated Company');
  // Return to the original workspace before existing CRM lifecycle tests.
  // Owner dispatches an email invitation; browser never receives a raw token.
  await page.locator('#crm-nav [data-section="members"]').click();
  await page.locator('#invite-form [name="email"]').fill('employee@example.com');
  await page.locator('#invite-form [name="role"]').selectOption('editor');
  await page.locator('#invite-form [type="submit"]').click();
  await page.waitForFunction(()=>window.__crmTestState.invites.length===1);
  const emailInvite=await page.evaluate(()=>window.__crmTestState.invites[0]);
  assert.equal(emailInvite.url,'/api/crm-invite');
  assert.equal(emailInvite.payload.email,'employee@example.com');
  assert.equal(emailInvite.payload.role,'editor');
  assert.ok(!emailInvite.payload.token);
  // Existing direct membership remains available and independently protected.
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

  await page.locator('#csv-file').setInputFiles({name:'contacts.csv',mimeType:'text/csv',buffer:Buffer.from('name,email,phone,status\nAlice,alice@example.com,123,lead\n')});
  await page.waitForFunction(()=>window.__crmTestState.db.crm_app_contacts.length===1);
  assert.equal(await page.locator('#records-body tr').count(),1);
  // 1,500 records: server-side pagination and search must find the last row,
  // not silently search only the first 500 entries.
  await page.evaluate(()=>{
   const state=window.__crmTestState,work=state.db.crm_app_workspaces[0].id;
   for(let i=0;i<1499;i++){
    state.db.crm_app_contacts.push({
     id:'77777777-7777-4777-8777-'+String(i+1).padStart(12,'0'),
     workspace_id:work,name:'Synthetic Contact '+String(i+1).padStart(4,'0'),
     email:'contact'+i+'@example.com',status:'lead',
     created_at:'2026-11-15T00:00:00.000Z',updated_at:'2026-11-15T00:00:00.000Z'
    });
   }
  });
  await page.locator('#refresh').click();
  await page.waitForFunction(()=>document.querySelector('#page-info')?.textContent.includes('/ 1500'));
  assert.equal(await page.locator('#records-body tr').count(),50);
  await page.locator('#page-next').click();
  await page.waitForFunction(()=>document.querySelector('#page-info')?.textContent.startsWith('51'));
  await page.locator('#search').fill('Synthetic Contact 1499');
  await page.waitForFunction(()=>document.querySelector('#page-info')?.textContent==='1–1 / 1');
  assert.equal(await page.locator('#records-body tr').count(),1);
  assert.match(await page.locator('#records-body').innerText(),/Synthetic Contact 1499/);
  await page.locator('#search').fill('');
  await page.waitForFunction(()=>document.querySelector('#page-info')?.textContent.includes('/ 1500'));
  assert.deepEqual(errors,[],'CRM browser errors');
  await page.goto(base+'/en/my-bonds/crm/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('#crm-nav [data-section="companies"]').innerText(),'Companies');
  const manifest=await page.locator('link[rel="manifest"]').getAttribute('href');
  assert.equal(manifest,'/en/my-bonds/crm/crm-manifest.webmanifest');
  // The invitation token is consumed by the authenticated RPC then removed
  // immediately from location/history so it cannot leak through referrers.
  const token='test-opaque-invitation-token-01234567890123456789';
  await page.goto(base+'/en/my-bonds/crm/?invite='+token,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__crmTestState.accepted.length===1);
  assert.equal(new URL(page.url()).search,'');
  const claim=await page.evaluate(()=>window.__crmTestState.accepted[0]);
  assert.equal(claim.name,'crm_app_accept_invite');
  assert.equal(claim.args.invite_token,token);
  console.log('CRM BROWSER ACCEPTANCE: PASS — onboarding, companies, pipelines, stages, deals, CSV, English UI');
 }finally{await browser.close();}
}
main().catch(error=>{console.error('CRM BROWSER ACCEPTANCE: FAIL',error.stack||error);process.exitCode=1;});
