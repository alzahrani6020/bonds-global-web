const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('Executive Command Center', () => {
  test('dashboard exposes the command center through the unified admin shell', () => {
    const dash = read('admin/dashboard.html');
    expect(dash).toContain('/admin/executive-command-center.html?embed=1');
    expect(dash).toContain('مركز القيادة التنفيذي');
  });

  test('command center uses unified admin auth and existing RBAC-protected analytics API', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain('/bonds-auth-2026.js?v=3.1.3');
    expect(page).toContain('BondsAuth.initAdminGuard()');
    expect(page).toContain("api('executive-analytics-v2')");
    expect(page).toContain('BondsAuth.authenticatedFetch');
  });

  test('GA4 is fail-honest until server-side Data API credentials are configured', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain('GA4: NOT_CONFIGURED');
    expect(page).toContain("kpi('زوار اليوم','UNKNOWN'");
    expect(page).toContain("kpi('المتواجدون الآن','UNKNOWN'");
    expect(page).not.toMatch(/PRIVATE_KEY|CLIENT_SECRET|GOOGLE_APPLICATION_CREDENTIALS|service_account/i);
  });

  test('command center renders source health and avoids fabricated business health score', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain('Business Health Score');
    expect(page).toContain("$('healthScore').textContent='UNKNOWN'");
    expect(page).toContain('renderSources(data)');
    expect(page).toContain('UNKNOWN/PARTIAL/ACTIVE');
  });

  test('governance schema covers sources metrics targets alerts decisions actions scenarios and views', () => {
    const sql = read('supabase/migrations/20261031010000_executive_command_center.sql');
    [
      'analytics_data_sources',
      'analytics_metric_definitions',
      'analytics_targets',
      'analytics_alert_rules',
      'analytics_decisions',
      'analytics_actions',
      'analytics_scenarios',
      'analytics_saved_views',
      'analytics_watchlists'
    ].forEach(name => expect(sql).toContain('public.' + name));
    expect(sql).toContain("'analytics.command_center.read'");
    expect(sql).toContain("'analytics.command_center.manage'");
  });

  test('new governance tables are fail-closed for browser roles', () => {
    const sql = read('supabase/migrations/20261031010000_executive_command_center.sql');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON public.analytics_data_sources');
    expect(sql).toContain('FROM anon, authenticated');
    expect(sql).not.toContain('CREATE POLICY');
  });

  test('new source registry does not claim runtime health before verification', () => {
    const sql = read('supabase/migrations/20261031010000_executive_command_center.sql');
    const seeded = sql.slice(sql.indexOf("INSERT INTO public.analytics_data_sources"), sql.indexOf("INSERT INTO public.analytics_metric_definitions"));
    expect(seeded).not.toContain("'healthy'");
    expect(seeded).toContain("'not_configured'");
  });
});
