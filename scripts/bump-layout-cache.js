const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED = ['node_modules', '.vercel', '.git', 'bonds-v2', 'v3'];
const VERSION = '4';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED.includes(entry.name)) continue;
      files = files.concat(walk(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const files = walk(ROOT);
let changed = 0;
let siteLayoutRefs = 0;
let headerFooterRefs = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(
    /site-layout\.js\?v=\d+/g,
    () => {
      siteLayoutRefs++;
      return `site-layout.js?v=${VERSION}`;
    }
  );

  content = content.replace(
    /header-footer\.css\?v=\d+/g,
    () => {
      headerFooterRefs++;
      return `header-footer.css?v=${VERSION}`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
  }
}

console.log(`Files changed: ${changed}`);
console.log(`site-layout.js refs bumped: ${siteLayoutRefs}`);
console.log(`header-footer.css refs bumped: ${headerFooterRefs}`);
console.log(`Total HTML files scanned: ${files.length}`);
