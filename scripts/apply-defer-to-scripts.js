/**
 * Add `defer` to known non-critical external scripts across all HTML files.
 * Does not modify inline scripts or scripts that already have defer/async.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCRIPT_PATTERNS = [
  /social-feed\.js/,
  /page-tracker-v2\.js/,
  /shared-enhancements\.js/,
  /ecc-icons\.js/,
  /emoji-icons\.js/,
  /emoji-renderer\.js/,
  /auth-gate\.js/,
  /global-auth-gate\.js/,
  /site-layout\.js/,
];

function shouldDefer(src) {
  return SCRIPT_PATTERNS.some((re) => re.test(src));
}

function walk(dir, ext, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vercel') continue;
      walk(full, ext, files);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

let changedFiles = 0;
let changedTags = 0;

for (const file of walk(ROOT, '.html')) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  html = html.replace(
    /<script\b([^>]*)\bsrc="([^"]*)"([^>]*)>/gi,
    (match, before, src, after) => {
      const fullAttrs = (before + ' ' + after).toLowerCase();
      if (fullAttrs.includes('defer') || fullAttrs.includes('async')) return match;
      if (!shouldDefer(src)) return match;
      // Insert defer before src to keep src intact
      const replacement = `<script${before}defer src="${src}"${after}>`;
      changedTags++;
      return replacement;
    }
  );

  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('✓', path.relative(ROOT, file));
    changedFiles++;
  }
}

console.log(`\nDone. Modified ${changedFiles} files, ${changedTags} script tags.`);
