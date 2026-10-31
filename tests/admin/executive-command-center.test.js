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

  test('GA4 stays optional and fail-honest while first-party traffic remains primary', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain('GA4: NOT_CONFIGURED');
    expect(page).toContain("fp?.traffic?.visitorsToday==null?'UNKNOWN'");
    expect(page).toContain("fp?.traffic?.onlineNow==null?'UNKNOWN'");
    expect(page).toContain("api('first-party-analytics')");
    expect(page).toContain("api('ga4-analytics')");
    expect(page).not.toMatch(/PRIVATE_KEY|CLIENT_SECRET|GOOGLE_APPLICATION_CREDENTIALS|service_account/i);
  });

  test('GA4 Data API client is server-side, read-only and fail-honest', () => {
    const client = read('lib/analytics/ga4-data-api.js');
    const api = read('api/admin.js');
    expect(client).toContain('analytics.readonly');
    expect(client).toContain('GA4_PROPERTY_ID');
    expect(client).toContain('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    expect(client).toContain('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    expect(client).toContain("status: 'not_configured'");
    expect(client).toContain('runRealtimeReport');
    expect(client).toContain('sessionDefaultChannelGroup');
    expect(client).toContain('pagePath');
    expect(api).toContain("action === 'ga4-analytics'");
    expect(api).toContain("requireAdminPermission(req, sb, 'analytics.executive')");
  });

  test('command center renders source health and computes business health only from approved targets', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain('Business Health Score');
    expect(page).toContain('renderGovernance(gov||{})');
    expect(page).toContain("health.score==null?'UNKNOWN':num(health.score)");
    expect(page).toContain('لا توجد أهداف قابلة للقياس للفترة الحالية');
    expect(page).toContain('renderSources(data,ga)');
    expect(page).toContain('UNKNOWN/PARTIAL/ACTIVE');
  });

  test('command center exposes governed KPI targets and alert rules through admin-only actions', () => {
    const page = read('admin/executive-command-center.html');
    const api = read('api/admin.js');
    expect(page).toContain("api('command-center-governance')");
    expect(page).toContain("apiPost('command-center-target-save'");
    expect(page).toContain("apiPost('command-center-alert-save'");
    expect(api).toContain("action === 'command-center-governance'");
    expect(api).toContain("analytics.command_center.read");
    expect(api).toContain("analytics.command_center.manage");
  });

  test('wave 2 exposes decision loop, funding intelligence and saved view/watchlist operations', () => {
    const page = read('admin/executive-command-center.html');
    const api = read('api/admin.js');
    expect(page).toContain('القرارات → النتائج');
    expect(page).toContain('Funding Intelligence وRevenue Attribution');
    expect(page).toContain('Saved Views وWatchlists');
    expect(page).toContain("api('command-center-operations-overview')");
    expect(page).toContain("apiPost('command-center-decision-create'");
    expect(page).toContain("apiPost('command-center-action-create'");
    expect(page).toContain("apiPost('command-center-view-save'");
    expect(page).toContain("apiPost('command-center-watchlist-save'");
    expect(page).toContain("['Decision-to-Outcome Loop','ACTIVE'");
    expect(page).toContain("['Funding Intelligence','ACTIVE'");
    expect(page).toContain("['Saved Views / Watchlists','ACTIVE'");
    expect(page).toContain("['Revenue Attribution','PARTIAL'");
    expect(api).toContain("action === 'command-center-operations-overview'");
    expect(api).toContain("action === 'command-center-decision-measure'");
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
