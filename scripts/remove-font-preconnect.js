/**
 * Remove Google Fonts preconnect links now that fonts are self-hosted.
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

let changed = 0;

for (const file of walk(ROOT, '.html')) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  html = html.replace(/\s*<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/fonts\.googleapis\.com["'][^>]*>\n?/gi, '');
  html = html.replace(/\s*<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/fonts\.gstatic\.com["'][^>]*>\n?/gi, '');
  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('✓', path.relative(ROOT, file));
    changed++;
  }
}

console.log(`\nDone. Removed preconnect from ${changed} files.`);
