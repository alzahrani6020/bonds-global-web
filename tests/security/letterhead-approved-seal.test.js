const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

describe('Approved BONDS electronic seal and PDF QR integrity', () => {
  const client = read('components/letterhead-correspondence.js');
  test('vector institutional seal contains the approved identity and live issuance fields', () => {
    expect(client).toContain("document.createElementNS(ns, tag)");
    expect(client).toContain("const arcId = 'bonds-seal-title-'");
    expect(client).toContain('بوندز للاستشارات المالية والإدارية');
    expect(client).toContain("'BONDS'");
    expect(client).toContain('رقم السجل 39733');
    expect(client).toContain('doc.outgoing_number || doc.reference_number');
    expect(client).toContain('doc.issued_at || doc.stamped_at');
    expect(client).toContain("stamp.appendChild(svg)");
    expect(client).not.toContain("stamp.textContent = isEn");
  });

  test.each(['letterhead.html', 'en/letterhead.html'])('%s renders the seal as a non-clipped SVG', htmlFile => {
    const html = read(htmlFile);
    expect(html).toContain('.official-stamp svg {');
    expect(html).toContain('width: 238px;');
    expect(html).toContain('height: 152px;');
    expect(html).toContain('overflow: visible;');
    expect(html).toContain('aspect-ratio: 300 / 192;');
  });

  test('PDF capture fails closed instead of silently hiding missing verification QR', () => {
    const wait = client.slice(client.indexOf('async function waitForVerificationQr()'), client.indexOf('async function createPdfBlob()'));
    expect(wait).toContain('const ready = await Promise.all(images.map(img => {');
    expect(wait).toContain('if (ready.some(ok => !ok))');
    expect(wait).toContain('تعذر إنشاء PDF: رمز QR مطلوب لم يكتمل تحميله');
    expect(wait).not.toContain("img.style.visibility = 'hidden'");
    expect(client).toContain('await waitForVerificationQr()');
  });
});
