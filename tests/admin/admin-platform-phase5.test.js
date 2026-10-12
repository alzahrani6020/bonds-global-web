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
