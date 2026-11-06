const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('BONDS free first-party command center', () => {
  test('admin API exposes RBAC-protected first-party analytics', () => {
    const api = read('api/admin.js');
    expect(api).toContain("action === 'first-party-analytics'");
    expect(api).toContain("requireAdminPermission(req, sb, 'analytics.executive')");
    expect(api).toContain('getFirstPartyAnalytics(sb)');
  });

  test('first-party analytics uses only BONDS-owned operational tables', () => {
    const api = read('api/admin.js');
    expect(api).toContain("sb.from('page_views')");
    expect(api).toContain("sb.from('page_sessions')");
    expect(api).toContain("sb.from('user_presence')");
    expect(api).toContain("sb.from('contact_messages')");
    expect(api).toContain("sb.from('funding_cases')");
    expect(api).toContain("mode: 'first_party_free'");
    expect(api).toContain("costDependency: 'none'");
  });

  test('first-party response suppresses raw identifiers and PII', () => {
    const api = read('api/admin.js');
    expect(api).toContain('rawSessionIdsReturned: false');
    expect(api).toContain('rawIpAddressesReturned: false');
    expect(api).toContain('piiReturned: false');
    const returnStart = api.indexOf("mode: 'first_party_free'");
    const returnEnd = api.indexOf('// ── Executive Analytics / AI Operations', returnStart);
    const responseBlock = api.slice(returnStart, returnEnd);
    expect(responseBlock).not.toContain('ip_address:');
    expect(responseBlock).not.toContain('session_id:');
  });

  test('dashboard uses first-party traffic as primary source', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain("api('first-party-analytics')");
    expect(page).toContain("fp?.traffic?.visitorsToday");
    expect(page).toContain("fp?.traffic?.onlineNow");
    expect(page).toContain('BONDS unique first-party sessions');
    expect(page).toContain('BONDS presence, آخر دقيقتين');
  });

  test('GA4 stays optional and does not block primary traffic KPIs', () => {
    const page = read('admin/executive-command-center.html');
    expect(page).toContain("api('ga4-analytics')");
    expect(page).toContain("ga?.configured && ga?.status!=='healthy'");
    expect(page).not.toContain('GA4 Data API غير مهيأ داخل لوحة BONDS؛ مؤشرات Traffic/Realtime/Attribution ستظل UNKNOWN.');
    expect(page).toContain("['BONDS Traffic & Realtime','ACTIVE'");
    expect(page).toContain("['Traffic Sources','ACTIVE'");
    expect(page).toContain("['Top Pages / Landing Pages','ACTIVE'");
    expect(page).toContain("['Geography & Devices','ACTIVE'");
  });

  test('aggregate lead conversion is explicitly non-attribution', () => {
    const api = read('api/admin.js');
    expect(api).toContain('aggregateLeadConversionPct30d');
    expect(api).toContain('aggregate only, not identity attribution');
  });
});
