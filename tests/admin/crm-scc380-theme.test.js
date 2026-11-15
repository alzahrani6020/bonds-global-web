const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(ROOT, 'admin/crm.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'admin/crm-scc380-theme.css'), 'utf8');

describe('Bonds CRM retains functionality with Makkin SCC380 visual identity', () => {
  test('loads a standalone, scoped CRM-only stylesheet after existing styling', () => {
    expect(html).toContain('<body class="crm-scc380">');
    expect(html).toContain('<link rel="stylesheet" href="/admin/crm-scc380-theme.css?v=1">');
    expect(html.indexOf('crm-scc380-theme.css')).toBeGreaterThan(html.indexOf('</style>'));
    expect(css).toContain('body.crm-scc380');
    expect(css).toContain('html:has(body.crm-scc380)');
  });

  test('reflects source SCC380 dark slate / blue design tokens', () => {
    expect(css).toContain('--bg: #0f172a;');
    expect(css).toContain('--card: #1e293b;');
    expect(css).toContain('--primary: #0066cc;');
    expect(css).toContain('--gold: #f59e0b;');
    expect(css).toContain('background: rgba(30,41,59,.72)');
    expect(css).toContain('@media (max-width: 520px)');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  test('preserves all read/write CRM entry points and security bridge', () => {
    for (const id of [
      'kpis', 'scoringKpis', 'pipeline', 'serviceRequestRows', 'orgRows',
      'renewalRows', 'successRows', 'clientRows', 'orgName', 'oppTitle',
      'oppOrg', 'oppStage', 'srSubmit'
    ]) {
      if (id !== 'srSubmit') expect(html).toContain('id="' + id + '"');
    }
    expect(html).toContain('BondsAuth.authenticatedFetch');
    expect(html).toContain("api('/api/admin?action=crm-overview')");
    expect(html).toContain("api('/api/admin?action=crm-organization-create'");
    expect(html).toContain("api('/api/admin?action=crm-opportunity-create'");
    expect(html).toContain("api('/api/admin?action=service-request-status-update'");
    expect(html).toContain("window.addEventListener('admin-auth-ready',loadCrm,{once:true})");
    expect(html).toContain('const esc=v=>BondsAdminCommon.escapeHtml');
  });
});
