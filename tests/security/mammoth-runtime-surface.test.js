const fs = require('fs');
const path = require('path');
const Module = require('module');
const JSZip = require('jszip');

const { parseDocumentBuffer } = require('../../lib/api/document-parser-core');
const { parseDocument } = require('../../lib/api/document-parser');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function buildDocx({ styleType = 'paragraph', styleMap = null } = {}) {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>fixture text</w:t></w:r></w:p>
  </w:body>
</w:document>`);

  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="${styleType}" w:styleId="fixtureStyle">
    <w:name w:val="fixture"/>
  </w:style>
</w:styles>`);

  if (styleMap !== null) {
    zip.file('mammoth/style-map', styleMap);
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('Mammoth production runtime surface', () => {
  jest.setTimeout(15_000);

  test('request handler delegates DOCX parsing to the containment layer', () => {
    const analyzerSource = fs.readFileSync(
      path.join(__dirname, '../../lib/api/analyze-document.js'),
      'utf8'
    );
    const coreSource = fs.readFileSync(
      path.join(__dirname, '../../lib/api/document-parser-core.js'),
      'utf8'
    );
    const workerSource = fs.readFileSync(
      path.join(__dirname, '../../lib/api/document-parser-worker.js'),
      'utf8'
    );

    expect(analyzerSource).toContain('parseDocument({');
    expect(analyzerSource).not.toContain("require('mammoth')");
    expect(coreSource).toContain("const mammoth = require('mammoth');");
    expect(coreSource).toContain('mammoth.extractRawText({ buffer })');
    expect(coreSource).not.toMatch(/externalFileAccess/);
    expect(coreSource).not.toMatch(/styleMap\s*:/);
    expect(workerSource).toContain("require('worker_threads')");
    expect(analyzerSource).not.toMatch(/child_process/);
  });

  test('resolved Mammoth version remains at or above both security fixes', () => {
    const lock = require('../../package-lock.json');
    const version = lock.packages?.['node_modules/mammoth']?.version;
    expect(version).toBeTruthy();

    const [major, minor, patch] = version.split('.').map(Number);
    const safe = major > 1 || (major === 1 && (minor > 12 || (minor === 12 && patch >= 3)));
    expect(safe).toBe(true);
  });

  test('loading the Mammoth library API does not load argparse', () => {
    const originalLoad = Module._load;
    let argparseLoaded = false;

    Module._load = function(request, parent, isMain) {
      if (request === 'argparse' || String(request).includes('argparse')) {
        argparseLoaded = true;
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    try {
      jest.resetModules();
      const mammoth = require('mammoth');
      expect(typeof mammoth.extractRawText).toBe('function');
      expect(argparseLoaded).toBe(false);
    } finally {
      Module._load = originalLoad;
    }
  });

  test('crafted __proto__ style does not mutate Object.prototype', async () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort();
    const buffer = await buildDocx({ styleType: '__proto__' });

    try {
      await parseDocumentBuffer({
        buffer,
        mime: DOCX_MIME,
        filename: 'prototype-regression.docx'
      });
    } catch (error) {
      // A safe rejection is acceptable; the invariant is no process-wide pollution.
      expect(error).toBeInstanceOf(Error);
    }

    const after = Object.getOwnPropertyNames(Object.prototype).sort();
    expect(after).toEqual(before);
  });

  test('pathological embedded style map cannot block the request event loop', async () => {
    const pathological = "p[style-name='" + '\\\\'.repeat(25_000);
    const buffer = await buildDocx({ styleMap: pathological });

    try {
      await parseDocument({
        buffer,
        mime: DOCX_MIME,
        filename: 'style-map-regression.docx'
      }, { timeoutMs: 4_000 });
    } catch (error) {
      expect(error.code).not.toBe('PARSER_TIMEOUT');
    }
  });
});
