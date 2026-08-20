/**
 * Add <link rel="manifest" href="/manifest.json"> to all HTML files that don't have it.
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
  if (html.includes('rel="manifest"')) continue;

  // Insert after the first <link rel="icon"> or the opening <head>
  if (html.includes('<link rel="icon"')) {
    html = html.replace(/<link[^>]*rel=["']icon["'][^>]*>\n?/i, (m) => `${m}  <link rel="manifest" href="/manifest.json" />\n`);
  } else {
    html = html.replace(/<head>\n?/i, (m) => `${m}  <link rel="manifest" href="/manifest.json" />\n`);
  }

  fs.writeFileSync(file, html, 'utf8');
  console.log('✓', path.relative(ROOT, file));
  changed++;
}

console.log(`\nDone. Added manifest link to ${changed} files.`);
