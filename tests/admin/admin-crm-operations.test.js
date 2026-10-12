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
});
