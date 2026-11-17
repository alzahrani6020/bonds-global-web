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
     crm_app_workspaces:[],
     company_program_entitlements:isLicensed?[{owner_user_id:user.id,product_code:'hr',status:'active',starts_at:'2020-01-01T00:00:00.000Z',ends_at:null}]:[],
     hr_saas_workspaces:[],hr_saas_employees:[],hr_saas_records:[],hr_saas_audit:[],hr_saas_attendance:[],hr_saas_leave_requests:[],hr_saas_payroll_periods:[],hr_saas_payroll_lines:[],hr_saas_employment_contracts:[],hr_saas_entitlements:[],hr_saas_leave_ledger:[],hr_saas_leave_balance_summary:[],
     hr_saas_invitations:[],hr_saas_rule_sets:[],hr_saas_calculation_drafts:[],
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
       if(kind==='read'&&table==='hr_saas_employees'&&window.__hrTest.delayNextEmployeesRead){
        window.__hrTest.delayNextEmployeesRead=false;
        await new Promise(resolve=>setTimeout(resolve,200));
       }
       if(kind==='insert'){
        const record={...value,id:'20000000-0000-4000-8000-'+String(++next).padStart(12,'0'),created_at:new Date().toISOString()};
        if(table==='hr_saas_invitations')Object.assign(record,{token:'90000000-0000-4000-8000-'+String(next).padStart(12,'0'),status:'pending',expires_at:'2027-01-01T00:00:00Z'});
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
    const supabase={auth:{getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:{user,access_token:'test-mock-access-token'}},error:null})},from,
     rpc:async(name,args)=>{
      if(name!=='hr_saas_accept_invitation')throw Error('Unexpected RPC '+name);
      const invite=tables.hr_saas_invitations.find(x=>x.token===args.invite_token&&x.status==='pending');
      if(!invite)return {data:null,error:{message:'Invalid invitation'}};
      invite.status='accepted';
      const membership={id:'30000000-0000-4000-8000-000000000001',workspace_id:invite.workspace_id,employee_id:invite.employee_id,user_id:user.id,role:invite.role,status:'active'};
      tables.hr_saas_memberships.push(membership);
      return {data:membership.id,error:null};
     }};
    window.BondsAuth={ensureEnv:async()=>({}),getSupabase:()=>supabase};
   },{isLicensed:licensed,scenario});
   await page.route('**/api/hr-calculations',async route=>{
    const body=route.request().postDataJSON();
    if(scenario!=='owner')return route.fulfill({status:403,contentType:'application/json',body:'{"error":"Forbidden"}'});
    const response=await page.evaluate(payload=>{
     const rows=window.__hrTest.tables.hr_saas_calculation_drafts;
     const result={policy_id:payload.policy_id,as_of:payload.inputs.as_of,eligible_days:payload.inputs.eligible_days,accrued_days:30,status:'draft_review_required'};
     const id='90000000-0000-4000-8000-000000000008';
     rows.push({...payload,id,result,status:'draft'});
     return {id,result,policy_id:payload.policy_id,status:'draft'};
    },body);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
   });
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
    // Owner can issue verified-email invitations without knowing a user's UUID.
    await page.locator('#hr-invite-form input[name="email"]').fill('invitee@example.test');
    await page.locator('#hr-invite-form select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-invite-form button[type="submit"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_invitations.length===1);
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_invitations[0])).invited_email,'invitee@example.test');
    assert.equal(await page.locator('#hr-invites-table [data-hr-invite-link]').count(),1);

    // Newly created HR workspaces must remain selectable without mixing tenant records.
    await page.locator('#hr-create-workspace input[name="name"]').fill('Second HR Company');
    await page.locator('#hr-create-workspace button[type="submit"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_workspaces.length===2);
    assert.equal(await page.locator('#hr-workspace option').count(),2);
    assert.equal(await page.locator('#hr-count').textContent(),'0','New workspace leaked first company employees');
    const firstWorkspace=await page.evaluate(()=>window.__hrTest.tables.hr_saas_workspaces[0].id);
    const firstCompany=await page.evaluate(()=>window.__hrTest.tables.crm_app_workspaces[0].id);
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_workspaces[0])).crm_workspace_id,firstCompany);
    await page.locator('#hr-workspace').selectOption(firstCompany);
    await page.waitForFunction(()=>document.querySelector('#hr-count').textContent==='1');
    assert.equal(await page.locator('#hr-app').isVisible(),true,'Returning to first workspace hid HR application');
    // Delayed reads from the old workspace cannot repopulate the new one.
    await page.evaluate(()=>{window.__hrTest.delayNextEmployeesRead=true;});
    await page.locator('#hr-refresh').click();
    const secondWorkspace=await page.evaluate(()=>window.__hrTest.tables.hr_saas_workspaces[1].id);
    const secondCompany=await page.evaluate(()=>window.__hrTest.tables.crm_app_workspaces[1].id);
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_workspaces[1])).crm_workspace_id,secondCompany);
    await page.locator('#hr-workspace').selectOption(secondCompany);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#hr-count').textContent(),'0','Stale first-workspace read leaked into the second workspace');
    await page.locator('#hr-workspace').selectOption(firstCompany);
    await page.waitForFunction(()=>document.querySelector('#hr-count').textContent==='1');

    // Owner policy lifecycle: company-reviewed version, then persisted calculation draft.
    await page.waitForFunction(()=>!document.querySelector('#hr-policy-panel').hidden);
    await page.locator('#hr-policy-form input[name="jurisdiction"]').fill('SA');
    await page.locator('#hr-policy-form input[name="effective_from"]').fill('2026-01-01');
    await page.locator('#hr-policy-form input[name="annual_leave_days"]').fill('30');
    await page.locator('#hr-policy-form input[name="accrual_year_days"]').fill('365');
    await page.locator('#hr-policy-form textarea[name="service_tiers"]').fill('[{"through_days":3650,"wage_days_per_service_day":0.002}]');
    await page.locator('#hr-policy-form button[type="submit"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_rule_sets.length===1);
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_rule_sets[0])).status,'draft');
    await page.locator('#hr-policy-rows [data-hr-policy-approve]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_rule_sets[0].status==='approved');
    await page.locator('#hr-calculation-form select[name="employee_id"]').selectOption({index:1});
    await page.locator('#hr-calculation-form select[name="policy_id"]').selectOption({index:1});
    await page.locator('#hr-calculation-form input[name="as_of"]').fill('2026-11-17');
    await page.locator('#hr-calculation-form input[name="eligible_days"]').fill('365');
    await page.locator('#hr-calculation-form button[type="submit"]').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_calculation_drafts.length===1);
    const savedDraft=await page.evaluate(()=>window.__hrTest.tables.hr_saas_calculation_drafts[0]);
    assert.equal(savedDraft.workspace_id,firstWorkspace);
    assert.equal(savedDraft.status,'draft');
    assert.equal(savedDraft.result.accrued_days,30);
    await page.locator('#hr-calculation-result').waitFor({state:'visible'});
    assert.equal(await page.locator('#hr-calculation-result').isVisible(),true);
    assert.equal((await page.evaluate(()=>window.__hrTest.tables.hr_saas_records)).length,0,'Calculation must not post a generic HR payment record');

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
    // Editing a contract must retain immutable employee/contract identity.
    await page.locator('#hr-body [data-hr-edit]').first().click();
    await page.locator('#hr-fields input[name="base_salary"]').fill('5200');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_employment_contracts[0].base_salary===5200,null,{timeout:4000}).catch(async error=>{
     const diagnostic=await page.evaluate(()=>({
      saved:window.__hrTest.tables.hr_saas_employment_contracts[0],
      notice:document.querySelector('#hr-status')?.textContent,
      editorHidden:document.querySelector('#hr-editor')?.hidden,
      formValid:document.querySelector('#hr-save-form')?.checkValidity(),
      fields:[...document.querySelectorAll('#hr-fields [name]')].map(x=>({name:x.name,value:x.value,valid:x.checkValidity()}))
     }));
     throw Error('Contract edit did not persist: '+JSON.stringify(diagnostic)+'; '+error.message);
    });
    const revisedContract=await page.evaluate(()=>window.__hrTest.tables.hr_saas_employment_contracts[0]);
    assert.equal(revisedContract.contract_number,'CT-001','Contract identity changed on edit');
    assert.equal(revisedContract.employee_id,(await page.evaluate(()=>window.__hrTest.tables.hr_saas_employees[0].id)),'Contract employee identity changed');

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
    // Editing one payroll amount must not null the immutable period/employee keys.
    await page.locator('#hr-body [data-hr-edit]').first().click();
    await page.locator('#hr-fields input[name="allowance_total"]').fill('650');
    await page.locator('#hr-save').click();
    await page.waitForFunction(()=>window.__hrTest.tables.hr_saas_payroll_lines[0].allowance_total===650);
    const revisedPayroll=await page.evaluate(()=>window.__hrTest.tables.hr_saas_payroll_lines[0]);
    assert.equal(revisedPayroll.period_id,(await page.evaluate(()=>window.__hrTest.tables.hr_saas_payroll_periods[0].id)));
    assert.equal(revisedPayroll.employee_id,(await page.evaluate(()=>window.__hrTest.tables.hr_saas_employees[0].id)));

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
