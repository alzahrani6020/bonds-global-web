'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../components/letterhead-correspondence.js'), 'utf8');

describe('new correspondence issuance A4 and final PDF', () => {
  test('reserves A4 space on editable drafts before submission without persisting placeholders', () => {
    expect(source).toContain("if (target === 'submitted') await prepareDraftA4ForIssuance()");
    const begin = source.indexOf('async function prepareDraftA4ForIssuance()');
    const end = source.indexOf('async function transition(', begin);
    expect(begin).toBeGreaterThan(-1);
    const preflight = source.slice(begin, end);
    expect(preflight).toContain("if (document.fonts?.ready) await document.fonts.ready");
    expect(preflight).toContain("paginateEditableSheets()");
    expect(preflight).toContain("container.querySelectorAll('[data-a4-reservation]').forEach(el => el.remove())");
    expect(preflight.indexOf("await saveVersion(true)")).toBeGreaterThan(preflight.indexOf("el => el.remove()"));
    expect(preflight).not.toContain("api('transition'");
  });

  test('issuance and finalizer permissions remain separate', () => {
    const transition = source.slice(source.indexOf('async function transition('), source.indexOf('async function mark('));
    expect(transition).not.toContain('await persistIssuedPdfArtifact()');
    expect(source).toContain("can('finalize_pdf')");
    expect(source).toContain("if (state.document.artifact_hash) return");
    expect(source).toContain("visible.add('corr-finalize-pdf')");
  });

  test('download actual official PDF twice with different object URLs and deferred cleanup', async () => {
    const start = source.indexOf('async function downloadOfficialPdf()');
    const stop = source.indexOf('async function refreshInboxDynamic(', start);
    expect(start).toBeGreaterThan(-1);
    const events = [];
    let n = 0;
    const state = { document: { id: 'new-doc-only', artifact_hash: 'immutable', reference_number: 'TEST-NEW' } };
    const api = jest.fn(async () => ({ signed_url: 'https://storage.example/short-lived' }));
    const fetch = jest.fn(async () => ({ ok: true, blob: async () => ({ size: 2048, type: 'application/pdf' }) }));
    const URL = {
      createObjectURL() { return 'blob:test-' + ++n; },
      revokeObjectURL(url) { events.push(['revoke', url]); }
    };
    const document = {
      body: { appendChild(a) { events.push(['append', a.href]); } },
      createElement() { return { href: '', download: '', rel: '', click() { events.push(['click', this.href]); }, remove() {} }; }
    };
    const window = { setTimeout(fn, delay) { expect(delay).toBe(60000); events.push(['timer', delay]); } };
    const fn = new Function('state','api','fetch','URL','document','window','isEn',
      source.slice(start, stop) + '\nreturn downloadOfficialPdf;');
    const download = fn(state, api, fetch, URL, document, window, false);
    await download();
    await download();
    expect(events.filter(e => e[0] === 'click')).toEqual([
      ['click', 'blob:test-1'], ['click', 'blob:test-2']
    ]);
    expect(events.filter(e => e[0] === 'revoke')).toHaveLength(0);
    expect(api).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('fails closed on invalid official storage response', async () => {
    const start = source.indexOf('async function downloadOfficialPdf()');
    const stop = source.indexOf('async function refreshInboxDynamic(', start);
    const fn = new Function('state','api','fetch','URL','document','window','isEn',
      source.slice(start, stop) + '\nreturn downloadOfficialPdf;');
    const download = fn({ document: { id: 'new-doc', artifact_hash: 'x' } },
      async () => ({ signed_url: 'https://storage.example/file' }),
      async () => ({ ok: true, blob: async () => ({ size: 10, type: 'text/html' }) }),
      { createObjectURL: jest.fn() }, { createElement: jest.fn() }, {}, false);
    await expect(download()).rejects.toThrow(/invalid|غير صالحة/);
  });
});
