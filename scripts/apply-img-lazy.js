/**
 * Add loading="lazy" decoding="async" to <img> tags that don't already have
 * loading/fetchpriority and are not likely above-the-fold (logo/hero/watermark).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

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

function shouldSkipLazy(attrs) {
  const lower = attrs.toLowerCase();
  if (lower.includes('loading=') || lower.includes('fetchpriority=')) return true;
  if (/\b(class|src|alt)=["'][^"]*(?:logo|hero|watermark|cover-logo)[^"]*["']/i.test(attrs)) return true;
  return false;
}

let changedFiles = 0;
let changedTags = 0;

for (const file of walk(ROOT, '.html')) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  html = html.replace(/<img\b([^>]+)>/gi, (match, attrs) => {
    if (shouldSkipLazy(attrs)) return match;
    // Add loading and decoding before the closing >
    const add = ' loading="lazy" decoding="async"';
    return `<img${attrs}${add}>`;
  });

  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('✓', path.relative(ROOT, file));
    changedFiles++;
  }
}

console.log(`\nDone. Modified ${changedFiles} files.`);
