'use strict';
// Run ONLY after the CRM isolated fixture in the same disposable PostgreSQL CI job.
// Never point to a production/sandbox Supabase database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Client}=require('pg'),{randomUUID}=require('node:crypto');
async function main(){
 const url=process.env.CRM_TEST_DATABASE_URL;
 if(!url||!/^(?:postgres(?:ql)?:\/\/)/.test(url)||!/localhost|127\.0\.0\.1/.test(url)||/supabase\.co|bonds-global/i.test(url))
  throw Error('HR acceptance requires disposable localhost CRM_TEST_DATABASE_URL');
 const db=new Client({connectionString:url,connectionTimeoutMillis:5000});
 await db.connect();
 try{
  const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261117040000_standalone_hr_saas_baseline.sql'),'utf8');
  await db.query(migration);
  const opsMigration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261117060000_hr_saas_attendance_leaves.sql'),'utf8');
  await db.query(opsMigration);
  const payrollMigration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261117070000_hr_saas_payroll_review.sql'),'utf8');
  await db.query(payrollMigration);
  const contractMigration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261117080000_hr_saas_employment_contracts.sql'),'utf8');
  await db.query(contractMigration);
  const rightsMigration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261117090000_hr_saas_entitlements.sql'),'utf8');
  await db.query(rightsMigration);
  const balanceMigration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261117100000_hr_saas_leave_ledger.sql'),'utf8');
  await db.query(balanceMigration);
  const rolesMigration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261117110000_hr_saas_roles_self_service.sql'),'utf8');
  await db.query(rolesMigration);

  const ids=[randomUUID(),randomUUID(),randomUUID()];
  await db.query('insert into auth.users(id) values($1),($2),($3)',ids);
  async function as(user,callback){
   await db.query('begin');
   try{
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
    const result=await callback();
    await db.query('commit');
    return result;
   }catch(e){await db.query('rollback');throw e;}
  }
  const [owner,other,crmOnly]=ids;
  const sqlRows=await db.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname=any($1)",[['hr_saas_workspaces','hr_saas_employees','hr_saas_records','hr_saas_audit','company_program_entitlements']]);
  assert.equal(sqlRows.rowCount,5);
  for(const x of sqlRows.rows)assert.equal(x.relrowsecurity,true,x.relname+' RLS missing');
  await assert.rejects(()=>as(owner,()=>db.query("insert into company_program_entitlements(owner_user_id,product_code,status) values($1,'hr','active')",[owner])),
   error=>error.code==='42501','A client must never self-grant a purchased program');
  await assert.rejects(()=>as(owner,()=>db.query("insert into hr_saas_workspaces(owner_user_id,name) values($1,'Unlicensed Workspace')",[owner])),
   error=>error.code==='42501','Unlicensed user should not create HR workspace');
  // Administrative billing/provisioning fixture (not accessible to browser).
  await db.query("insert into company_program_entitlements(owner_user_id,product_code,status) values($1,'hr','active'),($2,'crm','active'),($3,'hr','active')",[owner,crmOnly,other]);
  const listed=await as(owner,()=>db.query('select owner_user_id from company_program_entitlements order by owner_user_id'));
  assert.equal(listed.rowCount,1,'Entitlements must not leak between accounts');
  const noHr=await as(crmOnly,()=>db.query('select id from hr_saas_workspaces'));
  assert.equal(noHr.rowCount,0,'A CRM-only purchase may not expose HR workspaces');
  await assert.rejects(()=>as(crmOnly,()=>db.query("insert into hr_saas_workspaces(owner_user_id,name) values($1,'CRM Only')",[crmOnly])),
   error=>error.code==='42501','CRM-only purchaser must not access HR');
  const wa=(await as(owner,()=>db.query("insert into hr_saas_workspaces(owner_user_id,name) values($1,'HR Tenant A') returning id",[owner]))).rows[0].id;
  const wb=(await as(other,()=>db.query("insert into hr_saas_workspaces(owner_user_id,name) values($1,'HR Tenant B') returning id",[other]))).rows[0].id;
  const employee=(await as(owner,()=>db.query("insert into hr_saas_employees(workspace_id,employee_number,full_name,basic_salary) values($1,'EMP-01','Employee A',5000) returning id",[wa]))).rows[0].id;
  const another=(await as(other,()=>db.query("insert into hr_saas_employees(workspace_id,employee_number,full_name) values($1,'EMP-01','Employee B') returning id",[wb]))).rows[0].id;
  assert.notEqual(employee,another);
  const privateEmployee=await as(other,()=>db.query('select id from hr_saas_employees where id=$1',[employee]));
  assert.equal(privateEmployee.rowCount,0,'HR personnel data leaked across tenants');
  const privatePayroll=await as(other,()=>db.query('select basic_salary from hr_saas_employees where id=$1',[employee]));
  assert.equal(privatePayroll.rowCount,0,'HR salary leaked across tenants');
  await assert.rejects(()=>as(owner,()=>db.query("insert into hr_saas_records(workspace_id,employee_id,category,title) values($1,$2,'contracts','Cross-tenant contract')",[wa,another])),
   error=>error.code==='23503','Employee relations must be bound to same HR workspace');
  const rec=(await as(owner,()=>db.query("insert into hr_saas_records(workspace_id,employee_id,category,title,amount) values($1,$2,'payroll','Draft payroll',5000) returning id",[wa,employee]))).rows[0].id;
  const audit=await as(owner,()=>db.query("select entity,actor_user_id,changed_columns from hr_saas_audit where workspace_id=$1",[wa]));
  assert.ok(audit.rows.some(r=>r.entity==='hr_saas_employees'&&r.changed_columns.includes('basic_salary')));
  assert.ok(audit.rows.some(r=>r.entity==='hr_saas_records'&&r.actor_user_id===owner));
  await assert.rejects(()=>as(owner,()=>db.query("insert into hr_saas_audit(workspace_id,actor_user_id,entity,entity_id,action) values($1,$2,'forged',$3,'INSERT')",[wa,owner,randomUUID()])),
   error=>error.code==='42501','Audit table must reject direct forgery');
  const hiddenAudit=await as(other,()=>db.query('select id from hr_saas_audit where workspace_id=$1',[wa]));
  assert.equal(hiddenAudit.rowCount,0,'HR audit leaked across tenants');
  await db.query("update company_program_entitlements set status='cancelled' where owner_user_id=$1 and product_code='hr'",[owner]);
  const revoked=await as(owner,()=>db.query('select id from hr_saas_employees where id=$1',[employee]));
  assert.equal(revoked.rowCount,0,'Cancelled HR subscription must revoke read access');
  await assert.rejects(()=>as(owner,()=>db.query("insert into hr_saas_records(workspace_id,employee_id,category,title) values($1,$2,'leaves','After cancellation')",[wa,employee])),
   error=>error.code==='42501','Cancelled HR subscription must revoke writes');
  // Restore entitlement in privileged fixture to validate real attendance and leave workflows.
  await db.query("update company_program_entitlements set status='active' where owner_user_id=$1 and product_code='hr'",[owner]);
  const attendance=await as(owner,()=>db.query(
   "insert into hr_saas_attendance(workspace_id,employee_id,work_date,attendance_status,clock_in,clock_out) values($1,$2,'2026-11-17','present','2026-11-17 08:00+03','2026-11-17 16:00+03') returning id",
   [wa,employee]));
  assert.equal(attendance.rowCount,1);
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_attendance(workspace_id,employee_id,work_date,attendance_status) values($1,$2,'2026-11-17','absent')",[wa,employee])),
   e=>e.code==='23505','Duplicate attendance date should be rejected');
  await assert.rejects(()=>as(other,()=>db.query(
   "insert into hr_saas_attendance(workspace_id,employee_id,work_date,attendance_status) values($1,$2,'2026-11-18','present')",[wa,employee])),
   e=>e.code==='42501','Other company must not write attendance');
  const leave=await as(owner,()=>db.query(
   "insert into hr_saas_leave_requests(workspace_id,employee_id,leave_type,start_date,end_date,status,decided_at) values($1,$2,'annual','2026-12-01','2026-12-03','approved',now()) returning id",
   [wa,employee]));
  assert.equal(leave.rowCount,1);
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_leave_requests(workspace_id,employee_id,leave_type,start_date,end_date,status,decided_at) values($1,$2,'annual','2026-12-02','2026-12-04','approved',now())",[wa,employee])),
   e=>e.code==='23514','Approved leave intervals must not overlap');
  const outsiderLeaves=await as(other,()=>db.query("select id from hr_saas_leave_requests where workspace_id=$1",[wa]));
  assert.equal(outsiderLeaves.rowCount,0,'Other company could read private leave');
  const outsiderAttendance=await as(other,()=>db.query("select id from hr_saas_attendance where workspace_id=$1",[wa]));
  assert.equal(outsiderAttendance.rowCount,0,'Other company could read attendance');
  const auditOps=await as(owner,()=>db.query("select entity from hr_saas_audit where workspace_id=$1 and entity in ('hr_saas_attendance','hr_saas_leave_requests')",[wa]));
  assert.equal(auditOps.rowCount,2,'Operational writes need an immutable audit');
  const period=(await as(owner,()=>db.query(
   "insert into hr_saas_payroll_periods(workspace_id,payroll_year,payroll_month) values($1,2026,11) returning id",[wa]))).rows[0].id;
  const line=(await as(owner,()=>db.query(
   "insert into hr_saas_payroll_lines(workspace_id,period_id,employee_id,base_salary,allowance_total,deduction_total) values($1,$2,$3,5000,600,100) returning id,net_salary",
   [wa,period,employee]))).rows[0];
  assert.equal(Number(line.net_salary),5500,'Net salary must be basic plus allowances minus deductions');
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_payroll_lines(workspace_id,period_id,employee_id,base_salary) values($1,$2,$3,5000)",[wa,period,employee])),
   e=>e.code==='23505','Employee may only appear once per payroll period');
  await assert.rejects(()=>as(other,()=>db.query(
   "insert into hr_saas_payroll_lines(workspace_id,period_id,employee_id,base_salary) values($1,$2,$3,5000)",[wa,period,employee])),
   e=>['42501','23514'].includes(e.code),'Other tenant may not write payroll (RLS denial or invisible locked payroll period)');
  const kept=await db.query("select count(*)::int as n from hr_saas_payroll_lines where workspace_id=$1 and period_id=$2",[wa,period]);
  assert.equal(kept.rows[0].n,1,'Denied cross-tenant attempt must leave payroll line count unchanged');
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_payroll_periods set status='approved',approved_at=now() where id=$1",[period])),
   e=>e.code==='23514','Payroll approval must require review');
  await as(owner,()=>db.query("update hr_saas_payroll_periods set status='reviewed' where id=$1",[period]));
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_payroll_lines set allowance_total=700 where id=$1",[line.id])),
   e=>e.code==='23514','Reviewed payroll must freeze line items');
  await as(owner,()=>db.query("update hr_saas_payroll_periods set status='approved' where id=$1",[period]));
  const approved=await as(owner,()=>db.query("select status,approved_at from hr_saas_payroll_periods where id=$1",[period]));
  assert.equal(approved.rows[0].status,'approved');
  assert.ok(approved.rows[0].approved_at);
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_payroll_periods set status='draft' where id=$1",[period])),
   e=>e.code==='23514','Approved payroll must be immutable');
  const notVisible=await as(other,()=>db.query("select id from hr_saas_payroll_lines where period_id=$1",[period]));
  assert.equal(notVisible.rowCount,0,'Another company read payroll amounts');
  const auditPayroll=await as(owner,()=>db.query("select entity from hr_saas_audit where workspace_id=$1 and entity in ('hr_saas_payroll_lines','hr_saas_payroll_periods')",[wa]));
  assert.ok(auditPayroll.rowCount>=4,'Payroll creation/review/approval should be audited');
  await assert.rejects(()=>as(owner,()=>db.query(
    "insert into hr_saas_employment_contracts(workspace_id,employee_id,contract_number,contract_type,status,start_date,base_salary) values($1,$2,'C-001','fixed_term','active','2026-11-01',5000)",[wa,employee])),
    e=>e.code==='23514','Contracts must begin as a draft');
  const contract=(await as(owner,()=>db.query(
   "insert into hr_saas_employment_contracts(workspace_id,employee_id,contract_number,contract_type,start_date,end_date,probation_end_date,base_salary) values($1,$2,'C-001','fixed_term','2026-11-01','2027-10-31','2027-01-31',5000) returning id",
   [wa,employee]))).rows[0].id;
  await as(owner,()=>db.query("update hr_saas_employment_contracts set status='active' where id=$1",[contract]));
  const activeContract=await as(owner,()=>db.query("select activated_at,status from hr_saas_employment_contracts where id=$1",[contract]));
  assert.equal(activeContract.rows[0].status,'active');
  assert.ok(activeContract.rows[0].activated_at,'Contract activation is timestamped');
  const overlapping=(await as(owner,()=>db.query(
   "insert into hr_saas_employment_contracts(workspace_id,employee_id,contract_number,contract_type,start_date,end_date,base_salary) values($1,$2,'C-002','fixed_term','2027-01-01','2027-12-31',5500) returning id",
   [wa,employee]))).rows[0].id;
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_employment_contracts set status='active' where id=$1",[overlapping])),
   e=>e.code==='23514','Overlapping contracts may not both be active');
  await assert.rejects(()=>as(other,()=>db.query(
   "insert into hr_saas_employment_contracts(workspace_id,employee_id,contract_number,contract_type,start_date,base_salary) values($1,$2,'C-003','indefinite','2026-11-01',5000)",[wa,employee])),
   e=>e.code==='42501','Cross-tenant contract write must fail');
  await as(owner,()=>db.query("update hr_saas_employment_contracts set status='terminated',termination_reason='Internal test' where id=$1",[contract]));
  const closedContract=await as(owner,()=>db.query("select status,terminated_at from hr_saas_employment_contracts where id=$1",[contract]));
  assert.equal(closedContract.rows[0].status,'terminated');
  assert.ok(closedContract.rows[0].terminated_at,'Termination must be timestamped');
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_employment_contracts set base_salary=6000 where id=$1",[contract])),
   e=>e.code==='23514','Closed contract cannot be rewritten');
  const otherContracts=await as(other,()=>db.query("select id from hr_saas_employment_contracts where workspace_id=$1",[wa]));
  assert.equal(otherContracts.rowCount,0,'Contracts must not leak to another company');
  const originalContracts=await db.query("select count(*)::int as n from hr_saas_employment_contracts where workspace_id=$1",[wa]);
  assert.equal(originalContracts.rows[0].n,2,'Closed contracts remain stored');
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_entitlements(workspace_id,employee_id,claim_reference,claim_type,description,amount,effective_date,status) values($1,$2,'R-001','bonus','Test bonus',300,'2026-11-17','approved')",[wa,employee])),
   e=>e.code==='23514','Rights claim must begin as draft');
  const claim=(await as(owner,()=>db.query(
   "insert into hr_saas_entitlements(workspace_id,employee_id,claim_reference,claim_type,description,amount,effective_date) values($1,$2,'R-001','bonus','Test bonus',300,'2026-11-17') returning id",[wa,employee]))).rows[0].id;
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_entitlements set status='approved' where id=$1",[claim])),
   e=>e.code==='23514','Rights require submission before approval');
  await as(owner,()=>db.query("update hr_saas_entitlements set status='submitted' where id=$1",[claim]));
  await as(owner,()=>db.query("update hr_saas_entitlements set status='approved' where id=$1",[claim]));
  const approvedClaim=await as(owner,()=>db.query("select status,decided_at from hr_saas_entitlements where id=$1",[claim]));
  assert.equal(approvedClaim.rows[0].status,'approved');
  assert.ok(approvedClaim.rows[0].decided_at);
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_entitlements set amount=350 where id=$1",[claim])),
   e=>e.code==='23514','Approved rights may not be rewritten');
  const otherRights=await as(other,()=>db.query("select id from hr_saas_entitlements where workspace_id=$1",[wa]));
  assert.equal(otherRights.rowCount,0,'Entitlements must remain company private');
  const stillStored=await db.query("select count(*)::int as n from hr_saas_entitlements where workspace_id=$1",[wa]);
  assert.equal(stillStored.rows[0].n,1,'Rights history must not be deleted');
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_leave_ledger(workspace_id,employee_id,entry_reference,leave_type,effective_date,days_delta,reason,status) values($1,$2,'L-001','annual','2026-11-17',20,'Opening balance','approved')",[wa,employee])),
   e=>e.code==='23514','Leave balance adjustment must start draft');
  const adjustment=(await as(owner,()=>db.query(
   "insert into hr_saas_leave_ledger(workspace_id,employee_id,entry_reference,leave_type,effective_date,days_delta,reason) values($1,$2,'L-001','annual','2026-11-17',20,'Opening balance') returning id",[wa,employee]))).rows[0].id;
  await as(owner,()=>db.query("update hr_saas_leave_ledger set status='approved' where id=$1",[adjustment]));
  const balance=await as(owner,()=>db.query("select days_balance from hr_saas_leave_balance_summary where workspace_id=$1 and employee_id=$2 and leave_type='annual'",[wa,employee]));
  assert.equal(Number(balance.rows[0].days_balance),20,'Approved leave entries form the current balance');
  await assert.rejects(()=>as(owner,()=>db.query("update hr_saas_leave_ledger set days_delta=22 where id=$1",[adjustment])),
   e=>e.code==='23514','Approved leave balance entry is immutable');
  const outsiderBalance=await as(other,()=>db.query("select * from hr_saas_leave_balance_summary where workspace_id=$1",[wa]));
  assert.equal(outsiderBalance.rowCount,0,'Security invoker balance view leaked another company');
  const ledgerAudit=await as(owner,()=>db.query("select id from hr_saas_audit where workspace_id=$1 and entity='hr_saas_leave_ledger'",[wa]));
  assert.equal(ledgerAudit.rowCount,2,'Leave ledger creation and approval must both be audited');
  // Real SQL acceptance: a verified user linked to a workspace employee may file
  // their own request, but neither grant roles nor approve or read salary records.
  const employeeAccount=randomUUID(),managerAccount=randomUUID(),unrelatedAccount=randomUUID();
  await db.query('insert into auth.users(id) values($1),($2),($3)',[employeeAccount,managerAccount,unrelatedAccount]);
  const managerEmployee=(await as(owner,()=>db.query(
   "insert into hr_saas_employees(workspace_id,employee_number,full_name) values($1,'HR-002','Human Resources Manager') returning id",[wa]))).rows[0].id;
  await as(owner,()=>db.query(
   "insert into hr_saas_memberships(workspace_id,user_id,employee_id,role) values($1,$2,$3,'employee'),($1,$4,$5,'hr_manager')",
   [wa,employeeAccount,employee,managerAccount,managerEmployee]));
  const memberRead=await as(employeeAccount,()=>db.query(
   'select role,employee_id from hr_saas_memberships where workspace_id=$1',[wa]));
  assert.equal(memberRead.rowCount,1);
  assert.equal(memberRead.rows[0].role,'employee');
  assert.equal(memberRead.rows[0].employee_id,employee);
  const otherMember=await as(other,()=>db.query('select id from hr_saas_memberships where workspace_id=$1',[wa]));
  assert.equal(otherMember.rowCount,0,'Other tenant can never enumerate HR roles');
  await assert.rejects(()=>as(employeeAccount,()=>db.query(
   "insert into hr_saas_memberships(workspace_id,user_id,employee_id,role) values($1,$2,$3,'hr_manager')",
   [wa,unrelatedAccount,managerEmployee])), e=>e.code==='42501','Employee cannot grant roles');
  const unprivilegedPromotion=await as(employeeAccount,()=>db.query(
   "update hr_saas_memberships set role='hr_manager' where workspace_id=$1 and user_id=$2 returning id",
   [wa,employeeAccount]));
  assert.equal(unprivilegedPromotion.rowCount,0,'Employee cannot promote own role');
  const salaries=await as(managerAccount,()=>db.query('select basic_salary from hr_saas_employees where workspace_id=$1',[wa]));
  assert.equal(salaries.rowCount,0,'HR manager may not read salary via employee table');
  const contractPrivate=await as(managerAccount,()=>db.query('select id from hr_saas_employment_contracts where workspace_id=$1',[wa]));
  assert.equal(contractPrivate.rowCount,0,'HR manager may not view contracts without separate grants');
  const selfRequest=(await as(employeeAccount,()=>db.query(
   "insert into hr_saas_employee_requests(workspace_id,employee_id,requested_by,request_type,subject,description,from_date,to_date) values($1,$2,$3,'leave','Annual leave','Please approve annual leave','2027-01-10','2027-01-12') returning id",
   [wa,employee,employeeAccount]))).rows[0].id;
  await assert.rejects(()=>as(employeeAccount,()=>db.query(
   "insert into hr_saas_employee_requests(workspace_id,employee_id,requested_by,request_type,subject,description) values($1,$2,$3,'certificate','Forgery','Someone else request')",
   [wa,managerEmployee,employeeAccount])),e=>e.code==='42501','Employee cannot file on another employee identity');
  const illicitApproval=await as(employeeAccount,()=>db.query(
   "update hr_saas_employee_requests set status='approved' where id=$1 returning id",[selfRequest]));
  assert.equal(illicitApproval.rowCount,0,'Employee cannot approve own request');
  const managerQueue=await as(managerAccount,()=>db.query(
   'select id,employee_id,status from hr_saas_employee_requests where workspace_id=$1',[wa]));
  assert.equal(managerQueue.rowCount,1,'HR manager reads approval queue');
  await as(managerAccount,()=>db.query(
   "update hr_saas_employee_requests set status='approved',decision_note='Manager approval' where id=$1",[selfRequest]));
  const decided=await as(employeeAccount,()=>db.query(
   'select status,decided_by,decided_at from hr_saas_employee_requests where id=$1',[selfRequest]));
  assert.equal(decided.rows[0].status,'approved');
  assert.equal(decided.rows[0].decided_by,managerAccount);
  assert.ok(decided.rows[0].decided_at);
  await assert.rejects(()=>as(managerAccount,()=>db.query(
   "update hr_saas_employee_requests set status='rejected' where id=$1",[selfRequest])),
   e=>e.code==='23514','Decided request cannot be rewritten');
  const nonmember=await as(unrelatedAccount,()=>db.query(
   'select id from hr_saas_employee_requests where workspace_id=$1',[wa]));
  assert.equal(nonmember.rowCount,0,'Authenticated unrelated account has no request access');
  // A manager in tenant A who is only an employee in tenant B
  // must NOT inherit manager rights in tenant B.
  const tenantBEmployeeAccount=randomUUID();
  await db.query('insert into auth.users(id) values($1)',[tenantBEmployeeAccount]);
  const tenantBSecondEmployee=(await as(other,()=>db.query(
   "insert into hr_saas_employees(workspace_id,employee_number,full_name) values($1,'HR-B-002','Tenant B Second Employee') returning id",[wb]))).rows[0].id;
  await as(other,()=>db.query(
   "insert into hr_saas_memberships(workspace_id,user_id,employee_id,role) values($1,$2,$3,'employee'),($1,$4,$5,'employee')",
   [wb,managerAccount,another,tenantBEmployeeAccount,tenantBSecondEmployee]));
  const otherTenantRequest=(await as(tenantBEmployeeAccount,()=>db.query(
   "insert into hr_saas_employee_requests(workspace_id,employee_id,requested_by,request_type,subject,description) values($1,$2,$3,'certificate','Tenant B request','Must stay private') returning id",
   [wb,tenantBSecondEmployee,tenantBEmployeeAccount]))).rows[0].id;
  const managerRoleBleed=await as(managerAccount,()=>db.query(
   "update hr_saas_employee_requests set status='approved' where id=$1 returning id",[otherTenantRequest]));
  assert.equal(managerRoleBleed.rowCount,0,'HR manager in tenant A must never approve requests in tenant B where only an employee');
  const tenantBRequestStillPending=await as(tenantBEmployeeAccount,()=>db.query(
   'select status from hr_saas_employee_requests where id=$1',[otherTenantRequest]));
  assert.equal(tenantBRequestStillPending.rows[0].status,'pending','Cross-company role bleed changed approval');
  await as(owner,()=>db.query(
   "update hr_saas_memberships set status='revoked' where workspace_id=$1 and user_id=$2",[wa,employeeAccount]));
  const revokedMembership=await as(employeeAccount,()=>db.query(
   'select id from hr_saas_memberships where workspace_id=$1',[wa]));
  assert.equal(revokedMembership.rowCount,0,'Revocation must remove membership read access');
  const revokedRequest=await as(employeeAccount,()=>db.query(
   'select id from hr_saas_employee_requests where workspace_id=$1',[wa]));
  assert.equal(revokedRequest.rowCount,0,'Revocation must remove self-service access');
  await assert.rejects(()=>as(employeeAccount,()=>db.query(
   "insert into hr_saas_employee_requests(workspace_id,employee_id,requested_by,request_type,subject,description) values($1,$2,$3,'other','After revocation','Should be forbidden')",
   [wa,employee,employeeAccount])),e=>e.code==='42501','Revoked employee must be blocked from new requests');
  const auditedSelf=await as(owner,()=>db.query(
   "select entity,actor_user_id from hr_saas_audit where workspace_id=$1 and entity in ('hr_saas_memberships','hr_saas_employee_requests')",[wa]));
  assert.ok(auditedSelf.rows.some(x=>x.entity==='hr_saas_employee_requests'&&x.actor_user_id===employeeAccount));
  assert.ok(auditedSelf.rows.some(x=>x.entity==='hr_saas_employee_requests'&&x.actor_user_id===managerAccount));

  // Invitation acceptance is an authenticated, verified-email, one-time SQL transaction.
  const inviteUser=randomUUID(),wrongInviteUser=randomUUID(),unverifiedUser=randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'invited@example.test',now()),($2,'other@example.test',now()),($3,'pending@example.test',null)",
   [inviteUser,wrongInviteUser,unverifiedUser]);
  const inviteEmployee=(await as(owner,()=>db.query(
   "insert into hr_saas_employees(workspace_id,employee_number,full_name) values($1,'HR-INV-001','Invited Employee') returning id",[wa]))).rows[0].id;
  const token=(await as(owner,()=>db.query(
   "insert into hr_saas_invitations(workspace_id,employee_id,invited_email,role,created_by) values($1,$2,'invited@example.test','employee',$3) returning token",
   [wa,inviteEmployee,owner]))).rows[0].token;
  assert.equal(typeof token,'string');
  const hiddenInvites=await as(wrongInviteUser,()=>db.query(
   "select id from hr_saas_invitations where workspace_id=$1",[wa]));
  assert.equal(hiddenInvites.rowCount,0,'Invitations may not leak to other authenticated users');
  await assert.rejects(()=>as(wrongInviteUser,()=>db.query(
   "select public.hr_saas_accept_invitation($1)",[token])),
   e=>e.code==='42501','Wrong verified email must be rejected');
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_invitations(workspace_id,employee_id,invited_email,role,created_by,token) values($1,$2,'test@example.test','employee',$3,$4)",
   [wa,inviteEmployee,owner,randomUUID()])),
   e=>e.code==='42501','Browser owner must not choose invitation token');
  const newMembership=(await as(inviteUser,()=>db.query(
   "select public.hr_saas_accept_invitation($1) as id",[token]))).rows[0].id;
  assert.ok(newMembership,'Verified email redemption did not create membership');
  const bound=await as(inviteUser,()=>db.query(
   "select workspace_id,employee_id,role from hr_saas_memberships where id=$1",[newMembership]));
  assert.equal(bound.rows[0].employee_id,inviteEmployee);
  assert.equal(bound.rows[0].role,'employee');
  await assert.rejects(()=>as(inviteUser,()=>db.query(
   "select public.hr_saas_accept_invitation($1)",[token])),
   e=>e.code==='42501','Token replay must not grant another membership');
  const inviterView=await as(owner,()=>db.query(
   "select status,accepted_by,accepted_at from hr_saas_invitations where token=$1",[token]));
  assert.equal(inviterView.rows[0].status,'accepted');
  assert.equal(inviterView.rows[0].accepted_by,inviteUser);
  assert.ok(inviterView.rows[0].accepted_at);
  const unverifiedEmployee=(await as(owner,()=>db.query(
   "insert into hr_saas_employees(workspace_id,employee_number,full_name) values($1,'HR-INV-002','Unverified Employee') returning id",[wa]))).rows[0].id;
  const unverifiedToken=(await as(owner,()=>db.query(
   "insert into hr_saas_invitations(workspace_id,employee_id,invited_email,role,created_by) values($1,$2,'pending@example.test','employee',$3) returning token",
   [wa,unverifiedEmployee,owner]))).rows[0].token;
  await assert.rejects(()=>as(unverifiedUser,()=>db.query(
   "select public.hr_saas_accept_invitation($1)",[unverifiedToken])),
   e=>e.code==='42501','Unverified email cannot redeem invitation');

  // Provider entitlements require the server-only atomic verified-event RPC.
  const billingOwner=randomUUID();
  await db.query('insert into auth.users(id) values($1)',[billingOwner]);
  const billingFn='public.company_program_apply_stripe_event(text,text,uuid,text,text,text,timestamptz,timestamptz)';
  const perms=await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') as browser, has_function_privilege('service_role',$1,'EXECUTE') as service",[billingFn]);
  assert.equal(perms.rows[0].browser,false,'Browser must not grant company subscriptions');
  assert.equal(perms.rows[0].service,true,'Server service role must have billing RPC authority');
  const billingArgs=['evt_hr_001','sub_hr_001',billingOwner,'hr','price_hr_001','active',new Date(Date.now()-2000),new Date(Date.now()+86400000)];
  await assert.rejects(()=>as(billingOwner,()=>db.query(
   "select public.company_program_apply_stripe_event($1,$2,$3,$4,$5,$6,$7,$8)",billingArgs)),
   e=>e.code==='42501','Browser cannot send fake signed provider event');
  const firstBilling=await db.query(
   "select public.company_program_apply_stripe_event($1,$2,$3,$4,$5,$6,$7,$8) as result",billingArgs);
  assert.equal(firstBilling.rows[0].result,'applied');
  const replayBilling=await db.query(
   "select public.company_program_apply_stripe_event($1,$2,$3,$4,$5,$6,$7,$8) as result",billingArgs);
  assert.equal(replayBilling.rows[0].result,'duplicate','Same Stripe event must be idempotent');
  const billed=await db.query(
   "select status from company_program_entitlements where owner_user_id=$1 and product_code='hr'",[billingOwner]);
  assert.equal(billed.rows[0].status,'active');
  const inactiveEvent=['evt_hr_002','sub_hr_001',billingOwner,'hr','price_hr_001','canceled',new Date(Date.now()+1000),null];
  const canceledBilling=await db.query(
   "select public.company_program_apply_stripe_event($1,$2,$3,$4,$5,$6,$7,$8) as result",inactiveEvent);
  assert.equal(canceledBilling.rows[0].result,'applied');
  const canceledEntitlement=await db.query(
   "select status from company_program_entitlements where owner_user_id=$1 and product_code='hr'",[billingOwner]);
  assert.equal(canceledEntitlement.rows[0].status,'cancelled','Cancellation must revoke HR entitlement');
  const staleBilling=await db.query(
   "select public.company_program_apply_stripe_event($1,$2,$3,$4,$5,$6,$7,$8) as result",
   ['evt_hr_003','sub_hr_001',billingOwner,'hr','price_hr_001','active',new Date(Date.now()-5000),new Date(Date.now()+86400000)]);
  assert.equal(staleBilling.rows[0].result,'stale');
  const stillCancelled=await db.query(
   "select status from company_program_entitlements where owner_user_id=$1 and product_code='hr'",[billingOwner]);
  assert.equal(stillCancelled.rows[0].status,'cancelled','Out-of-order Stripe event reactivated cancelled HR');
  const invoiceFn='public.company_program_record_stripe_invoice(text,uuid,text,text,text,bigint,bigint,text,timestamptz)';
  const invoicePerms=await db.query("select has_function_privilege('authenticated',$1,'EXECUTE') as browser,has_function_privilege('service_role',$1,'EXECUTE') as service",[invoiceFn]);
  assert.equal(invoicePerms.rows[0].browser,false,'Customer cannot forge paid invoice');
  assert.equal(invoicePerms.rows[0].service,true,'Provider service must record invoice');
  const invoiceArgs=['in_hr_001',billingOwner,'hr','sub_hr_001','SAR',10000,10000,'paid',new Date()];
  await assert.rejects(()=>as(billingOwner,()=>db.query(
   "select public.company_program_record_stripe_invoice($1,$2,$3,$4,$5,$6,$7,$8,$9)",invoiceArgs)),
   e=>e.code==='42501','Browser must not forge invoice');
  const invoiceWritten=await db.query(
   "select public.company_program_record_stripe_invoice($1,$2,$3,$4,$5,$6,$7,$8,$9) as result",invoiceArgs);
  assert.equal(invoiceWritten.rows[0].result,'recorded');
  const invoiceOwnerView=await as(billingOwner,()=>db.query(
   "select amount_paid_minor,currency,provider_status from company_program_invoices where provider_invoice_id='in_hr_001'"));
  assert.equal(invoiceOwnerView.rows[0].amount_paid_minor,'10000');
  assert.equal(invoiceOwnerView.rows[0].currency,'SAR');
  const outsideInvoice=await as(owner,()=>db.query(
   "select provider_invoice_id from company_program_invoices where provider_invoice_id='in_hr_001'"));
  assert.equal(outsideInvoice.rowCount,0,'Billing invoice leaked to another company');
  await assert.rejects(()=>db.query(
   "select public.company_program_record_stripe_invoice($1,$2,$3,$4,$5,$6,$7,$8,$9)",
   ['in_hr_001',billingOwner,'hr','sub_hr_001','SAR',10000,0,'open',null]),
   e=>e.code==='23514','Paid invoice must never be reverted to unpaid');


  // Reviewed company policy is tenant-scoped, effective-dated and immutable.
  const tiers=JSON.stringify([{through_days:365,wage_days_per_service_day:0.5/365},{through_days:3650,wage_days_per_service_day:1/365}]);
  const policyId=(await as(owner,()=>db.query(
   "insert into hr_saas_rule_sets(workspace_id,jurisdiction,effective_from,effective_to,annual_leave_days,accrual_year_days,service_tiers,created_by) values($1,'SA','2026-01-01','2027-12-31',30,365,$2::jsonb,$3) returning id",
   [wa,tiers,owner]))).rows[0].id;
  const unapprovedView=await as(other,()=>db.query(
   "select id from hr_saas_rule_sets where id=$1",[policyId]));
  assert.equal(unapprovedView.rowCount,0,'Other tenant can read confidential HR policy');
  await as(owner,()=>db.query(
   "update hr_saas_rule_sets set status='approved' where id=$1",[policyId]));
  const companyPolicy=await as(owner,()=>db.query(
   "select approved_by,approved_at,status from hr_saas_rule_sets where id=$1",[policyId]));
  assert.equal(companyPolicy.rows[0].approved_by,owner);
  assert.ok(companyPolicy.rows[0].approved_at);
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_rule_sets set annual_leave_days=31 where id=$1",[policyId])),
   e=>e.code==='23514','Approved company policy must not be silently changed');
  const secondPolicy=(await as(owner,()=>db.query(
   "insert into hr_saas_rule_sets(workspace_id,jurisdiction,effective_from,effective_to,annual_leave_days,accrual_year_days,service_tiers,created_by) values($1,'SA','2027-01-01','2028-01-01',30,365,$2::jsonb,$3) returning id",
   [wa,tiers,owner]))).rows[0].id;
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_rule_sets set status='approved' where id=$1",[secondPolicy])),
   e=>e.code==='23514','Overlapping company policies should not be approved');
  const draftInsertPrivilege=await db.query("select has_table_privilege('authenticated','public.hr_saas_calculation_drafts','INSERT') as browser,has_table_privilege('service_role','public.hr_saas_calculation_drafts','INSERT') as service");
  assert.equal(draftInsertPrivilege.rows[0].browser,false,'Browser can forge calculation results');
  assert.equal(draftInsertPrivilege.rows[0].service,true,'Server cannot persist reviewed draft');
  // Privileged server fixture writes; the authenticated browser grant is deliberately absent.
  const drafted=(await db.query(
   "insert into hr_saas_calculation_drafts(workspace_id,employee_id,policy_id,kind,jurisdiction,inputs,result,created_by) values($1,$2,$3,'leave_accrual','SA',$4::jsonb,$5::jsonb,$6) returning id",
   [wa,employee,policyId,JSON.stringify({as_of:'2026-11-17',eligible_days:365}),JSON.stringify({accrued_days:30,status:'draft_review_required'}),owner])).rows[0].id;
  const draftVisible=await as(owner,()=>db.query(
   "select status from hr_saas_calculation_drafts where id=$1",[drafted]));
  assert.equal(draftVisible.rows[0].status,'draft');
  const draftHidden=await as(other,()=>db.query(
   "select id from hr_saas_calculation_drafts where id=$1",[drafted]));
  assert.equal(draftHidden.rowCount,0,'Other company can view draft HR calculations');
  // Unified company identity is additive and does not rewrite existing HR IDs.
  const sharedMigration=fs.readFileSync(path.resolve(__dirname,
   '../../supabase/migrations/20261118010000_hr_link_existing_company_workspaces.sql'),'utf8');
  await db.query(sharedMigration);
  const companyA=(await as(owner,()=>db.query(
   "insert into crm_app_workspaces(owner_user_id,name) values($1,'Shared Company A') returning id",[owner]))).rows[0].id;
  const companyB=(await as(other,()=>db.query(
   "insert into crm_app_workspaces(owner_user_id,name) values($1,'Shared Company B') returning id",[other]))).rows[0].id;
  const linked=(await as(owner,()=>db.query(
   "insert into hr_saas_workspaces(owner_user_id,name,crm_workspace_id) values($1,'Shared Company A',$2) returning id,crm_workspace_id",
   [owner,companyA]))).rows[0];
  assert.equal(linked.crm_workspace_id,companyA,'HR identity must follow existing company workspace');
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_workspaces(owner_user_id,name,crm_workspace_id) values($1,'Cross-tenant',$2)",[owner,companyB])),
   e=>e.code==='23503'||e.code==='42501','Cannot link HR to a different company owner');
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_workspaces(owner_user_id,name,crm_workspace_id) values($1,'Duplicate',$2)",[owner,companyA])),
   e=>e.code==='23505','One company workspace must not create two HR tenants');
  await assert.rejects(()=>as(owner,()=>db.query(
   "insert into hr_saas_workspaces(owner_user_id,name) values($1,'Unlinked HR space')",[owner])),
   e=>e.code==='42501','New HR spaces must be linked to a shared company workspace');
  await assert.rejects(()=>as(owner,()=>db.query(
   "update hr_saas_workspaces set crm_workspace_id=$1 where id=$2",[companyA,wa])),
   e=>e.code==='23514','Existing HR tenant must not be silently rebound');
  const originalLegacy=await db.query("select id,crm_workspace_id from hr_saas_workspaces where id=$1",[wa]);
  assert.equal(originalLegacy.rows[0].id,wa);
  assert.equal(originalLegacy.rows[0].crm_workspace_id,null,'Legacy HR workspace preserved without unsafe auto-mapping');
  const crossTenant=await as(other,()=>db.query(
   "select id from hr_saas_workspaces where id=$1",[linked.id]));
  assert.equal(crossTenant.rowCount,0,'Shared company HR still requires tenant isolation');
  // Confirm source rows were preserved, merely inaccessible under an expired entitlement.
  const original=await db.query('select id from hr_saas_records where id=$1',[rec]);
  assert.equal(original.rowCount,1,'Subscription cancellation must never delete HR history');
  console.log('HR SAAS POSTGRES ACCEPTANCE: PASS — true SQL, licenses, RLS, attendance, leave approvals, payroll approval, employee contracts, entitlements, leave balances, member roles, self-service, tenant FK, audit, revocation');
 }finally{await db.end();}
}
main().catch(e=>{console.error('HR SAAS POSTGRES ACCEPTANCE: FAIL',e.message,'SQLSTATE='+String(e.code||'unknown'));process.exitCode=1;});
