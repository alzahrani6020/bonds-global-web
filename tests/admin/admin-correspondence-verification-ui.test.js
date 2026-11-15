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

  test('admin event service reads recipient, topic, and official issue date under admin route', () => {
    const api = read('api/admin.js');
    expect(api).toContain("if (action === 'verification-events')");
    expect(api).toContain("await verifyAdminStrict(req, sb)");
    expect(api).toContain("document:correspondence_documents!correspondence_verification_events_document_id_fkey");
    expect(api).toContain("recipient_name,recipient_organization,issued_at,confidentiality");
  });

  test('admin table labels visitor identity accurately and links to the real letter', () => {
    const app = read('admin/correspondence-verification/app.js');
    expect(app).toContain('ev.issue?.issued_at || ev.document?.issued_at');
    expect(app).toContain('ev.document?.recipient_name || ev.document?.recipient_organization');
    expect(app).toContain('ev.document?.subject || ev.document?.title');
    expect(app).toContain('هوية غير مسجلة');
    expect(app).toContain('colspan="8"');
    expect(app).toContain('escapeHtml(ev.document?.subject');
  });

  test('verification event attributes an authenticated account only when bearer identity is resolved', () => {
    const correspondence = read('lib/api/correspondence.js');
    expect(correspondence).toContain('const verifier = await resolveUser(req)');
    expect(correspondence).toContain('if (!verifier || verifier.is_anonymous)');
    expect(correspondence).toContain('p_actor_user_id: verifier.id');
    expect(correspondence).toContain("sb.rpc('record_correspondence_verification'");
    const api = read('api/admin.js');
    expect(api).toContain("select('id,email,phone').in('id', actorIds)");
    expect(api).toContain('verifier_email: contactById.get(event.actor_user_id)?.email');
    const app = read('admin/correspondence-verification/app.js');
    expect(app).toContain('function verifierCell(event)');
    expect(app).toContain('escapeHtml(event.verifier_email)');
    expect(app).toContain('escapeHtml(event.verifier_phone)');
  });

  test('every verification log row can open its letterhead document', () => {
    const app = read('admin/correspondence-verification/app.js');
    expect(app).toContain('/letterhead.html?document=');
    expect(app).toContain('encodeURIComponent(documentId)');
    expect(app).toContain("target=\"_blank\"");
  });
});
