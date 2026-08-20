/**
 * Archive large image files (>100KB) that are not referenced in HTML/CSS/JS/JSON.
 * Excludes test assets and hidden directories.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE = path.join(ROOT, '.archive');

const EXCLUDED_DIRS = ['node_modules', '.git', '.vercel', '.archive', 'tests', '.tmp-pdf'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'];
const REF_EXTS = ['.html', '.css', '.js', '.json'];

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      walk(full, exts, files);
    } else if (entry.isFile() && exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

const images = walk(ROOT, IMAGE_EXTS);
const referenced = new Set();

for (const file of walk(ROOT, REF_EXTS)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const img of images) {
    if (content.includes(path.basename(img))) referenced.add(img);
  }
}

let saved = 0;
let moved = 0;

for (const img of images) {
  const size = fs.statSync(img).size;
  if (size < 100000) continue;
  if (referenced.has(img)) continue;

  const rel = path.relative(ROOT, img).replace(/\\/g, '/');
  const dest = path.join(ARCHIVE, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(img, dest);
  console.log('ARCHIVED', (size / 1024).toFixed(1) + 'KB', rel);
  saved += size;
  moved++;
}

console.log(`\nTotal archived: ${moved} files, ${(saved / 1024 / 1024).toFixed(2)} MB`);
