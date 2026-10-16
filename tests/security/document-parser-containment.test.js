const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const JSZip = require('jszip');

const {
  MAX_RAW_BYTES,
  MAX_ARCHIVE_ENTRY_BYTES,
  MAX_COMPRESSION_RATIO,
  ParserPolicyError,
  validateDocumentBuffer
} = require('../../lib/api/document-parser-core');
const {
  parseDocument,
  DocumentParserError,
  MAX_CONCURRENCY
} = require('../../lib/api/document-parser');

const ROOT = path.join(__dirname, '../..');

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv'
};

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.from(entry.data || '');
    const compressed = zlib.deflateRawSync(raw);
    const declaredSize = entry.declaredSize === undefined
      ? raw.length
      : entry.declaredSize;

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(declaredSize, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    locals.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(declaredSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDirectory, eocd]);
}

describe('document parser containment', () => {
  jest.setTimeout(30_000);

  test('DOCX parsing succeeds through the worker boundary', async () => {
    const buffer = fs.readFileSync(path.join(ROOT, 'feasibility-template-word.docx'));
    const result = await parseDocument({
      buffer,
      mime: MIME.docx,
      filename: 'fixture.docx'
    });

    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.rows).toBeNull();
  });

  test('PDF parsing succeeds through the worker boundary', async () => {
    const buffer = fs.readFileSync(path.join(ROOT, 'feasibility-template-ar.pdf'));
    const result = await parseDocument({
      buffer,
      mime: MIME.pdf,
      filename: 'fixture.pdf'
    });

    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.rows).toBeNull();
  });

  test('XLSX parsing succeeds through the worker boundary', async () => {
    const buffer = fs.readFileSync(path.join(ROOT, 'feasibility-template.xlsx'));
    const result = await parseDocument({
      buffer,
      mime: MIME.xlsx,
      filename: 'fixture.xlsx'
    });

    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(typeof result.text).toBe('string');
  });

  test('CSV parsing also uses the containment layer', async () => {
    const result = await parseDocument({
      buffer: Buffer.from('name,value\nalpha,1\nbeta,2\n', 'utf8'),
      mime: MIME.csv,
      filename: 'fixture.csv'
    });

    expect(result.rows).toEqual([
      ['name', 'value'],
      ['alpha', 1],
      ['beta', 2]
    ]);
  });

  test.each([
    [MIME.pdf, Buffer.from('not a pdf')],
    [MIME.docx, Buffer.from('not a docx')],
    [MIME.xlsx, Buffer.from('not an xlsx')]
  ])('MIME/signature mismatch is rejected before library parsing for %s', async (mime, buffer) => {
    await expect(parseDocument({ buffer, mime, filename: 'mismatch.bin' }))
      .rejects.toMatchObject({ code: 'SIGNATURE_MISMATCH' });
  });

  test('malformed ZIP is rejected safely before Office library parsing', () => {
    expect(() => validateDocumentBuffer(Buffer.from('PK\x03\x04bad'), MIME.docx))
      .toThrow(expect.objectContaining({ code: 'MALFORMED_ARCHIVE' }));
  });

  test('malformed DOCX XML fails safely inside containment', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
    zip.file('word/document.xml', '<w:document><w:body><w:p>');
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await expect(parseDocument({
      buffer,
      mime: MIME.docx,
      filename: 'malformed.docx'
    })).rejects.toBeInstanceOf(DocumentParserError);
  });

  test('malformed XLSX container fails safely inside containment', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet');
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await expect(parseDocument({
      buffer,
      mime: MIME.xlsx,
      filename: 'malformed.xlsx'
    })).rejects.toBeInstanceOf(DocumentParserError);
  });

  test('malformed PDF with valid magic fails safely inside containment', async () => {
    const buffer = Buffer.from('%PDF-1.7\nthis is not a valid PDF object graph\n%%EOF\n', 'utf8');

    await expect(parseDocument({
      buffer,
      mime: MIME.pdf,
      filename: 'malformed.pdf'
    })).rejects.toBeInstanceOf(DocumentParserError);
  });

  test('high compression ratio is rejected before parser extraction', () => {
    const bomb = buildZip([
      { name: '[Content_Types].xml', data: '<Types />' },
      { name: 'xl/workbook.xml', data: '<workbook />' },
      { name: 'xl/sharedStrings.xml', data: 'A'.repeat(200_000) }
    ]);

    expect(() => validateDocumentBuffer(bomb, MIME.xlsx))
      .toThrow(expect.objectContaining({ code: 'RESOURCE_LIMIT' }));

    const compressed = zlib.deflateRawSync(Buffer.from('A'.repeat(200_000)));
    expect(200_000 / compressed.length).toBeGreaterThan(MAX_COMPRESSION_RATIO);
  });

  test('oversized declared decompressed entry is rejected without allocating it', () => {
    const archive = buildZip([
      { name: '[Content_Types].xml', data: '<Types />' },
      { name: 'word/document.xml', data: '<document />' },
      {
        name: 'word/oversized.xml',
        data: 'tiny',
        declaredSize: MAX_ARCHIVE_ENTRY_BYTES + 1
      }
    ]);

    expect(() => validateDocumentBuffer(archive, MIME.docx))
      .toThrow(expect.objectContaining({ code: 'RESOURCE_LIMIT' }));
  });

  test('raw document limit remains 10 MB', async () => {
    const buffer = Buffer.alloc(MAX_RAW_BYTES + 1);
    await expect(parseDocument({
      buffer,
      mime: MIME.pdf,
      filename: 'oversized.pdf'
    })).rejects.toMatchObject({ code: 'RESOURCE_LIMIT' });
  });

  test('containment exposes a bounded worker concurrency policy', () => {
    expect(MAX_CONCURRENCY).toBeGreaterThan(0);
    expect(MAX_CONCURRENCY).toBeLessThanOrEqual(4);
  });

  test('public parser errors expose normalized messages only', () => {
    const policyError = new ParserPolicyError('MALFORMED_ARCHIVE', '/tmp/private/path parser exploded');
    expect(policyError.message).toContain('/tmp/private/path');

    const publicError = new DocumentParserError(policyError.code);
    expect(publicError.code).toBe('MALFORMED_ARCHIVE');
    expect(publicError.message).not.toContain('/tmp/');
    expect(publicError.message).not.toContain('parser exploded');
  });
});
