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

  test('component exposes autoDistributePages with footer-based cutoff geometry', () => {
    expect(client).toContain('window.autoDistributePages = function ()');
    expect(client).toContain("sheet.querySelector('.doc-content')");
    expect(client).toContain("sheet.querySelector('.letterhead-footer')");
    expect(client).toContain('footer.getBoundingClientRect().top - bufferPx');
    expect(client).toContain('content.getBoundingClientRect().bottom > cutoff');
  });

  test('moves whole overflowing blocks in order and creates numbered sheets', () => {
    expect(client).toContain('children.findIndex(el => el.getBoundingClientRect().bottom > cutoff)');
    expect(client).toContain('moving.forEach(el => targetContent.insertBefore(el, anchor))');
    expect(client).toContain('cloneEmptySheetAfter(sheet)');
    expect(client).toContain('renumberSheets()');
    expect(client).toContain('الصفحة ${i + 1} من ${sheets.length}');
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
    expect(client).toContain('MAX_SHEETS = 20');
    expect(client).toContain('prepareEditableAction()');
    expect(client).toContain('guard < 200');
  });

  test('PDF export paginates drafts before capture and rejects invalid issued sheets', () => {
    expect(client).toContain('cannot be split automatically');
    expect(client).toContain('if (canEditCurrent()) paginateEditableSheets();');
    expect(client).toContain('rebalanceIssuedClone(copy)');
    expect(client).toContain('html2canvas(container,');
    expect(client).toContain("err.code = 'BONDS_PDF_A4_CLIPPED'");
    expect(client).toContain("err.code = 'BONDS_PDF_A4_CAPTURE_BOUNDS'");
  });
});
