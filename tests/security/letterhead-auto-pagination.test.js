'use strict';

// Contract tests for the automatic letterhead pagination feature:
// overflowing content must be distributed onto numbered A4 sheets so the
// final-PDF guard never blocks on manual page splitting.

const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
}

describe('letterhead automatic pagination', () => {
  const client = read('components/letterhead-correspondence.js');

  test('manual command and paste share the footer-aware governed A4 paginator', () => {
    const manual = client.slice(client.indexOf('window.autoDistributePages = function () {'),
      client.indexOf('  // Server-backed save/autosave.'));
    const paste = client.slice(client.indexOf("document.addEventListener('paste'"),
      client.indexOf("document.addEventListener('input'"));
    expect(manual).toContain('paginateEditableSheets()');
    expect(paste).toContain('paginateEditableSheets()');
    expect(client).toContain("sheet.querySelector('.letterhead-footer')");
    expect(client).toContain('footer.getBoundingClientRect().top - 4');
    expect(client).toContain('contentBottom <= footerTop');
  });

  test('preserves all pasted text while creating numbered continuation sheets', () => {
    expect(client).toContain("container.appendChild(clone)");
    expect(client).toContain("splitOversizedDraftParagraph(tail, continuation)");
    expect(client).toContain("continuation.insertBefore(item, continuation.firstChild)");
    expect(client).toContain("const count = sheets().length");
    expect(client).toContain("الصفحة ${index + 1} من ${count}");
  });

  test('records undo history and autosaves after distributing', () => {
    expect(client).toContain('recordMutation(before)');
    expect(client).toContain('window.autoSave?.()');
  });

  test('both locales wire the toolbar button to the feature', () => {
    expect(read('letterhead.html')).toContain('onclick="autoDistributePages()"');
    expect(read('en/letterhead.html')).toContain('onclick="autoDistributePages()"');
  });

  test('guards against runaway growth with a page cap and edit permission', () => {
    expect(client).toContain('sheets().length > 50');
    expect(client).toContain('prepareEditableAction()');
    expect(client).toContain('++moves > 500');
  });

  test('the PDF export auto-heals: locked docs fail explicitly, overflow re-paginates once', () => {
    expect(client).toContain('cannot be split automatically');
    expect(client).toContain('retriedAfterPagination');
    expect(client).toContain('paginateEditableSheets();');
    expect(client).toContain('sheets.push(...document.querySelectorAll(\'.sheet\'))');
  });
});
