/** @jest-environment node */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.resolve(__dirname,'../../',file),'utf8');
const js=read('my-bonds/crm/company-hr.js');
const sql=read('supabase/migrations/20261121190000_hr_org_attendance_leave_workflows.sql');
describe('HR organization and attendance controls',()=>{
 test('both locales expose organization, jobs and attendance corrections',()=>{
  const ar=read('my-bonds/crm/index.html'),en=read('en/my-bonds/crm/index.html');
  for(const html of [ar,en]){
   expect(html).toContain('data-hr-category="departments"');
   expect(html).toContain('data-hr-category="positions"');
   expect(html).toContain('data-hr-category="attendance"');
   expect(html).toContain('data-hr-category="attendance_corrections"');
   expect(html).toContain('company-hr.js?v=16');
  }
 });
 test('organization has dedicated tables with composite tenant relations',()=>{
  for(const name of ['hr_saas_departments','hr_saas_positions'])
   expect(sql).toContain('create table public.'+name);
  expect(sql).toContain('foreign key(workspace_id,department_id)');
  expect(sql).toContain('foreign key(workspace_id,position_id)');
  expect(sql).toContain('department_hierarchy_guard');
  expect(sql).toContain('Department hierarchy cycle');
  expect(sql).toContain("r.category='departments'");
  expect(sql).toContain("'L-'||replace(r.id::text,'-','')");
  expect(js).toContain("isEmployees?row.department:'—'");
  expect(js).toContain("isEmployees?row.job_title:'—'");
  expect(sql).toContain('alter table public.hr_saas_departments enable row level security');
  expect(sql).toContain('alter table public.hr_saas_positions enable row level security');
  expect(js).toContain("category==='departments'?'hr_saas_departments'");
  expect(js).toContain("category==='positions'?'hr_saas_positions'");
  expect(js).toContain("type==='department'||type==='position'");
 });
 test('attendance and leave decisions are guarded by PostgreSQL rather than UI alone',()=>{
  expect(sql).toContain('hr_saas_attendance_review_guard before insert or update');
  expect(sql).toContain('Approved attendance is immutable');
  expect(sql).toContain('hr_saas_leave_decision_guard before insert or update');
  expect(sql).toContain('Final leave decision is immutable');
  expect(js).toContain("row.review_status==='submitted'?");
  expect(js).toContain("category==='attendance_corrections'&&row.status==='pending'");
  expect(js).toContain("tableCategory==='attendance'?'review_status':'status'");
 });
 test('correction records are tenant scoped, immutable on approval, and preserve source attendance',()=>{
  expect(sql).toContain('create table public.hr_saas_attendance_corrections');
  expect(sql).toContain('alter table public.hr_saas_attendance_corrections enable row level security');
  expect(sql).toContain('Final attendance correction is immutable');
  expect(sql).toContain('create view public.hr_saas_attendance_effective with (security_invoker=true)');
  expect(sql).toContain("where c.workspace_id=a.workspace_id and c.attendance_id=a.id and c.status='approved'");
  expect(js).toContain("requestedCategory==='attendance'?'hr_saas_attendance_effective':table()");
 });
 test('no unreviewed production writes or changes to legacy CRM were introduced',()=>{
  expect(sql).not.toMatch(/\bdrop\s+table\b|\btruncate\s+table\b/i);
  expect(js).not.toContain("db.from('crm_app_contacts')");
  expect(js).not.toMatch(/\.from\('company_program_entitlements'\)\.insert/);
 });
});
