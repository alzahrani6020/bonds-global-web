const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const page = fs.readFileSync(path.join(ROOT, 'admin/platform-center.html'), 'utf8');
const adminApi = fs.readFileSync(path.join(ROOT, 'api/admin.js'), 'utf8');

describe('admin platform center rebuild', () => {
  const actions = [
    'platform-overview',
    'executive-analytics-v2',
    'crm-overview',
    'support-overview',
    'finance-overview',
    'security-operations-overview',
    'automation-overview',
    'data-governance-overview'
  ];

  test('uses only current main read APIs', () => {
    for (const action of actions) {
      expect(page).toContain('/api/admin?action=' + action);
      expect(adminApi).toContain("'" + action + "'");
    }
  });

  test('does not revive legacy phase 5 generic mutation endpoint', () => {
    expect(page).not.toContain('action=platform-module');
    expect(page).not.toContain('action=platform-summary');
    expect(page).not.toContain('action=platform-readiness');
    expect(page).not.toContain("method:'POST'");
    expect(page).not.toContain('method: "POST"');
  });

  test('keeps admin guard and shared authenticated request path', () => {
    expect(page).toContain('BondsAuth.initAdminGuard()');
    expect(page).toContain('BondsAdminCommon.requestJson');
  });
});
