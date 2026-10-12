const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Admin Users 360 and CRM foundation', () => {
  test('Users 360 aggregates customer operational context server-side', () => {
    const api = read('api/admin.js');

    expect(api).toContain('async function getUser360(sb, userId)');
    expect(api).toContain("sb.from('profiles')");
    expect(api).toContain("sb.from('subscriptions')");
    expect(api).toContain("sb.from('moyasar_invoices')");
    expect(api).toContain("sb.from('user_presence')");
    expect(api).toContain("sb.from('contact_messages')");
    expect(api).toContain("sb.from('funding_cases')");
    expect(api).toContain("sb.from('admin_audit_log')");
    expect(api).toContain("sb.from('advisory_clients')");
    expect(api).toContain('healthScore');
    expect(api).toContain('timeline.slice(0, 250)');
  });

  test('internal notes and tags are admin-mediated and audited', () => {
    const api = read('api/admin.js');
    const migration = read('supabase/migrations/20261012210000_admin_customer_360.sql');

    expect(api).toContain('async function addUser360Note');
    expect(api).toContain('async function setUser360Tags');
    expect(api).toContain("'customer_note_add'");
    expect(api).toContain("'customer_tags_update'");
    expect(migration).toContain('REVOKE ALL ON public.admin_customer_notes FROM anon, authenticated');
    expect(migration).toContain('REVOKE ALL ON public.admin_customer_tags FROM anon, authenticated');
  });

  test('Users 360 UI exposes unified customer workspace', () => {
    const page = read('admin/user-360.html');
    const users = read('admin/users.html');

    expect(page).toContain('ملف المستخدم 360');
    expect(page).toContain('Timeline موحد');
    expect(page).toContain('Advisory / Company');
    expect(page).toContain('Audit Log');
    expect(page).toContain('Health Score');
    expect(users).toContain('ملف المستخدم 360');
    expect(users).toContain('/admin/user-360.html?user_id=');
  });

  test('dynamic Users 360 content uses shared escaping helper', () => {
    const page = read('admin/user-360.html');

    expect(page).toContain('BondsAdminCommon.escapeHtml');
    expect(page).toContain('function esc(v)');
    expect(page).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
