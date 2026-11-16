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
  return new Function('waitForVerificationQr', 'canEditCurrent', 'paginateEditableSheets',
    'return (async () => { ' + body + ' })();');
}

describe('letterhead PDF export / issued immutability', () => {
  test('issued document never invokes the mutating pagination preflight', async () => {
    const preflight = buildPreflight(readExportSource());
    const paginate = jest.fn(() => { throw new Error('issued document mutated'); });
    const qr = jest.fn().mockResolvedValue();
    await expect(preflight(qr, () => false, paginate)).resolves.toBeUndefined();
    expect(qr).toHaveBeenCalledTimes(1);
    expect(paginate).not.toHaveBeenCalled();
  });

  test('editable draft still performs pagination before PDF rendering', async () => {
    const preflight = buildPreflight(readExportSource());
    const paginate = jest.fn();
    await preflight(async () => {}, () => true, paginate);
    expect(paginate).toHaveBeenCalledTimes(1);
  });

  test('A4 clipping and overflow remain hard failures for locked documents', () => {
    const source = readExportSource();
    expect(source).toContain('if (clippedContent) throw overflowError();');
    expect(source).toContain('if (a4Error) throw a4Error;');
    expect(source).toContain('&& canEditCurrent())');
  });

  test('official PDF artifact and finalization flows remain intact', () => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain('if (state.document?.artifact_hash) {');
    expect(source).toContain('await downloadOfficialPdf();');
    expect(source).toContain("await api('artifact-finalize'");
    expect(source).toContain("upsert: false");
  });
});
