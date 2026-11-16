'use strict';

const fs = require('fs');
const path = require('path');

// Guard the real export architecture, not only an isolated pagination helper.
// The two approved four-sheet issues require a single consistent capture:
// an onclone invocation for EACH sheet can independently move text to
// different pages and silently duplicate or drop paragraphs.
describe('governed A4 PDF export architecture', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'letterhead-correspondence.js'), 'utf8'
  );
  const start = source.indexOf('  async function createPdfBlob() {');
  const end = source.indexOf('  async function persistIssuedPdfArtifact()', start);
  const exportPath = source.slice(start, end);

  test('captures one unified page container instead of cloning each sheet separately', () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect((exportPath.match(/\bhtml2canvas\s*\(/g) || [])).toHaveLength(1);
    expect(exportPath).toMatch(/html2canvas\(container,\s*\{/);
    expect(exportPath).not.toMatch(/html2canvas\(sheets\[i\]/);
    expect(exportPath).toContain("if (root) root.style.transform = 'none'");
    expect(exportPath).toContain('rebalanceIssuedClone(copy)');
    expect(exportPath).toContain("pages.length !== sheets.length");
    expect(exportPath).toContain('positions.length !== sheets.length');
  });

  test('fails closed on cropped or overlapping content including QR and footer', () => {
    for (const guard of [
      "'footer'", "'qr'", "'page'", "'scroll'", "'a4-geometry'",
      "'BONDS_PDF_A4_CLIPPED'", "'BONDS_PDF_A4_CAPTURE_BOUNDS'"
    ]) {
      expect(exportPath).toContain(guard);
    }
    expect(exportPath).toContain('page.scrollHeight > page.clientHeight + 1');
    expect(exportPath).toContain('waitForVerificationQr()');
    expect(exportPath).toContain('waitForLetterheadBrandImages()');
  });

  test('retains issue integrity marker, archived PDF workflow and per-sheet A4 numbering', () => {
    expect(exportPath).toContain("'BONDS-DOC'");
    expect(exportPath).toContain('state.document.document_hash');
    expect(exportPath).toContain('state.document.issued_hash');
    expect(exportPath).toMatch(/if \(i\) pdf\.addPage\(\)/);
    expect(exportPath).toContain("'JPEG', 0, 0, 210, 297");
    expect(source).toContain("api('artifact-finalize'");
    expect(source).toContain("api('artifact-upload-url'");
  });
});
