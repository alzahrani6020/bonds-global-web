const fs=require('fs');const path=require('path');const ROOT=path.join(__dirname,'../..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
describe('Platform observability and recovery',()=>{
 test('schema covers errors metrics jobs incidents recovery config integrations and releases',()=>{
  const sql=read('supabase/migrations/20261012234500_admin_platform_observability.sql');
  for(const n of ['admin_error_events','admin_request_metrics','admin_job_runs','admin_incidents','admin_runbooks','admin_postmortems','admin_backup_checks','admin_recovery_drills','admin_config_snapshots','admin_migration_status','admin_integration_health','admin_webhook_deliveries','admin_api_key_metadata','admin_release_history']) expect(sql).toContain('public.'+n);
 });
 test('admin API assigns a correlation ID and returns it on errors',()=>{
  const api=read('api/admin.js');
  expect(api).toContain("req.adminRequestId = req.headers['x-request-id'] || generateRequestId()");
  expect(api).toContain("res.setHeader('X-Request-ID', req.adminRequestId)");
  expect(api).toContain("json({ error: err.message, requestId: req.adminRequestId })");
  expect(api).toContain('async function recordErrorEvent');
  expect(api).toContain('async function recordRequestMetric');
 });
 test('platform overview exposes deploy SHA and secret presence without secret values',()=>{
  const api=read('api/admin.js');
  expect(api).toContain('process.env.VERCEL_GIT_COMMIT_SHA');
  expect(api).toContain('configuration:{presence:configPresence}');
  expect(api).toContain('SUPABASE_SERVICE_ROLE_KEY:!!process.env.SUPABASE_SERVICE_ROLE_KEY');
  expect(api).not.toContain('SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY');
 });
 test('platform workspace exposes errors slow routes incidents recovery and config',()=>{
  const page=read('admin/platform-operations.html'),dash=read('admin/dashboard.html');
  expect(page).toContain('Error Inbox');expect(page).toContain('Slow Endpoints');expect(page).toContain('Backup & Recovery');expect(page).toContain('Configuration & Integrations');
  expect(page).toContain('BondsAdminCommon.escapeHtml');expect(dash).toContain('/admin/platform-operations.html?embed=1');
 });
});