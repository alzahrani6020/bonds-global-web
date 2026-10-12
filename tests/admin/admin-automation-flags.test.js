const fs=require('fs');const path=require('path');const ROOT=path.join(__dirname,'../..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
describe('Admin automation flags and operations',()=>{
 test('schema contains flags entitlements workflows tasks and alerts',()=>{
  const sql=read('supabase/migrations/20261012233000_admin_flags_entitlements_workflows.sql');
  for(const name of ['admin_feature_flags','admin_feature_flag_rules','admin_entitlements','admin_plan_entitlements','admin_entitlement_overrides','admin_workflows','admin_workflow_runs','admin_tasks','admin_alerts']) expect(sql).toContain('public.'+name);
  expect(sql).toContain("('product.flags'");
  expect(sql).toContain("('workflow.manage'");
 });
 test('feature flags support rollback and expiry',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('async function upsertFeatureFlag');
  expect(api).toContain('previous_state');
  expect(api).toContain('async function rollbackFeatureFlag');
  expect(api).toContain('expires_at');
  expect(api).toContain("requireAdminPermission(req, sb, 'product.flags')");
  expect(api).toContain('async function upsertFeatureFlagRule');
  expect(api).toContain('FEATURE_FLAG_KEY_RE');
  expect(api).toContain("['user','tier','organization','country','percentage'].includes(targetType)");
 });
 test('entitlements workflows and operations queues use granular permissions',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('async function createEntitlementOverride');
  expect(api).toContain('async function upsertWorkflow');
  expect(api).toContain('async function createAdminTask');
  expect(api).toContain('async function updateAdminQueueItem');
  expect(api).toContain('async function upsertPlanEntitlement');
  expect(api).toContain('async function queueWorkflowRun');
  expect(api).toContain('AUTOMATION_UUID_RE');
  expect(api).toContain('invalid task priority');
  expect(api).toContain('invalid alert status');
  expect(api).toContain("requireAdminPermission(req, sb, 'entitlements.manage')");
  expect(api).toContain("requireAdminPermission(req, sb, 'workflow.manage')");
  expect(api).toContain("requireAdminPermission(req, sb, 'operations.manage')");
 });
 test('admin automation workspace is navigable and escaped',()=>{
  const page=read('admin/automation.html');const dashboard=read('admin/dashboard.html');
  expect(page).toContain('Product & Automation Control');
  expect(page).toContain('Feature Flags');
  expect(page).toContain('Tasks Queue');
  expect(page).toContain('Alerts Inbox');
  expect(page).toContain('BondsAdminCommon.escapeHtml');
  expect(page).toContain('Flag Targeting Rule');
  expect(page).toContain('Plan Entitlement');
  expect(page).toContain('workflow-run-queue');
  expect(page).toContain('.muted{color:#475569}');
  expect(page).toContain('aria-label="حالة Feature Flag"');
  expect(dashboard).toContain('/admin/automation.html?embed=1');
 });
});