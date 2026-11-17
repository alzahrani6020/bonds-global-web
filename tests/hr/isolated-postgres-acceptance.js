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
  // Confirm source rows were preserved, merely inaccessible under an expired entitlement.
  const original=await db.query('select id from hr_saas_records where id=$1',[rec]);
  assert.equal(original.rowCount,1,'Subscription cancellation must never delete HR history');
  console.log('HR SAAS POSTGRES ACCEPTANCE: PASS — true SQL, licenses, RLS, attendance, leave approvals, tenant FK, audit, revocation');
 }finally{await db.end();}
}
main().catch(e=>{console.error('HR SAAS POSTGRES ACCEPTANCE: FAIL',e.message,'SQLSTATE='+String(e.code||'unknown'));process.exitCode=1;});
