/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('admin stabilization regressions', () => {
  test('authenticated admin reads use a dedicated non-mutation rate bucket', () => {
    const limiter = read('lib/api/rate-limit.js');
    const api = read('api/admin.js');

    expect(limiter).toContain("admin_read: { limit: 60, windowMs: 60_000 }");
    expect(api).toContain("const ADMIN_READ_ACTIONS = new Set([");
    expect(api).toContain("'messages'");
    expect(api).toContain("'admin-users'");
    expect(api).toContain("'sent-messages'");
    expect(api).toContain("'system-health'");
    expect(api).toContain("'operations-overview'");
    expect(api).toContain("req.method === 'GET' && ADMIN_READ_ACTIONS.has(action)");
    expect(api).toContain("rateCategory = 'admin_read'");
    expect(api).toContain("rateCategory = 'strict'");
  });

  test('message API returns aggregate counters for the entire result set', () => {
    const api = read('api/admin.js');

    expect(api).toContain('unread_total: unreadTotal');
    expect(api).toContain('today_total: todayTotal');
    expect(api).toContain("q.eq('read', false)");
    expect(api).toContain("q.gte('created_at', startOfTodayIso)");
  });

  test('messages UI does not convert a failed read into false zero state', () => {
    const page = read('admin/messages.html');

    expect(page).toContain("let msgTotal = null;");
    expect(page).toContain("let msgUnreadTotal = null;");
    expect(page).toContain("let msgTodayTotal = null;");
    expect(page).toContain("لم يتم افتراض أن عدد الرسائل صفر");
    expect(page).toContain("res.headers.get('Retry-After')");
    expect(page).toContain("تم تقييد التحديث مؤقتاً");
    expect(page).not.toContain("msgTotal = 0;");
  });

  test('admin dashboard uses the server-authoritative stats endpoint and a single admin guard', () => {
    const page = read('admin/dashboard.html');

    expect(page).toContain("apiGet('stats')");
    expect(page).toContain("apiGet('system-health')");
    expect(page).toContain("apiGet('operations-overview')");
    expect(page).toContain("apiGet('online-users')");
    expect(page).toContain('BondsAuth.initAdminGuard();');
    expect(page).not.toContain('/calculators/auth-gate.js');
    expect(page).not.toContain("sb?.from('contact_messages')");
    expect(page).not.toContain("sb?.from('advisory_clients')");
  });

  test('unknown dashboard values render as unknown rather than zero', () => {
    const page = read('admin/dashboard.html');

    expect(page).toContain("users: null");
    expect(page).toContain("messages: null");
    expect(page).toContain("const statValue = value => Number.isFinite(value)");
    expect(page).toContain("القيم غير المتاحة تظهر بشرطة (—) ولا يتم افتراض أنها صفر");
  });
});
