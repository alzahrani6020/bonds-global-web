'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../components/letterhead-correspondence.js'), 'utf8');
const start = source.indexOf('  window.exportPDF = async function () {');
const end = source.indexOf('\n  document.addEventListener(\'DOMContentLoaded\'', start);
const exporter = source.slice(start, end);

describe('letterhead local PDF repeat download contract', () => {
  test('only the governed exporter is active and keeps URLs alive across clicks', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(exporter).toContain('await createPdfBlob()');
    expect(exporter).toContain("blob.type !== 'application/pdf'");
    expect(exporter).toContain('window.setTimeout(() => URL.revokeObjectURL(url), 60000)');
    expect(exporter).not.toContain('a.remove();\n      URL.revokeObjectURL(url)');
    expect(exporter).toContain('a.click()');
  });

  test('repeated download requests each create distinct URLs with deferred cleanup', async () => {
    const issued = [];
    const timers = [];
    const events = [];
    const document = {
      body: { appendChild(anchor) { events.push(['append', anchor.download]); } },
      createElement(tag) {
        expect(tag).toBe('a');
        return {
          style: {},
          click() { issued.push(this.href); },
          remove() { events.push(['remove', this.href]); }
        };
      }
    };
    let index = 0;
    const URL = {
      createObjectURL(blob) { expect(blob.type).toBe('application/pdf'); return 'blob:test-' + (++index); },
      revokeObjectURL(url) { events.push(['revoke', url]); }
    };
    const window = { setTimeout(callback, delay) { timers.push({callback, delay}); } };
    const state = { document: { reference_number: 'TEST-LETTER' } };
    const toast = jest.fn();
    const restoreCanonicalLockedDocument = async () => {};
    const createPdfBlob = async () => ({size: 1100, type: 'application/pdf'});
    const downloadOfficialPdf = async () => { throw new Error('unexpected official path'); };
    const run = new Function('document', 'URL', 'window', 'state', 'toast', 'restoreCanonicalLockedDocument',
      'createPdfBlob', 'downloadOfficialPdf', 'isEn', exporter + '\nreturn window.exportPDF;');
    const download = run(document, URL, window, state, toast, restoreCanonicalLockedDocument,
      createPdfBlob, downloadOfficialPdf, false);
    await download();
    await download();
    expect(issued).toEqual(['blob:test-1', 'blob:test-2']);
    expect(timers.map(x => x.delay)).toEqual([60000, 60000]);
    expect(events.filter(x => x[0] === 'revoke')).toHaveLength(0);
    timers.forEach(x => x.callback());
    expect(events.filter(x => x[0] === 'revoke').map(x => x[1])).toEqual(issued);
  });
});

describe('governed correspondence repeated read budget', () => {
  const platform = fs.readFileSync(path.resolve(__dirname, '../api/platform.js'), 'utf8');
  const limiter = fs.readFileSync(path.resolve(__dirname, '../lib/api/rate-limit.js'), 'utf8');
  test('authenticated GET refresh does not consume login or mutation budget', () => {
    const from = platform.indexOf('// Dynamic correspondence / Letterhead');
    const to = platform.indexOf('// Letterhead email', from);
    const route = platform.slice(from, to);
    expect(route).toContain("(req.method === 'GET' ? 'admin_read' : 'auth')");
    expect(route).toContain("corrAction === 'verify' || corrAction === 'qr'");
    expect(route).toContain('return await correspondence.handler(req, res)');
    expect(limiter).toMatch(/auth:\s*\{\s*limit:\s*10/);
    expect(limiter).toMatch(/admin_read:\s*\{\s*limit:\s*60/);
  });
});
