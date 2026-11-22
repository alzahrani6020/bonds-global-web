/** @jest-environment node */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const controller=fs.readFileSync(path.join(root,'my-bonds/crm/company-hr.js'),'utf8');
const migration=name=>fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8');
describe('HR approval workflow exposure and DB constraints',()=>{
 test('contracts expose only allowed transitions and require confirmation to terminate',()=>{
  expect(controller).toContain("row.status==='draft'?[['active'");
  expect(controller).toContain("row.status==='active'?[['terminated'");
  expect(controller).toContain("window.confirm(t('تأكيد إنهاء عقد العمل؟'");
  const sql=migration('20261117080000_hr_saas_employment_contracts.sql');
  expect(sql).toContain("if old.status='draft' and new.status not in ('draft','active','cancelled')");
  expect(sql).toContain('Overlapping active contracts');
 });
 test('leave decision requires pending and is persisted with decision timestamp',()=>{
  expect(controller).toContain("category==='leaves'&&row.status==='pending'");
  expect(controller).toContain("changes.decided_at=['approved','rejected'].includes(target)");
  expect(controller).toContain("if(!editing&&row.status!=='pending')");
  const sql=migration('20261117060000_hr_saas_attendance_leaves.sql');
  expect(sql).toContain('Overlapping approved leave');
 });
 test('payroll uses explicit draft -> reviewed -> approved guarded in PostgreSQL',()=>{
  expect(controller).toContain("row.status==='draft'?[['reviewed'");
  expect(controller).toContain("row.status==='reviewed'?[['approved'");
  expect(controller).toContain("window.confirm(t('تأكيد اعتماد مسير الرواتب؟");
  const sql=migration('20261117070000_hr_saas_payroll_review.sql');
  expect(sql).toContain('Payroll must be reviewed before approval');
  expect(sql).toContain('Approved payroll cannot be amended');
  expect(sql).toContain('Payroll period is not editable');
 });
 test('claims submit before decision and cannot overwrite decided claims',()=>{
  expect(controller).toContain("row.status==='draft'?[['submitted'");
  expect(controller).toContain("row.status==='submitted'?[['approved'");
  const sql=migration('20261117090000_hr_saas_entitlements.sql');
  expect(sql).toContain('Claim must be submitted before decision');
  expect(sql).toContain('Decided claim cannot be rewritten');
 });
 test('all decisions are workspace-scoped, optimistic and require confirmed readback',()=>{
  expect(controller).toContain("workflowActions(item).some(([next])=>next===target)");
  expect(controller).toContain(".eq('workspace_id',workspace.id).eq('id',item.id)");
  expect(controller).toContain("tableCategory==='attendance'?'review_status':'status'");
  expect(controller).toContain("tableCategory==='attendance'?item.review_status:item.status");
  expect(controller).toContain("tableCategory==='attendance'?'id,review_status':'id,status'");
  expect(controller).toContain("if(!result?.id||(tableCategory==='attendance'?result.review_status:result.status)!==target)");
  expect(controller).not.toMatch(/service_role|\.from\('hr_saas_payroll_lines'\)\.delete\(/);
 });
});
