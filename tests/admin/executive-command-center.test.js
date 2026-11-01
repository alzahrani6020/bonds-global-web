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
  test('commercial scoring capabilities are active with fail-honest semantics', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain("['Lead Scoring','ACTIVE'");
    expect(page).toContain("['Opportunity Scoring','ACTIVE'");
    expect(page).toContain('ليس احتمال تحويل');
    expect(page).toContain('ليس forecast');
  });

  test('service profitability is partial and fail-honest until allocated service cost is complete', () => {
    const page = read('admin/executive-command-center.html');
    const ops = read('lib/analytics/command-center-operations.js');
    const engine = read('lib/analytics/service-profitability.js');

    expect(page).toContain('Service Profitability');
    expect(page).toContain("['Service Profitability','PARTIAL'");
    expect(page).toContain('UNKNOWN — لا توجد أحداث مالية posted مرتبطة بخدمة حتى الآن');
    expect(ops).toContain("sb.from('financial_events')");
    expect(ops).toContain('buildServiceProfitability');
    expect(engine).toContain("status:'partial'");
    expect(engine).toContain("semantics:'observed_direct_margin_not_full_operating_profit'");
  });

  test('client lifetime value is partial and fail-honest until governed evidence exists', () => {
    const page = read('admin/executive-command-center.html');
    const ops = read('lib/analytics/command-center-operations.js');
    const adapter = read('lib/analytics/client-lifetime-value.js');
    const engine = read('lib/finance/engines/unit-economics-engine.js');

    expect(page).toContain('Client Lifetime Value');
    expect(page).toContain("['Client Lifetime Value','PARTIAL'");
    expect(page).toContain("clv.ltv==null?'UNKNOWN'");
    expect(page).toContain('UNKNOWN — الأدلة الناقصة');
    expect(ops).toContain("sb.from('advisory_clients')");
    expect(ops).toContain("sb.from('crm_customer_success')");
    expect(ops).toContain('buildClientLifetimeValue');
    expect(adapter).toContain("semantics: 'governed_ltv_not_crm_pipeline_value'");
    expect(adapter).toContain("engine: 'unit_economics'");
    expect(engine).toContain("analysis_scope");
  });
  test('CAC and ROAS are partial and fail-honest until governed acquisition evidence exists', () => {
    const page = read('admin/executive-command-center.html');
    const ops = read('lib/analytics/command-center-operations.js');
    const adapter = read('lib/analytics/cac-roas.js');
    const engine = read('lib/finance/engines/unit-economics-engine.js');

    expect(page).toContain('CAC / ROAS');
    expect(page).toContain("['CAC / ROAS','PARTIAL'");
    expect(page).toContain("cr.cac==null?'UNKNOWN'");
    expect(page).toContain("cr.roas==null?'UNKNOWN'");
    expect(page).toContain('UNKNOWN — الأدلة الناقصة');
    expect(ops).toContain('buildCacRoas');
    expect(ops).toContain("cacRoas:'partial'");
    expect(adapter).toContain("semantics: 'governed_spend_and_attributed_revenue_not_pipeline_value'");
    expect(adapter).toContain("engine: 'unit_economics'");
    expect(adapter).toContain('period_basis');
    expect(adapter).toContain('currency');
    expect(engine).toContain("analysisScope === 'acquisition'");
    expect(page).not.toContain("clv.ltv==null?'UNKNOWN':sar(clv.ltv)");
  });

  test('scenario simulator is active, governed and fail-closed', () => {
    const page = read('admin/executive-command-center.html');
    const api = read('api/admin.js');
    const ops = read('lib/analytics/command-center-operations.js');
    const adapter = read('lib/analytics/scenario-simulator.js');
    const engine = read('lib/finance/engines/scenario-engine.js');

    expect(page).toContain("['Scenario Simulator','ACTIVE'");
    expect(page).toContain('scenarioForm');
    expect(page).toContain("apiPost('command-center-scenario-create'");
    expect(page).toContain("apiPost('command-center-scenario-delete'");
    expect(page).toContain('scenarioRows');
    expect(api).toContain("action === 'command-center-scenario-create'");
    expect(api).toContain("action === 'command-center-scenario-delete'");
    expect(api).toContain("analytics.command_center.manage");
    expect(ops).toContain("sb.from('analytics_scenarios')");
    expect(ops).toContain('validateAndRunScenario');
    expect(ops).toContain("scenarioSimulator:'active'");
    expect(adapter).toContain("runFinancialEngine('scenario_forecast'");
    expect(adapter).toContain("source: 'manual_explicit'");
    expect(adapter).toContain('scenario engine requires');
    expect(engine).toContain('SimulationEngine');
  });

  test('board pack generator is active, governed and printable without inventing data', () => {
    const page = read('admin/executive-command-center.html');
    const api = read('api/admin.js');
    const adapter = read('lib/analytics/board-pack.js');
    const engine = read('lib/finance/engines/management-reporting-engine.js');

    expect(page).toContain("['Board Pack Generator','ACTIVE'");
    expect(page).toContain('boardPackBtn');
    expect(page).toContain("api('command-center-board-pack')");
    expect(page).toContain('window.print()');
    expect(page).toContain('UNKNOWN means evidence is unavailable');
    expect(api).toContain("action === 'command-center-board-pack'");
    expect(api).toContain("analytics.command_center.read");
    expect(api).toContain('buildBoardPack');
    expect(adapter).toContain("runFinancialEngine('management_reporting'");
    expect(adapter).toContain("methodology: 'deterministic_governed_board_pack_no_ai'");
    expect(adapter).toContain("row?.scenario !== 'base'");
    expect(engine).toContain("packType === 'board'");
  });

});
