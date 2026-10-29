const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Admin CRM operations', () => {
  test('CRM schema supports organizations, pipeline, renewals and customer success', () => {
    const sql = read('supabase/migrations/20261012213000_admin_crm_operations.sql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.crm_organizations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.crm_opportunities');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.crm_renewals');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.crm_customer_success');
    expect(sql).toContain("CHECK (stage IN ('lead','qualified','proposal','negotiation','won','lost'))");
    expect(sql).toContain("CHECK (risk_level IN ('low','medium','high','critical'))");
    expect(sql).toContain("REVOKE ALL ON public.crm_organizations FROM anon, authenticated");
  });

  test('legacy advisory client status supports lead capture status', () => {
    const sql = read('supabase/migrations/20261012213000_admin_crm_operations.sql');

    expect(sql).toContain("CHECK (status IN ('lead','active','inactive','archived','prospect','customer'))");
  });

  test('CRM API exposes overview and audited mutations', () => {
    const api = read('api/admin.js');

    expect(api).toContain('async function getCrmOverview(sb)');
    expect(api).toContain('async function createCrmOrganization');
    expect(api).toContain('async function createCrmOpportunity');
    expect(api).toContain('async function updateCrmOpportunity');
    expect(api).toContain('async function upsertCrmCustomerSuccess');
    expect(api).toContain("'crm_organization_create'");
    expect(api).toContain("'crm_opportunity_update'");
    expect(api).toContain("'crm_customer_success_update'");
  });

  test('CRM workspace is linked from the admin dashboard', () => {
    const page = read('admin/crm.html');
    const dashboard = read('admin/dashboard.html');

    expect(page).toContain('CRM وإدارة الشركات');
    expect(page).toContain('Pipeline');
    expect(page).toContain('Customer Success');
    expect(page).toContain('التجديدات');
    expect(dashboard).toContain('/admin/crm.html?embed=1');
  });

  test('CRM dynamic UI uses shared escaping helper', () => {
    const page = read('admin/crm.html');

    expect(page).toContain('BondsAdminCommon.escapeHtml');
    expect(page).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  test('service request status changes notify the owning customer through existing notifications', () => {
    const api = read('api/admin.js');

    expect(api).toContain("if (before.status !== data.status && before.user_id)");
    expect(api).toContain("sb.from('user_notifications')");
    expect(api).toContain("subject: 'مطلوب إجراء منك على طلب الخدمة'");
    expect(api).toContain("body: 'طلب الخدمة رقم ' + data.request_reference + ' بانتظار معلومات أو مستندات منك.");
    expect(api).toContain("return { success: true, serviceRequest: data, notification }");
  });

  test('CRM exposes and manages service request operations using the database status contract', () => {
    const api = read('api/admin.js');
    const page = read('admin/crm.html');
    const ar = read('my-bonds/index.html');
    const en = read('en/my-bonds/index.html');

    expect(api).toContain("const SERVICE_REQUEST_STATUSES = new Set([");
    for (const status of ['draft','submitted','triage','in_progress','awaiting_client','awaiting_approval','completed','cancelled']) {
      expect(api).toContain("'" + status + "'");
    }
    expect(api).toContain("async function updateServiceRequestStatus");
    expect(api).toContain("'service_request_status_update'");
    expect(api).toContain("if (action === 'service-request-status-update')");
    expect(api).toContain("requireAdminPermission(req, sb, 'crm.write')");
    expect(api).toContain('serviceRequests: serviceRequestQueue');

    expect(page).toContain('طلبات الخدمات');
    expect(page).toContain('serviceRequestRows');
    expect(page).toContain('updateServiceRequestStatus');
    expect(page).toContain('awaiting_client');
    expect(page).toContain('awaiting_approval');

    expect(ar).toContain("triage:'قيد الفرز'");
    expect(ar).toContain("awaiting_client:'بانتظار العميل'");
    expect(ar).toContain("awaiting_approval:'بانتظار الاعتماد'");
    expect(en).toContain("triage:'Triage'");
    expect(en).toContain("awaiting_client:'Awaiting client'");
    expect(en).toContain("awaiting_approval:'Awaiting approval'");
  });
});
