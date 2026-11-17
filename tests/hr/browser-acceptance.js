'use strict';
// Browser acceptance for two independent programs in one shell.
// In-memory auth/database only: no user secrets, network database or real charges.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
async function run(){
 const browser=await chromium.launch({headless:true});
 const base=process.env.CRM_TEST_BASE_URL||'http://localhost:3005';
 try{
  for(const licensed of [true,false]){
   const page=await browser.newPage({viewport:{width:1050,height:800}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/env*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__ENV={};'}));
   await page.route('**/bonds-auth-2026.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* test-injected BondsAuth */'}));
   await page.route('**/supabase.min.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* test mock */'}));
   await page.route('**/my-bonds/crm/crm-app.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:"setTimeout(()=>document.dispatchEvent(new Event('bonds-crm-workspace-initialized')),0);"}));
   await page.route('**/my-bonds/crm/crm-internal.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* internal admin panel not under test */'}));
   await page.addInitScript(isLicensed=>{
    const user={id:'10000000-0000-4000-8000-000000000001'};
    const tables={
     company_program_entitlements:isLicensed?[{owner_user_id:user.id,product_code:'hr',status:'active',starts_at:'2020-01-01T00:00:00.000Z',ends_at:null}]:[],
     hr_saas_workspaces:[],hr_saas_employees:[],hr_saas_records:[],hr_saas_audit:[],hr_saas_attendance:[],hr_saas_leave_requests:[]
    };
    let next=0;
    window.__hrTest={tables,writes:[]};
    function from(table){
     if(!tables[table])throw Error('Unexpected table: '+table);
     let kind='read',value=null,filters=[],limit=1000;
     const q={
      select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},
      in(k,vals){filters.push(r=>vals.includes(r[k]));return q;},
      order(){return q;},limit(n){limit=n;return q;},
      insert(row){kind='insert';value=row;return q;},
      update(row){kind='update';value=row;return q;},
      async eval(single=false){
       let data=tables[table].filter(r=>filters.every(f=>f(r))).slice(0,limit);
       if(kind==='insert'){
        const record={...value,id:'20000000-0000-4000-8000-'+String(++next).padStart(12,'0'),created_at:new Date().toISOString()};
        tables[table].push(record);window.__hrTest.writes.push({table,record});
        data=[record];
       }else if(kind==='update'){
        data=data.map(r=>{Object.assign(r,value);return r;});
       }
       return {data:single?data[0]||null:data,error:null};
      },
      single(){return q.eval(true);},then(resolve,reject){return q.eval().then(resolve,reject);}
     };
     return q;
    }
    const supabase={auth:{getUser:async()=>({data:{user},error:null})},from};
    window.BondsAuth={ensureEnv:async()=>({}),getSupabase:()=>supabase};
   },licensed);
   const resp=await page.goto(base+'/my-bonds/crm/?program=hr',{waitUntil:'domcontentloaded'});
   assert.equal(resp.status(),200);
   await page.locator('#hr-product-tab').waitFor();
   await page.waitForFunction(()=>!document.querySelector('#hr-section').hidden,null,{timeout:8000}).catch(async()=>{
    const diagnostic=await page.evaluate(()=>({
     productLoaded:!!window.__hrTest,
     sectionHidden:document.querySelector('#hr-section')?.hidden,
     notice:document.querySelector('#hr-status')?.textContent,
     bodyTitle:document.title
    }));
    throw Error('HR deep link did not open: '+JSON.stringify(diagnostic)+'; runtime='+errors.join('; '));
   });
   assert.equal(await page.locator('#crm-nav').isVisible(),false,'CRM navigation must hide in HR mode');
   assert.equal(await page.locator('#refresh').isVisible(),false,'CRM refresh must be hidden in HR mode');
   assert.equal(await page.locator('#install').isVisible(),false,'CRM installer must not be presented as an HR installer');

   assert.equal(await page.locator('#hr-nav').isVisible(),true,'HR navigation must remain in the same sidebar');
   if(!licensed){
    await page.waitForFunction(()=>!document.querySelector('#hr-license').hidden);
    assert.equal(await page.locator('#hr-setup').isVisible(),false,'Unlicensed user accessed HR records');
    const writes=await page.evaluate(()=>window.__hrTest.writes);
    assert.equal(writes.length,0,'Unlicensed user could write');
   }else{
    await page.waitForFunction(()=>!document.querySelector('#hr-setup').hidden);
    await page.locator('#hr-create-workspace input[name="name"]').fill('Independent HR Company');
    await page.locator('#hr-create-workspace button[type="submit"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_workspaces.length===1);
    await page.waitForFunction(()=>!document.querySelector('#hr-app').hidden);
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields input[name="employee_number"]').fill('HR-001');
    await page.locator('#hr-fields input[name="full_name"]').fill('Employee One');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_employees.length===1);
    assert.equal(await page.locator('#hr-count').textContent(),'1');

    // Attendance is an operational record with employee/date and clock timestamps.
    await page.locator('[data-hr-category="attendance"]').click();
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-fields input[name="work_date"]').fill('2026-11-17');
    await page.locator('#hr-fields input[name="clock_in"]').fill('2026-11-17T08:00');
    await page.locator('#hr-fields input[name="clock_out"]').fill('2026-11-17T16:00');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_attendance.length===1);
    const attendance=await page.evaluate(()=>window.__hrTest.tables.hr_saas_attendance[0]);
    assert.equal(attendance.work_date,'2026-11-17');
    assert.equal(attendance.attendance_status,'present');
    assert.ok(attendance.clock_in.endsWith('Z'));
    assert.ok(attendance.clock_out.endsWith('Z'));

    // Leave request supports approval state and server-side overlap verification.
    await page.locator('[data-hr-category="leaves"]').click();
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-fields input[name="start_date"]').fill('2026-12-01');
    await page.locator('#hr-fields input[name="end_date"]').fill('2026-12-03');
    await page.locator('#hr-fields select[name="status"]').selectOption('approved');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_leave_requests.length===1);
    const leave=await page.evaluate(()=>window.__hrTest.tables.hr_saas_leave_requests[0]);
    assert.equal(leave.status,'approved');
    assert.ok(leave.decided_at);
    assert.equal(leave.start_date,'2026-12-01');

    await page.locator('#crm-product-tab').click();
    assert.equal(await page.locator('#crm-nav').isVisible(),true,'CRM program was not restored');
    assert.equal(await page.locator('#hr-section').isVisible(),false,'HR data displayed while CRM selected');
    await page.locator('#hr-product-tab').click();
    assert.equal(await page.locator('#hr-app').isVisible(),true,'HR program was not restored');
    const employee=await page.evaluate(()=>window.__hrTest.tables.hr_saas_employees[0]);
    assert.equal(employee.employee_number,'HR-001');
   }
   assert.deepEqual(errors,[],'Client runtime error: '+errors.join('; '));
   await page.close();
  }
  console.log('HR SHARED DASHBOARD BROWSER ACCEPTANCE PASS — license gating, employee/attendance/leave saves and switching programs');
 }finally{await browser.close();}
}
run().catch(e=>{console.error('HR BROWSER ACCEPTANCE FAIL',e);process.exitCode=1;});
