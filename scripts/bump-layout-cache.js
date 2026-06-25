const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED = ['node_modules', '.vercel', '.git', 'bonds-v2', 'v3'];

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

  // Add cache-buster to site-layout.js references that don't have one
  content = content.replace(
    /site-layout\.js(?!\?v=3)(\?v=[^"']*)?/g,
    (match, existing) => {
      siteLayoutRefs++;
      return 'site-layout.js?v=3';
    }
  );

  // Bump header-footer.css cache-buster to v=3
  content = content.replace(
    /header-footer\.css\?v=\d+/g,
    (match) => {
      headerFooterRefs++;
      return 'header-footer.css?v=3';
    }
  );

  // Also handle header-footer.css without version
  content = content.replace(
    /header-footer\.css(?!\?v=3)(?!\?v=\d)/g,
    (match) => {
      headerFooterRefs++;
      return 'header-footer.css?v=3';
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
