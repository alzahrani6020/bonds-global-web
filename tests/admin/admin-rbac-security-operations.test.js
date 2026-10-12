const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Advanced admin RBAC and security operations', () => {
  test('schema includes granular permissions, overrides, delegation, approvals and security events', () => {
    const sql = read('supabase/migrations/20261012230000_admin_rbac_security_ops.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_permissions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_role_permissions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_user_permission_overrides');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_temporary_access');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_delegations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_approval_requests');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_security_events');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_trusted_devices');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.admin_break_glass_access');
  });

  test('permission resolution supports role, deny override, temporary grants and delegation', () => {
    const api = read('api/admin.js');
    expect(api).toContain('async function resolveAdminPermissions');
    expect(api).toContain("row.effect === 'deny'");
    expect(api).toContain("'temporary'");
    expect(api).toContain("'delegation'");
    expect(api).toContain('async function requireAdminPermission');
    expect(api).toContain("throw forbidden('Missing permission: ' + permission)");
    expect(api).toContain('const deniedPermissions = new Set()');
    expect(api).toContain('if (!deniedPermissions.has(row.permission))');
    expect(api).toContain('if (result.error) throw result.error');
  });

  test('high-value operation endpoints use granular permissions', () => {
    const api = read('api/admin.js');
    expect(api).toContain("requireAdminPermission(req, sb, 'billing.read')");
    expect(api).toContain("requireAdminPermission(req, sb, 'billing.refund')");
    expect(api).toContain("requireAdminPermission(req, sb, 'billing.reconcile')");
    expect(api).toContain("requireAdminPermission(req, sb, 'crm.read')");
    expect(api).toContain("requireAdminPermission(req, sb, 'crm.write')");
    expect(api).toContain("requireAdminPermission(req, sb, 'support.manage')");
    expect(api).toContain("if (action === 'finance-refund-update')");
    expect(api).toContain("if (action === 'support-ticket-update')");
    expect(api).toContain("if (action === 'crm-opportunity-update')");
  });

  test('permission simulator and security operations are exposed in admin UI', () => {
    const api = read('api/admin.js');
    const page = read('admin/security-operations.html');
    const dashboard = read('admin/dashboard.html');
    expect(api).toContain('async function simulateAdminPermissions');
    expect(api).toContain('async function getSecurityOperationsOverview');
    expect(page).toContain('Permission Simulator');
    expect(page).toContain('Break-glass');
    expect(page).toContain('aria-label="معرف المستخدم للمحاكاة"');
    expect(page).toContain('aria-label="انتهاء الصلاحية المؤقتة"');
    expect(page).toContain('.muted{color:#475569}');
    expect(dashboard).toContain('/admin/security-operations.html?embed=1');
  });

  test('security operations UI escapes dynamic values', () => {
    const page = read('admin/security-operations.html');
    expect(page).toContain('BondsAdminCommon.escapeHtml');
    expect(page).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
