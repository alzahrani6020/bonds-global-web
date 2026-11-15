/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('correspondence verification module UI contracts', () => {
  const MODULE_TARGET = '/admin/correspondence-verification/?embed=1';

  test('dashboard sidebar has a static link to the verification module', () => {
    const html = read('admin/dashboard.html');
    expect(html).toContain(`data-target="${MODULE_TARGET}"`);
    expect(html).toContain('المراسلات والتحقق');
  });

  test('groupConfig keeps the module link inside an organized group (not the catch-all)', () => {
    const html = read('admin/dashboard.html');
    const groupConfigStart = html.indexOf('const groupConfig = [');
    expect(groupConfigStart).toBeGreaterThan(-1);
    const groupConfig = html.slice(groupConfigStart);
    expect(groupConfig).toContain(`['${MODULE_TARGET}', 'المراسلات والتحقق']`);
  });

  test('module page is a self-sufficient SPA with embed support', () => {
    const html = read('admin/correspondence-verification/index.html');
    expect(html).toContain('/admin/correspondence-verification/service.js');
    expect(html).toContain('/admin/correspondence-verification/app.js');
    expect(html).toContain('/admin/admin-embed.js');
    expect(html).toContain('id="cv-content"');
  });

  test('every verification log row can open its letterhead document', () => {
    const app = read('admin/correspondence-verification/app.js');
    expect(app).toContain('/letterhead.html?document=');
    expect(app).toContain('encodeURIComponent(documentId)');
    expect(app).toContain("target=\"_blank\"");
  });
});
