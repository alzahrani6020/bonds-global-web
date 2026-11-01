#!/usr/bin/env node
/**
 * Keeps the assistant widget cache-busting query string in lock-step with the
 * widget's actual content.
 *
 * The widget is served with a multi-hour Cache-Control, so a stale `?v=` tag
 * means users keep running an old widget against a newer API. The tag is
 * derived from the SHA-256 of the file (CRLF-normalised so Windows and CI agree).
 *
 *   node scripts/stamp-assistant-widget-version.js          # rewrite references
 *   node scripts/stamp-assistant-widget-version.js --check  # exit 1 if stale
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WIDGET = 'v3/components/ai-chat-widget.js';
const TAG_PREFIX = 'global-assistant-';

const REFERENCES = [
  'site-layout.js',
  'v3/city-intelligence.html',
  'v3/investment-map.html',
  'v3/project/index.html',
  'en/v3/project/index.html'
];

// Only `src="..."` / `script.src = '...'` values; never selectors such as [src*="..."].
const REFERENCE_PATTERN = /(\bsrc\s*=\s*["'])(\/v3\/components\/ai-chat-widget\.js)(\?v=[A-Za-z0-9._-]+)?(?=["'])/g;

function widgetTag(root = ROOT) {
  const source = fs.readFileSync(path.join(root, WIDGET), 'utf8').replace(/\r\n/g, '\n');
  const digest = crypto.createHash('sha256').update(source).digest('hex');
  return `${TAG_PREFIX}${digest.slice(0, 10)}`;
}

function stampContent(content, tag) {
  return content.replace(REFERENCE_PATTERN, (_match, prefix, widgetPath) => `${prefix}${widgetPath}?v=${tag}`);
}

function staleReferences(root = ROOT) {
  const tag = widgetTag(root);
  const stale = [];
  for (const relative of REFERENCES) {
    const content = fs.readFileSync(path.join(root, relative), 'utf8');
    if (!REFERENCE_PATTERN.test(content)) {
      REFERENCE_PATTERN.lastIndex = 0;
      stale.push({ file: relative, reason: 'missing-reference' });
      continue;
    }
    REFERENCE_PATTERN.lastIndex = 0;
    if (stampContent(content, tag) !== content) stale.push({ file: relative, reason: 'stale-tag' });
  }
  return { tag, stale };
}

function main() {
  const check = process.argv.includes('--check');
  const { tag, stale } = staleReferences();

  if (check) {
    if (stale.length) {
      console.error(`Assistant widget version is stale (expected ?v=${tag}):`);
      for (const item of stale) console.error(`  - ${item.file} (${item.reason})`);
      console.error('Run: node scripts/stamp-assistant-widget-version.js');
      process.exit(1);
    }
    console.log(`Assistant widget version OK (?v=${tag}).`);
    return;
  }

  for (const item of stale) {
    if (item.reason === 'missing-reference') {
      console.error(`Missing widget reference in ${item.file}`);
      process.exit(1);
    }
    const target = path.join(ROOT, item.file);
    fs.writeFileSync(target, stampContent(fs.readFileSync(target, 'utf8'), tag));
    console.log(`Stamped ${item.file} -> ?v=${tag}`);
  }
  if (!stale.length) console.log(`Already up to date (?v=${tag}).`);
}

if (require.main === module) main();

module.exports = { widgetTag, stampContent, staleReferences, REFERENCES, WIDGET };
