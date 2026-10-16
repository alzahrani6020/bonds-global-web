'use strict';

const zlib = require('zlib');
const { TextDecoder } = require('util');

const MAX_RAW_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2048;
const MAX_ARCHIVE_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_EXTRACTED_TEXT_CHARS = 2_000_000;
const MAX_EXTRACTED_ROWS = 20_000;

class ParserPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ParserPolicyError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ParserPolicyError(code, message);
}

function safeFilename(filename) {
  return String(filename || 'document')
    .replace(/[\r\n\t]/g, ' ')
    .slice(0, 255);
}

function startsWithBytes(buffer, bytes) {
  if (buffer.length < bytes.length) return false;
  return bytes.every((value, index) => buffer[index] === value);
}

function detectParserKind(mime) {
  const normalized = String(mime || '').toLowerCase().split(';', 1)[0].trim();

  if (normalized === 'application/pdf') return 'pdf';
  if (normalized === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (normalized === 'application/msword') return 'doc';
  if (normalized === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (normalized === 'application/vnd.ms-excel') return 'xls';
  if (normalized === 'text/csv' || normalized === 'application/csv') return 'csv';

  return null;
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail('MALFORMED_ARCHIVE', 'ZIP end-of-central-directory record was not found');
}

function decodeZipName(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('MALFORMED_ARCHIVE', 'ZIP entry name is not valid UTF-8');
  }
}

function assertSafeZipPath(name) {
  if (!name || name.includes('\0')) fail('MALFORMED_ARCHIVE', 'ZIP entry name is invalid');
  const normalized = name.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    fail('MALFORMED_ARCHIVE', 'ZIP entry path is unsafe');
  }
}

function inflateAndMeasureEntry(buffer, entry, centralDirectoryOffset) {
  const localOffset = entry.localOffset;
  if (localOffset < 0 || localOffset + 30 > centralDirectoryOffset) {
    fail('MALFORMED_ARCHIVE', 'ZIP local header is outside the archive data region');
  }
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    fail('MALFORMED_ARCHIVE', 'ZIP local header signature is invalid');
  }

  const localNameLength = buffer.readUInt16LE(localOffset + 26);
  const localExtraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataStart < 0 || dataEnd > centralDirectoryOffset || dataEnd > buffer.length) {
    fail('MALFORMED_ARCHIVE', 'ZIP entry payload is truncated');
  }

  const compressed = buffer.subarray(dataStart, dataEnd);
  let actualSize = 0;

  if (entry.method === 0) {
    actualSize = compressed.length;
  } else if (entry.method === 8) {
    try {
      actualSize = zlib.inflateRawSync(compressed, {
        maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES + 1
      }).length;
    } catch (error) {
      if (
        error &&
        (error.code === 'ERR_BUFFER_TOO_LARGE' ||
          /maxOutputLength|larger than/i.test(String(error.message || '')))
      ) {
        fail('RESOURCE_LIMIT', 'ZIP entry exceeds decompressed-size limit');
      }
      fail('MALFORMED_ARCHIVE', 'ZIP entry could not be decompressed safely');
    }
  } else {
    fail('MALFORMED_ARCHIVE', 'ZIP compression method is not supported');
  }

  if (actualSize !== entry.uncompressedSize) {
    fail('MALFORMED_ARCHIVE', 'ZIP entry size metadata does not match decompressed data');
  }

  return actualSize;
}

function inspectZipArchive(buffer) {
  if (!startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    fail('SIGNATURE_MISMATCH', 'Expected a ZIP-based Office container');
  }

  const eocd = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    fail('MALFORMED_ARCHIVE', 'Multi-disk ZIP archives are not supported');
  }
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    fail('RESOURCE_LIMIT', 'ZIP64 Office containers are not accepted');
  }
  if (entryCount === 0 || entryCount > MAX_ARCHIVE_ENTRIES) {
    fail('RESOURCE_LIMIT', 'ZIP archive entry count exceeds policy');
  }
  if (
    centralDirectoryOffset + centralDirectorySize > eocd ||
    centralDirectoryOffset < 0
  ) {
    fail('MALFORMED_ARCHIVE', 'ZIP central directory bounds are invalid');
  }

  const entries = [];
  let offset = centralDirectoryOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50) {
      fail('MALFORMED_ARCHIVE', 'ZIP central directory entry is invalid');
    }

    const versionNeeded = buffer.readUInt16LE(offset + 6);
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);

    if (versionNeeded >= 45) fail('RESOURCE_LIMIT', 'ZIP64 entries are not accepted');
    if ((flags & 0x1) !== 0) fail('MALFORMED_ARCHIVE', 'Encrypted ZIP entries are not accepted');
    if (![0, 8].includes(method)) fail('MALFORMED_ARCHIVE', 'Unsupported ZIP compression method');
    if (uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) {
      fail('RESOURCE_LIMIT', 'ZIP entry exceeds individual decompressed-size limit');
    }

    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const nextOffset = nameEnd + extraLength + commentLength;
    if (nameEnd > eocd || nextOffset > eocd) {
      fail('MALFORMED_ARCHIVE', 'ZIP central directory entry is truncated');
    }

    const name = decodeZipName(buffer.subarray(nameStart, nameEnd));
    assertSafeZipPath(name);

    const ratio = uncompressedSize === 0
      ? 1
      : uncompressedSize / Math.max(compressedSize, 1);
    if (ratio > MAX_COMPRESSION_RATIO) {
      fail('RESOURCE_LIMIT', 'ZIP entry compression ratio exceeds policy');
    }

    const entry = {
      name,
      method,
      compressedSize,
      uncompressedSize,
      localOffset
    };
    const actualSize = inflateAndMeasureEntry(buffer, entry, centralDirectoryOffset);
    totalUncompressed += actualSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      fail('RESOURCE_LIMIT', 'ZIP archive exceeds total decompressed-size limit');
    }

    entries.push(entry);
    offset = nextOffset;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) {
    fail('MALFORMED_ARCHIVE', 'ZIP central directory size does not match its entries');
  }

  return entries;
}

