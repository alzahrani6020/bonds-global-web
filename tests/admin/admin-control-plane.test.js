const fs=require('fs');const path=require('path');const ROOT=path.join(__dirname,'../..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
describe('Admin control plane completion',()=>{
 test('schema covers session revocation access policies and workflow schedule state',()=>{
  const sql=read('supabase/migrations/20261013010000_admin_control_plane.sql');
  for(const n of ['admin_revoked_sessions','admin_access_policies','admin_workflow_schedule_state'])expect(sql).toContain('public.'+n);
  expect(sql).toContain("('security.sessions.manage'");
  expect(sql).toContain("('security.policies.manage'");
 });
 test('admin verification enforces revocation and access policies',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('async function enforceAdminAccessPolicies');
  expect(api).toContain("throw forbidden('Admin session revoked')");
  expect(api).toContain("throw forbidden('Access denied by country policy')");
  expect(api).toContain("throw forbidden('IP not allowed by admin policy')");
  expect(api).toContain("throw forbidden('Untrusted admin device')");
  expect(api).toContain('await enforceAdminAccessPolicies(req, sb, user, token');
 });
 test('scheduled workflows are fail-closed behind CRON_SECRET and perform operational SLA sweeps',()=>{
  const api=read('api/admin.js');
  expect(api).toContain("if(!configured) return res.status(503).json({error:'CRON_SECRET not configured'");
  expect(api).toContain("if(req.headers.authorization!=='Bearer '+configured)");
  expect(api).toContain('async function runScheduledWorkflows');
  expect(api).toContain('async function runOperationalSweeps');
  expect(api).toContain('support_sla_breached');
  expect(api).toContain('funding_sla_breached');
 });
 test('control center unifies tasks approvals SLA security sessions and drift',()=>{
  const api=read('api/admin.js'),page=read('admin/control-center.html'),dash=read('admin/dashboard.html');
  expect(api).toContain('async function getControlCenterOverview');
  expect(api).toContain('async function getSecuritySessionsOverview');
  expect(api).toContain('async function getConfigDrift');
  expect(page).toContain('Admin Control Center');
  expect(page).toContain('Configuration Drift');
  expect(page).toContain('Security Controls');
  expect(page).toContain('BondsAdminCommon.escapeHtml');
  expect(dash).toContain('/admin/control-center.html?embed=1');
 });
 test('finance collections contracts and CRM renewals have operational create paths',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('async function createFinanceCollection');
  expect(api).toContain('async function createFinanceContract');
  expect(api).toContain('async function createCrmRenewal');
  expect(api).toContain("requireAdminPermission(req,sb,'billing.reconcile')");
  expect(api).toContain("requireAdminPermission(req,sb,'crm.write')");
 });
});