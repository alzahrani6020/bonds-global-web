'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'letterhead.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'components/correspondence-workspace-ui.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'components/correspondence-workspace-ui.css'), 'utf8');
const core = fs.readFileSync(path.join(root, 'components/letterhead-correspondence.js'), 'utf8');

describe('Correspondence institutional UI integration', () => {
  test('preserves governed editor and loads layout assets only once', () => {
    expect(page.match(/components\/correspondence-workspace-ui\.css\?v=2/g)).toHaveLength(1);
    expect(page.match(/components\/correspondence-workspace-ui\.js\?v=3/g)).toHaveLength(1);
    expect(page).toContain('id="letterhead-toolbar"');
    expect(page).toContain('id="pages-container"');
    expect(page).toContain('/components/letterhead-correspondence.js?v=6');
  });

  test('only changes correspondence-mode presentation and reuses existing actions', () => {
    expect(script).toContain("get('workspace') !== 'correspondence'");
    expect(script).toContain("document.body.classList.add('bx-correspondence')");
    expect(script).toContain("editor.append(toolbar, documentArea)");
    expect(script).toContain('documentArea.append(pages)');
    ['corr-new','corr-save','corr-save-submit','corr-command-open','corr-command-search-btn','corr-details-toggle'].forEach(id => {
      expect(script).toContain("'" + id + "'");
      expect(core).toContain("'" + id + "'");
    });
    expect(script).not.toMatch(/\.from\(|fetch\(|\.insert\(|\.upsert\(|\.update\(/);
  });

  test('does not replace stored document content or fabricate message counts', () => {
    expect(script).not.toMatch(/innerHTML\s*=|localStorage\.|BG-2026-0148|3,123|2,846/);
    expect(styles).toContain('@media print');
    expect(styles).toContain('@media(max-width:780px)');
    expect(styles).toContain('.bx-document-area .sheet');
    expect(styles).toContain('.bx-editor #letterhead-toolbar .toolbar-row{display:flex');
    expect(styles).toContain('.bx-editor.bx-hide-tools #letterhead-toolbar .toolbar-row{display:none}');
    expect(script).toContain("action.style.display === 'none'");
    expect(script).toContain("activateExisting('corr-submit')");
    expect(script).toContain("window.toggleInbox");
  });
});
