const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Dynamic service orchestration layer', () => {
  test('public service discovery is driven by canonical country, taxonomy and service APIs', () => {
    const component = read('components/service-discovery.js');
    expect(component).toContain('/api/v3/catalog/countries');
    expect(component).toContain('/api/v3/catalog/cities?country=');
    expect(component).toContain('/api/v3/investment-taxonomy?country=');
    expect(component).toContain('/api/v3/services/catalog?');
    expect(component).toContain('bonds_service_intent');
    expect(component).toContain('localityLabel');
    expect(component).toContain("village:'قرية'");
    expect(component).toContain("hijra:'هجرة'");
    expect(component).toContain("service:serviceCode");
  });

  test('site navigation separates services, sectors, tools and knowledge', () => {
    const layout = read('site-layout.js');
    expect(layout).toContain("sectors: isEn ? 'Sectors' : 'القطاعات'");
    expect(layout).toContain("knowledge: isEn ? 'Knowledge' : 'المعرفة'");
    expect(layout).toContain("label: labels.services");
    expect(layout).toContain("label: labels.sectors");
    expect(layout).toContain("label: labels.tools");
    expect(layout).toContain("label: labels.knowledge");
    expect(layout).not.toContain("{ type: 'dropdown', label: labels.fundingHub, items: fundingDropdown, highlight: true }");
  });

  test('service API reuses existing engines and valid CRM lifecycle', () => {
    const api = read('v3/api/services.js');
    expect(api).toContain("from('service_catalog')");
    expect(api).toContain("from('service_capability_map')");
    expect(api).toContain("from('service_requests')");
    expect(api).toContain("from('service_procedures')");
    expect(api).toContain("from('service_pricing')");
    expect(api).toContain("from('service_form_fields')");
    expect(api).toContain("from('crm_opportunities')");
    expect(api).toContain("stage: 'lead'");
    expect(api).not.toContain("stage: 'new'");
  });

  test('admin CMS exposes service and dynamic-form management', () => {
    const api = read('v3/api/admin.js');
    const page = read('v3/admin/services.html');
    expect(api).toContain('handleServiceAdmin');
    expect(api).toContain('handleServiceFormsAdmin');
    expect(api).toContain("from('service_form_definitions')");
    expect(api).toContain("from('service_form_fields')");
    expect(page).toContain('إدارة الخدمات');
    expect(page).toContain('النماذج الديناميكية');
    expect(page).toContain('المحركات المرتبطة');
    expect(page).toContain('إجراءات الخدمة');
    expect(page).toContain('تسعير الخدمة');
    expect(page).toContain('طلبات الخدمات');
    const adminApi = read('v3/api/admin.js');
    expect(adminApi).toContain("event:'service_completed'");
    expect(adminApi).toContain("from('nps_surveys')");
  });

  test('unified service request page renders dynamic service data', () => {
    const page = read('service-request.html');
    const component = read('components/service-request.js');
    expect(page).toContain('srDynamicFields');
    expect(page).toContain('srProcedures');
    expect(component).toContain('/api/v3/services/');
    expect(component).toContain('/api/v3/services/requests');
    expect(component).toContain('Authorization');
    expect(component).toContain('form_abandoned');
    expect(component).toContain('service_converted');
  });

  test('Vercel serves the service manager before the admin catch-all', () => {
    const config = JSON.parse(read('vercel.json'));
    const specific = config.rewrites.findIndex(x => x.source === '/v3/admin/services');
    const catchAll = config.rewrites.findIndex(x => x.source === '/v3/admin/(.*)');
    expect(specific).toBeGreaterThanOrEqual(0);
    expect(catchAll).toBeGreaterThan(specific);
  });
});