const fs = require('fs');
const path = require('path');
const {
  widgetTag,
  stampContent,
  staleReferences,
  REFERENCES
} = require('../../scripts/stamp-assistant-widget-version');

const ROOT = path.join(__dirname, '..', '..');

describe('assistant widget cache-busting version', () => {
  test('every widget reference carries the tag derived from the widget content', () => {
    const { tag, stale } = staleReferences(ROOT);
    // Failing here means ai-chat-widget.js changed without restamping.
    // Fix: node scripts/stamp-assistant-widget-version.js
    expect(stale).toEqual([]);
    expect(tag).toMatch(/^global-assistant-[0-9a-f]{10}$/);
  });

  test('the tag changes whenever the widget content changes', () => {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'widget-tag-'));
    fs.mkdirSync(path.join(tmp, 'v3', 'components'), { recursive: true });
    const file = path.join(tmp, 'v3', 'components', 'ai-chat-widget.js');
    fs.writeFileSync(file, 'console.log(1);\n');
    const first = widgetTag(tmp);
    fs.writeFileSync(file, 'console.log(2);\n');
    expect(widgetTag(tmp)).not.toBe(first);
  });

  test('the tag is stable across CRLF and LF checkouts', () => {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'widget-eol-'));
    fs.mkdirSync(path.join(tmp, 'v3', 'components'), { recursive: true });
    const file = path.join(tmp, 'v3', 'components', 'ai-chat-widget.js');
    fs.writeFileSync(file, 'a\nb\n');
    const lf = widgetTag(tmp);
    fs.writeFileSync(file, 'a\r\nb\r\n');
    expect(widgetTag(tmp)).toBe(lf);
  });

  test('stamping rewrites src values but never CSS-style selectors', () => {
    const input = [
      `document.querySelector('script[src*="/v3/components/ai-chat-widget.js"]');`,
      `script.src = '/v3/components/ai-chat-widget.js?v=old';`,
      `<script src="/v3/components/ai-chat-widget.js"></script>`
    ].join('\n');
    const output = stampContent(input, 'global-assistant-abc');
    expect(output).toContain(`script[src*="/v3/components/ai-chat-widget.js"]`);
    expect(output).toContain(`script.src = '/v3/components/ai-chat-widget.js?v=global-assistant-abc';`);
    expect(output).toContain(`<script src="/v3/components/ai-chat-widget.js?v=global-assistant-abc">`);
  });

  test('all known pages that load the widget are covered by the stamper', () => {
    const html = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', '.vercel', 'tests'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.html') && fs.readFileSync(full, 'utf8').includes('/v3/components/ai-chat-widget.js')) {
          html.push(path.relative(ROOT, full).replace(/\\/g, '/'));
        }
      }
    })(ROOT);
    for (const page of html) expect(REFERENCES).toContain(page);
  });
});