function validateOfficeStructure(buffer, kind) {
  const entries = inspectZipArchive(buffer);
  const names = new Set(entries.map(entry => entry.name));

  const required = kind === 'docx'
    ? ['[Content_Types].xml', 'word/document.xml']
    : ['[Content_Types].xml', 'xl/workbook.xml'];

  for (const requiredName of required) {
    if (!names.has(requiredName)) {
      fail('SIGNATURE_MISMATCH', 'Office container structure does not match stored MIME type');
    }
  }

  return entries;
}

function validateCsv(buffer) {
  if (
    startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  ) {
    fail('SIGNATURE_MISMATCH', 'Stored CSV MIME does not match file signature');
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail('SIGNATURE_MISMATCH', 'CSV content is not valid UTF-8 text');
  }
}

function validateDocumentBuffer(buffer, mime) {
  if (!Buffer.isBuffer(buffer)) fail('MALFORMED_DOCUMENT', 'Document payload is not a Buffer');
  if (buffer.length === 0) fail('MALFORMED_DOCUMENT', 'Document is empty');
  if (buffer.length > MAX_RAW_BYTES) fail('RESOURCE_LIMIT', 'Document exceeds raw 10 MB limit');

  const kind = detectParserKind(mime);
  if (!kind) fail('UNSUPPORTED_DOCUMENT', 'Document MIME type is not supported for parsing');

  if (kind === 'pdf' && !startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    fail('SIGNATURE_MISMATCH', 'Stored PDF MIME does not match file signature');
  }

  if (kind === 'docx' || kind === 'xlsx') {
    validateOfficeStructure(buffer, kind);
  }

  if (
    kind === 'xls' &&
    !startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  ) {
    fail('SIGNATURE_MISMATCH', 'Stored XLS MIME does not match compound-file signature');
  }

  if (kind === 'doc') {
    fail('UNSUPPORTED_DOCUMENT', 'Legacy binary DOC parsing is not supported');
  }

  if (kind === 'csv') validateCsv(buffer);

  return kind;
}

function clampText(text) {
  const value = String(text || '');
  return value.length > MAX_EXTRACTED_TEXT_CHARS
    ? value.slice(0, MAX_EXTRACTED_TEXT_CHARS)
    : value;
}

async function parseDocumentBuffer({ buffer, mime, filename }) {
  const kind = validateDocumentBuffer(buffer, mime);
  const displayName = safeFilename(filename);

  if (kind === 'csv' || kind === 'xlsx' || kind === 'xls') {
    const xlsx = require('xlsx');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const firstName = workbook.SheetNames && workbook.SheetNames[0];
    if (!firstName || !workbook.Sheets[firstName]) {
      fail('MALFORMED_DOCUMENT', 'Spreadsheet does not contain a readable worksheet');
    }
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[firstName], {
      header: 1,
      defval: ''
    });
    const boundedRows = rows.slice(0, MAX_EXTRACTED_ROWS);
    const text = clampText(boundedRows.map(row => row.join('\t')).join('\n'));
    return {
      rows: boundedRows,
      text,
      summary: `تم استخراج ${boundedRows.length} صفوف من ${displayName}`,
      method: 'local'
    };
  }

  if (kind === 'pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = clampText(result && result.text);
      return {
        rows: null,
        text,
        summary: `تم استخراج ${text.length} حرف من ${displayName}`,
        method: 'local'
      };
    } finally {
      await parser.destroy();
    }
  }

  if (kind === 'docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = clampText(result && result.value);
    return {
      rows: null,
      text,
      summary: `تم استخراج ${text.length} حرف من ${displayName}`,
      method: 'local'
    };
  }

  fail('UNSUPPORTED_DOCUMENT', 'No parser is registered for this document type');
}

module.exports = {
  MAX_RAW_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_ENTRY_BYTES,
  MAX_COMPRESSION_RATIO,
  ParserPolicyError,
  detectParserKind,
  inspectZipArchive,
  validateDocumentBuffer,
  parseDocumentBuffer
};
