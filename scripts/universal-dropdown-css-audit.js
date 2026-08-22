/**
 * Universal Dropdown CSS audit: scans all HTML pages for any that load
 * universal-dropdown.js but not universal-dropdown.css. Exits non-zero if any.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const excludes = ['node_modules', '.git', '.vercel', 'tmp-crawler', 'tmp'];

function discoverHtmlFiles(dir) {
  const pages = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (excludes.includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        pages.push(full);
      }
    }
  }
  walk(dir);
  return pages;
}

const failures = [];
const pages = discoverHtmlFiles(PROJECT_ROOT);
for (const full of pages) {
  const text = fs.readFileSync(full, 'utf-8');
  const hasJs = /universal-dropdown\.js/.test(text);
  const hasCss = /universal-dropdown\.css/.test(text);
  if (hasJs && !hasCss) {
    const rel = path.relative(PROJECT_ROOT, full).replace(/\\/g, '/');
    failures.push(rel);
  }
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} page(s) load universal-dropdown.js without universal-dropdown.css:`);
  for (const f of failures) console.error('  -', f);
  process.exit(1);
}
console.log(`PASS: all ${pages.length} HTML pages that load universal-dropdown.js also load universal-dropdown.css.`);
