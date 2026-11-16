'use strict';

const fs = require('node:fs');
const path = require('node:path');

const file = path.resolve(__dirname, '../components/letterhead-correspondence.js');

function readExportSource() {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  async function createPdfBlob() {');
  const end = source.indexOf('  async function persistIssuedPdfArtifact()', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function buildPreflight(source) {
  const start = source.indexOf('    await waitForVerificationQr();');
  const stop = source.indexOf('    const sheets = Array.from(', start);
  expect(start).toBeGreaterThan(-1);
  expect(stop).toBeGreaterThan(start);
  // Execute the actual PDF preflight extracted from source, not a reimplemented
  // conditional; rendering itself is separately covered by browser acceptance.
  const body = source.slice(start, stop);
  return new Function('waitForVerificationQr', 'waitForLetterheadBrandImages', 'canEditCurrent', 'paginateEditableSheets',
    'return (async () => { ' + body + ' })();');
}

describe('letterhead PDF export / issued immutability', () => {
  test('issued document never invokes the mutating pagination preflight', async () => {
    const preflight = buildPreflight(readExportSource());
    const paginate = jest.fn(() => { throw new Error('issued document mutated'); });
    const qr = jest.fn().mockResolvedValue();
    const branded = jest.fn().mockResolvedValue();
    await expect(preflight(qr, branded, () => false, paginate)).resolves.toBeUndefined();
    expect(branded).toHaveBeenCalledTimes(1);
    expect(qr).toHaveBeenCalledTimes(1);
    expect(paginate).not.toHaveBeenCalled();
  });

  test('editable draft still performs pagination before PDF rendering', async () => {
    const preflight = buildPreflight(readExportSource());
    const paginate = jest.fn();
    await preflight(async () => {}, async () => {}, () => true, paginate);
    expect(paginate).toHaveBeenCalledTimes(1);
  });

  test('branding failure aborts PDF preflight without altering issued pages', async () => {
    const preflight = buildPreflight(readExportSource());
    const paginate = jest.fn();
    await expect(preflight(async () => {}, async () => {
      throw new Error('Branded image failed');
    }, () => false, paginate)).rejects.toThrow('Branded image failed');
    expect(paginate).not.toHaveBeenCalled();
  });

  test('issued A4 capture rejects collisions without mutating approved source', () => {
    const source = readExportSource();
    expect(source).toContain("err.code = 'BONDS_PDF_A4_CLIPPED'");
    expect(source).toContain("err.code = 'BONDS_PDF_A4_CAPTURE_BOUNDS'");
    expect(source).toContain("height: '297mm'");
    expect(source).toContain('const walker = copy.createTreeWalker(content');
    expect(source).toContain('painted.some(b => overlap(b, footerBounds))');
    expect(source).toContain('painted.some(b => qr.some(q => overlap(b, q)))');
    expect(source).toContain('page.scrollHeight > page.clientHeight + 1');
    expect(source).not.toContain('content.style.zoom');
    expect(source).toContain('if (failure) {');
    expect(source).toContain('if (canEditCurrent()) paginateEditableSheets();');
    expect(source).toContain('rebalanceIssuedClone(copy)');
    expect(source).toContain('html2canvas(container,');
    expect(source).not.toContain('html2canvas(sheets[i]');
  });

  test('official PDF artifact and finalization flows remain intact', () => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain('if (state.document?.artifact_hash) {');
    expect(source).toContain('await downloadOfficialPdf();');
    expect(source).toContain("await api('artifact-finalize'");
    expect(source).toContain("upsert: false");
  });
});
