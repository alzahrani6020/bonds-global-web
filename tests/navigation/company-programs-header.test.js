const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const header = fs.readFileSync(path.join(root, 'site-layout.js'), 'utf8');
const adminCrm = fs.readFileSync(path.join(root, 'admin/crm.html'), 'utf8');
const crmApi = fs.readFileSync(path.join(root, 'api/admin.js'), 'utf8');

describe('company programs header navigation', () => {
  test('uses the shared header, bilingual menu, and existing dropdown renderer', () => {
    expect(header).toContain("companyPrograms: isEn ? 'Company Programs' : 'برامج شركات'");
    expect(header).toContain("navId: 'company-programs'");
    expect(header).toContain("label: labels.companyPrograms, items: companyProgramsDropdown");
    expect(header).toContain('aria-expanded="false" aria-haspopup="true"');
    expect(header).toContain('headerContainer.innerHTML = buildHeader(lang, base)');
  });

  test('points at real CRM and client workspace pages without bypassing auth', () => {
    expect(header).not.toContain("href: '/admin/crm.html'");
    expect(header).toContain("href: isEn ? '/en/my-bonds/crm/' : '/my-bonds/crm/'");
    expect(header).toContain("href: isEn ? '/en/my-bonds/' : '/my-bonds/'");
    expect(fs.existsSync(path.join(root, 'admin/crm.html'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'my-bonds/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'en/my-bonds/index.html'))).toBe(true);
    expect(adminCrm).toContain("window.location.replace('/my-bonds/crm/?internal=1')");
    expect(fs.readFileSync(path.join(root, 'my-bonds/crm/crm-internal.js'),'utf8')).toContain('BondsAuth.authenticatedFetch');
    expect(adminCrm).toContain("api('/api/admin?action=crm-overview')");
    expect(crmApi).toContain("await requireAdminPermission(req, sb, 'crm.read')");
    expect(crmApi).toContain("await requireAdminPermission(req, sb, 'crm.write')");
  });

  test('does not create a public CRM access path or new backend endpoints', () => {
    expect(header).not.toContain("href: '/api/admin?action=crm-overview'");
    expect(header).not.toContain("href: '/admin/crm.html?auth=false'");
  });
});
