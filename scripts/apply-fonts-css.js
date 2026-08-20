/**
 * Replace per-page Google Fonts links with a shared fonts-<lang>.css link.
 * Removes duplicate Vazirmatn/Inter requests and works with the new styles.css (no @import).
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

function relativePrefix(filePath) {
  const rel = path.relative(ROOT, filePath);
  const depth = rel.split(path.sep).length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function detectLang(html) {
  const match = html.match(/<html[^>]*\blang=["']([^"']+)["'][^>]*>/i);
  const lang = match ? match[1].toLowerCase() : 'ar';
  return lang.startsWith('en') ? 'en' : 'ar';
}

const PRECONNECT_BLOCK = `  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
`;

let changedFiles = 0;

for (const file of walk(ROOT, '.html')) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  // Only touch pages that load styles.css
  const stylesMatch = html.match(/<link[^>]*\bhref=["']([^"']*styles\.css[^"']*)["'][^>]*>/i);
  if (!stylesMatch) continue;

  const lang = detectLang(html);
  const prefix = relativePrefix(file);
  const fontsHref = `${prefix}styles/fonts-${lang}.css`;

  // Remove existing per-page Google Fonts links
  html = html.replace(/<link[^>]*\bhref=["']https:\/\/fonts\.googleapis\.com\/[^"']*["'][^>]*>\n?/gi, '');

  // Remove any previously added fonts-<lang>.css link to keep idempotent
  html = html.replace(new RegExp(`<link[^>]*\\bhref=["'][^"']*styles/fonts-(${lang}|ar|en)\\.css[^"']*["'][^>]*>\\n?`, 'gi'), '');

  // Ensure preconnect exists
  if (!html.includes('fonts.googleapis.com') || !html.includes('fonts.gstatic.com')) {
    html = html.replace(/<head>\n?/i, (m) => `${m}${PRECONNECT_BLOCK}`);
  }

  // Insert fonts link before styles.css
  html = html.replace(
    /<link([^>]*)\bhref=["']([^"]*styles\.css[^"]*)["']([^>]*)>/i,
    `<link rel="stylesheet" href="${fontsHref}">\n  <link$1href="$2"$3>`
  );

  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('✓', path.relative(ROOT, file), `→ fonts-${lang}.css`);
    changedFiles++;
  }
}

console.log(`\nDone. Modified ${changedFiles} files.`);
