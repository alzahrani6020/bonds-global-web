const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('admin operating platform phase 5', () => {
  test('foundation migrations cover requested operating domains', () => {
    const customers = read('supabase/migrations/20261012180000_admin_customers_crm_support_finance.sql');
    const governance = read('supabase/migrations/20261012181000_admin_governance_security_workflow.sql');
    const observability = read('supabase/migrations/20261012182000_admin_observability_recovery_config.sql');
    const dataAi = read('supabase/migrations/20261012183000_admin_ai_data_documents.sql');

    [
      'public.organizations',
      'public.crm_opportunities',
      'public.support_tickets',
      'public.finance_refunds',
      'public.finance_reconciliation_items',
      'public.customer_contracts'
    ].forEach(name => expect(customers).toContain(name));

    [
      'public.admin_permissions',
      'public.admin_approval_requests',
      'public.security_events',
      'public.feature_flags',
      'public.entitlements',
      'public.workflow_rules',
      'public.admin_tasks',
      'public.operational_alerts'
    ].forEach(name => expect(governance).toContain(name));

    [
      'public.admin_request_traces',
      'public.admin_error_events',
      'public.admin_job_runs',
      'public.incidents',
      'public.runbooks',
      'public.backup_verifications',
      'public.recovery_drills',
      'public.integration_health',
      'public.webhook_events',
      'public.configuration_snapshots'
    ].forEach(name => expect(observability).toContain(name));

    [
      'public.executive_metric_snapshots',
      'public.ai_usage_events',
      'public.ai_prompt_versions',
      'public.data_governance_requests',
      'public.data_lineage_entries',
      'public.admin_export_jobs',
      'public.document_records',
      'public.document_versions'
    ].forEach(name => expect(dataAi).toContain(name));
  });

  test('new platform tables are read-only to browser roles and writable by service role', () => {
    const files = [
      'supabase/migrations/20261012180000_admin_customers_crm_support_finance.sql',
      'supabase/migrations/20261012181000_admin_governance_security_workflow.sql',
      'supabase/migrations/20261012182000_admin_observability_recovery_config.sql',
      'supabase/migrations/20261012183000_admin_ai_data_documents.sql'
    ].map(read).join('\n');

    expect(files).toContain('ENABLE ROW LEVEL SECURITY');
    expect(files).toContain('FORCE ROW LEVEL SECURITY');
    expect(files).toContain('REVOKE ALL ON TABLE');
    expect(files).toContain('FROM authenticated');
    expect(files).toContain('TO service_role');
    expect(files).not.toContain('GRANT INSERT, UPDATE, DELETE ON TABLE public.');
  });

  test('API exposes user 360, permission simulator, summary and allowlisted platform modules', () => {
    const api = read('api/admin.js');

    expect(api).toContain('const PLATFORM_MODULES = Object.freeze');
    expect(api).toContain("if (action === 'user-360')");
    expect(api).toContain("if (action === 'permission-simulator')");
    expect(api).toContain("if (action === 'platform-summary')");
    expect(api).toContain("if (action === 'platform-module')");
    expect(api).toContain('async function getEffectivePermissions');
    expect(api).toContain('async function requirePlatformPermission');
    expect(api).toContain('sanitizePlatformRecord');
    expect(api).not.toContain("if (operation === 'delete')");
  });

  test('user 360 aggregates existing and new customer context without failing the whole response', () => {
    const api = read('api/admin.js');

    expect(api).toContain("section('profile'");
    expect(api).toContain("section('subscriptions'");
    expect(api).toContain("section('presence'");
    expect(api).toContain("section('fundingCases'");
    expect(api).toContain("section('tickets'");
    expect(api).toContain("section('opportunities'");
    expect(api).toContain("section('contracts'");
    expect(api).toContain("section('documents'");
    expect(api).toContain("section('audit'");
    expect(api).toContain('healthScore');
    expect(api).toContain('errors');
  });

  test('authenticated fetch retries transient failures only for idempotent requests', () => {
    const auth = read('bonds-auth-2026.js');

    expect(auth).toContain("const requestMethod = String(options.method || 'GET').toUpperCase()");
    expect(auth).toContain("requestMethod === 'GET' || requestMethod === 'HEAD'");
    expect(auth).toContain('if (canRetryTransient && response.status >= 500)');
    expect(auth).toContain("retried: true");
    expect(auth).toContain("serverError: true, requestId, retried: canRetryTransient");
  });

  test('workflow mutations are POST-only and platform updates do not assume updated_at', () => {
    const api = read('api/admin.js');
    const getStart = api.indexOf("if (req.method === 'GET')");
    const postStart = api.indexOf("if (req.method === 'POST')");
    const getBlock = api.slice(getStart, postStart);
    const postBlock = api.slice(postStart);

    expect(getBlock).not.toContain("action === 'run-workflow'");
    expect(getBlock).not.toContain("action === 'run-operational-sweep'");
    expect(postBlock).toContain("action === 'run-workflow'");
    expect(postBlock).toContain("action === 'run-operational-sweep'");
    expect(api).not.toContain("record.updated_at = new Date().toISOString()");
    expect(api).toContain('else if (config.key)');
  });

  test('settings reads require strict admin authorization', () => {
    const api = read('api/admin.js');
    const start = api.indexOf("if (action === 'settings')");
    const block = api.slice(start, start + 350);
    expect(block).toContain('verifyAdminStrict(req, sb)');
  });

  test('session revocation and access policies are enforced by admin verification', () => {
    const api = read('api/admin.js');
    expect(api).toContain('async function assertAdminSessionActive');
    expect(api).toContain('async function assertAdminAccessPolicy');
    expect(api).toContain('Admin session revoked');
    expect(api).toContain('require_trusted_device');
    expect(api).toContain('await assertAdminAccessPolicy');
  });

  test('field-level permission rules can mask sensitive user fields', () => {
    const api = read('api/admin.js');
    const governance = read('supabase/migrations/20261012181000_admin_governance_security_workflow.sql');
    expect(governance).toContain('public.admin_field_permissions');
    expect(governance).toContain("'users.sensitive'");
    expect(api).toContain('async function applyFieldPermissions');
    expect(api).toContain("mask_strategy");
    expect(api).toContain("includeSensitive: perms.includes('users.sensitive')");
  });

  test('trusted-device policy has a browser device identifier and allowed headers', () => {
    const auth = read('bonds-auth-2026.js');
    const vercel = read('vercel.json');

    expect(auth).toContain("function getAdminDeviceFingerprint()");
    expect(auth).toContain("'bonds_admin_device_id'");
    expect(auth).toContain("authHeaders['X-Device-Fingerprint']");
    expect(vercel).toContain('X-Request-ID');
    expect(vercel).toContain('X-Device-Fingerprint');
  });

  test('executive analytics expose revenue retention funnel and pipeline metrics', () => {
    const api = read('api/admin.js');
    const platform = read('admin/platform-center.html');
    expect(api).toContain('async function getExecutiveAnalytics');
    expect(api).toContain("action === 'executive-analytics'");
    expect(api).toContain('churnRate');
    expect(api).toContain('retentionRate');
    expect(api).toContain('weightedPipelineValue');
    expect(api).toContain('cohorts');
    expect(platform).toContain("action=executive-analytics");
    expect(platform).toContain('MRR');
    expect(platform).toContain('Weighted pipeline');
  });

  test('platform readiness reports migration state instead of assuming schema exists', () => {
    const api = read('api/admin.js');
    const platform = read('admin/platform-center.html');
    expect(api).toContain('async function getPlatformReadiness');
    expect(api).toContain("status: ready === tables.length ? 'ready' : ready === 0 ? 'missing' : 'partial'");
    expect(platform).toContain("action=platform-readiness");
  });

  test('production release workflow verifies exact SHA and database health', () => {
    const workflow = read('.github/workflows/deploy-vercel.yml');
    const health = read('api/health.js');
    expect(workflow).toContain('Verify production health and exact SHA');
    expect(workflow).toContain('$DEPLOYMENT_URL/api/health');
    expect(workflow).toContain("h.checks?.supabase !== 'ok'");
    expect(workflow).toContain('h.version !== expected');
    expect(health).toContain("status: healthy ? 'ok' : 'degraded'");
  });

  test('AI operations record provider model token and latency telemetry', () => {
    const feasibility = read('api/analyze-feasibility.js');
    const research = read('api/research.js');
    expect(feasibility).toContain('usageMetadata');
    expect(feasibility).toContain("'feasibility_analysis'");
    expect(feasibility).toContain('ai_usage_events');
    expect(research).toContain('usageMetadata');
    expect(research).toContain("'market_research'");
    expect(research).toContain('ai_usage_events');
  });

  test('dashboard and users UI expose the operating platform and user 360', () => {
    const dashboard = read('admin/dashboard.html');
    const users = read('admin/users.html');
    const platform = read('admin/platform-center.html');
    const user360 = read('admin/user-360.html');

    expect(dashboard).toContain('/admin/platform-center.html?embed=1');
    expect(users).toContain('/admin/user-360.html?embed=1&id=');
    expect(platform).toContain('Executive / Customers / Operations / Finance / Security / Product / Platform / Governance');
    expect(platform).toContain("action=platform-module");
    expect(user360).toContain("action=user-360");
  });
});
