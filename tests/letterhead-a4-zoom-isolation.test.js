'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../components/letterhead-correspondence.js'), 'utf8');
const begin = source.indexOf('  async function createPdfBlob() {');
const end = source.indexOf('  async function persistIssuedPdfArtifact()', begin);
const pdf = source.slice(begin, end);

describe('letterhead PDF A4 capture ignores visual editor zoom', () => {
  test('waits for font metrics before rendering PDF', () => {
    expect(begin).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(begin);
    expect(pdf.indexOf('await document.fonts.ready')).toBeGreaterThan(-1);
    expect(pdf.indexOf('await document.fonts.ready')).toBeLessThan(pdf.indexOf('new window.jspdf.jsPDF'));
  });

  test('normalizes only clone transform before measuring captured sheet', () => {
    expect(pdf).toContain("const captureRoot = clonedDocument.getElementById('pages-container');");
    expect(pdf).toContain("if (captureRoot) captureRoot.style.transform = 'none';");
    const captureCallback = pdf.indexOf('onclone: clonedDocument => {');
    const normalized = pdf.indexOf("captureRoot.style.transform = 'none'");
    const measured = pdf.indexOf("const contentBottom = content.getBoundingClientRect().bottom");
    expect(captureCallback).toBeGreaterThan(-1);
    expect(normalized).toBeGreaterThan(captureCallback);
    expect(measured).toBeGreaterThan(normalized);
    expect(pdf).not.toMatch(/document\.getElementById\('pages-container'\)\.style\.transform\s*=/);
  });

  test('preserves issued PDF fail-closed clipping and pagination boundaries', () => {
    expect(pdf).toContain('if (canEditCurrent()) paginateEditableSheets();');
    expect(pdf).toContain('if (clippedContent) throw overflowError();');
    expect(pdf).toContain('if (a4Error) throw a4Error;');
    expect(pdf).toContain("pdf.addImage(img, 'JPEG'");
    expect(pdf).not.toContain('rebalanceIssuedClone');
  });
});
