'use strict';
// Browser acceptance for two independent programs in one shell.
// In-memory auth/database only: no user secrets, network database or real charges.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
async function run(){
 const browser=await chromium.launch({headless:true});
 const base=process.env.CRM_TEST_BASE_URL||'http://localhost:3005';
 try{
  for(const scenario of ['owner','unlicensed','employee','manager']){
   const licensed=scenario==='owner';
   const page=await browser.newPage({viewport:{width:1050,height:800}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/env*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.__ENV={};'}));
   await page.route('**/bonds-auth-2026.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* test-injected BondsAuth */'}));
   await page.route('**/supabase.min.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* test mock */'}));
   await page.route('**/my-bonds/crm/crm-app.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:"setTimeout(()=>document.dispatchEvent(new Event('bonds-crm-workspace-initialized')),0);"}));
   await page.route('**/my-bonds/crm/crm-internal.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* internal admin panel not under test */'}));
   await page.addInitScript(({isLicensed,scenario})=>{
    const user={id:'10000000-0000-4000-8000-000000000001'};
    const tables={
     company_program_entitlements:isLicensed?[{owner_user_id:user.id,product_code:'hr',status:'active',starts_at:'2020-01-01T00:00:00.000Z',ends_at:null}]:[],
     hr_saas_workspaces:[],hr_saas_employees:[],hr_saas_records:[],hr_saas_audit:[],hr_saas_attendance:[],hr_saas_leave_requests:[],hr_saas_payroll_periods:[],hr_saas_payroll_lines:[],hr_saas_employment_contracts:[],hr_saas_entitlements:[],hr_saas_leave_ledger:[],hr_saas_leave_balance_summary:[],
     hr_saas_memberships:['employee','manager'].includes(scenario)?[{
      id:'40000000-0000-4000-8000-000000000001',workspace_id:'50000000-0000-4000-8000-000000000001',
      employee_id:'60000000-0000-4000-8000-000000000001',user_id:user.id,role:scenario==='manager'?'hr_manager':'employee',status:'active'
     }]:[],
     hr_saas_employee_requests:scenario==='manager'?[{
      id:'70000000-0000-4000-8000-000000000001',workspace_id:'50000000-0000-4000-8000-000000000001',
      employee_id:'60000000-0000-4000-8000-000000000002',requested_by:'80000000-0000-4000-8000-000000000002',
      request_type:'leave',subject:'A pending leave request',description:'Approve',status:'pending',created_at:new Date().toISOString()
     }]:[]
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
   },{isLicensed:licensed,scenario});
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
   if(scenario==='unlicensed'){
    await page.waitForFunction(()=>!document.querySelector('#hr-license').hidden);
    assert.equal(await page.locator('#hr-setup').isVisible(),false,'Unlicensed user accessed HR records');
    const writes=await page.evaluate(()=>window.__hrTest.writes);
    assert.equal(writes.length,0,'Unlicensed user could write');
   }else if(scenario==='employee'||scenario==='manager'){
    await page.waitForFunction(()=>!document.querySelector('#hr-self-section').hidden);
    await page.waitForFunction(()=>!document.querySelector('#hr-self-app').hidden);
    assert.equal(await page.locator('#hr-setup').isVisible(),false,'Staff cannot use owner administration');
    assert.equal(await page.locator('#hr-license').isVisible(),false,'Valid membership should not require a personal subscription');
    if(scenario==='employee'){
     await page.locator('#hr-request-form input[name="subject"]').fill('Certificate');
     await page.locator('#hr-request-form textarea[name="description"]').fill('Please issue a certificate');
     await page.locator('#hr-request-form button[type="submit"]').click();
     await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_employee_requests.length===1);
     const entry=await page.evaluate(()=>window.__hrTest.tables.hr_saas_employee_requests[0]);
     assert.equal(entry.status,'pending');
     assert.equal(entry.requested_by,'10000000-0000-4000-8000-000000000001');
    }else{
     await page.locator('[data-hr-decision="approved"]').click();
     await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_employee_requests[0].status==='approved');
     assert.equal(await page.locator('[data-hr-decision="approved"]').count(),0);
    }
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

    // Newly created HR workspaces must remain selectable without mixing tenant records.
    await page.locator('#hr-create-workspace input[name="name"]').fill('Second HR Company');
    await page.locator('#hr-create-workspace button[type="submit"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_workspaces.length===2);
    assert.equal(await page.locator('#hr-workspace option').count(),2);
    assert.equal(await page.locator('#hr-count').textContent(),'0','New workspace leaked first company employees');
    const firstWorkspace=await page.evaluate(()=>window.__hrTest.tables.hr_saas_workspaces[0].id);
    await page.locator('#hr-workspace').selectOption(firstWorkspace);
    await page.waitForFunction(()=>document.querySelector('#hr-count').textContent==='1');
    assert.equal(await page.locator('#hr-app').isVisible(),true,'Returning to first workspace hid HR application');

    // Owner request inbox must read actual self-service requests, not generic HR records.
    await page.evaluate(()=>{
     const t=window.__hrTest.tables;
     t.hr_saas_employee_requests.push({
      id:'70000000-0000-4000-8000-000000000009',
      workspace_id:t.hr_saas_workspaces[0].id,employee_id:t.hr_saas_employees[0].id,
      requested_by:'80000000-0000-4000-8000-000000000009',
      request_type:'leave',subject:'Owner request inbox check',
      description:'Annual leave',status:'pending',created_at:new Date().toISOString()
     });
    });
    await page.locator('[data-hr-category="employee_requests"]').click();
    await page.waitForFunction(()=>document.querySelector('#hr-body')?.textContent.includes('Owner request inbox check'));
    assert.equal(await page.locator('#hr-add').isVisible(),false,'Request inbox must not create generic HR records');
    await page.locator('#hr-body [data-hr-request-decision="approved"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_employee_requests[0].status==='approved');
    assert.equal(await page.locator('#hr-body [data-hr-request-decision]').count(),0,'Approved request must not be decided again');
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_records)).length,0,'Request workflow must not create generic records');

    // Contract must be created in draft status before activation.
    await page.locator('[data-hr-category="contracts"]').click();
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-fields input[name="contract_number"]').fill('CT-001');
    await page.locator('#hr-fields input[name="start_date"]').fill('2026-11-01');
    await page.locator('#hr-fields input[name="end_date"]').fill('2027-10-31');
    await page.locator('#hr-fields input[name="base_salary"]').fill('5000');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_employment_contracts.length===1);
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_employment_contracts[0])).status,'draft');
    // Employee rights are entered as draft claims before review and approval.
    await page.locator('[data-hr-category="claims"]').click();
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-fields input[name="claim_reference"]').fill('BEN-001');
    await page.locator('#hr-fields input[name="description"]').fill('Annual incentive');
    await page.locator('#hr-fields input[name="amount"]').fill('300');
    await page.locator('#hr-fields input[name="effective_date"]').fill('2026-11-17');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_entitlements.length===1);
    const claim=await page.evaluate(()=>window.__hrTest.tables.hr_saas_entitlements[0]);
    assert.equal(claim.status,'draft');
    assert.equal(claim.amount,300);
    await page.locator('[data-hr-category="leave_balances"]').click();
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-fields input[name="entry_reference"]').fill('BAL-001');
    await page.locator('#hr-fields input[name="effective_date"]').fill('2026-11-17');
    await page.locator('#hr-fields input[name="days_delta"]').fill('20');
    await page.locator('#hr-fields input[name="reason"]').fill('Opening balance');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_leave_ledger.length===1);
    assert.equal(await page.locator('#hr-balance-summary').isVisible(),true);
    const adjustment=await page.evaluate(()=>window.__hrTest.tables.hr_saas_leave_ledger[0]);
    assert.equal(adjustment.days_delta,20);
    assert.equal(adjustment.status,'draft');
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
    // Payroll stays independent of CRM and cannot be mistaken for bank settlement.
    await page.locator('[data-hr-category="payroll_runs"]').click();
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields input[name="payroll_year"]').fill('2026');
    await page.locator('#hr-fields input[name="payroll_month"]').fill('11');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_payroll_periods.length===1);
    await page.locator('[data-hr-category="payroll"]').click();
    await page.locator('#hr-add').click();
    await page.locator('#hr-fields select[name="period_id"]').selectOption({index:1});
    await page.locator('#hr-fields select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-fields input[name="base_salary"]').fill('5000');
    await page.locator('#hr-fields input[name="allowance_total"]').fill('600');
    await page.locator('#hr-fields input[name="deduction_total"]').fill('100');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_payroll_lines.length===1);
    const payroll=await page.evaluate(()=>window.__hrTest.tables.hr_saas_payroll_lines[0]);
    assert.equal(payroll.base_salary,5000);
    assert.equal(payroll.allowance_total,600);
    assert.equal(payroll.deduction_total,100);
    assert.equal(await page.locator('#hr-count').textContent(),'1');


    await page.locator('#crm-product-tab').click();
    assert.equal(await page.locator('#crm-nav').isVisible(),true,'CRM program was not restored');
    assert.equal(await page.locator('#hr-section').isVisible(),false,'HR data displayed while CRM selected');
    // Clicking the already selected CRM tab must not hide CRM state.
    const crmBeforeRepeat=await page.locator('#workspace-content').isVisible();
    await page.locator('#crm-product-tab').click();
    assert.equal(await page.locator('#workspace-content').isVisible(),crmBeforeRepeat,'Repeated CRM click changed workspace visibility');
    await page.locator('#hr-product-tab').click();
    // Clicking active HR again must not overwrite the saved CRM display state.
    await page.locator('#hr-product-tab').click();
    await page.locator('#crm-product-tab').click();
    assert.equal(await page.locator('#workspace-content').isVisible(),crmBeforeRepeat,'Repeated HR click lost CRM workspace state');
    await page.locator('#hr-product-tab').click();
    assert.equal(await page.locator('#hr-app').isVisible(),true,'HR program was not restored');
    const employee=await page.evaluate(()=>window.__hrTest.tables.hr_saas_employees[0]);
    assert.equal(employee.employee_number,'HR-001');
    // Only the workspace owner may provision registered HR memberships.
    await page.locator('#hr-member-form input[name="user_id"]').fill('80000000-0000-4000-8000-000000000004');
    await page.locator('#hr-member-form select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-member-form select[name="role"]').selectOption('hr_manager');
    await page.locator('#hr-member-form button[type="submit"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_memberships.length===1);
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_memberships[0])).role,'hr_manager');
   }
   assert.deepEqual(errors,[],'Client runtime error: '+errors.join('; '));
   await page.close();
  }
  console.log('HR SHARED DASHBOARD BROWSER ACCEPTANCE PASS — license gating, owner grants, staff requests, manager decisions, employee/contract/rights/balances/attendance/leave/payroll draft saves and switching programs');
 }finally{await browser.close();}
}
run().catch(e=>{console.error('HR BROWSER ACCEPTANCE FAIL',e);process.exitCode=1;});
