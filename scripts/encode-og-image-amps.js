/**
 * Encode raw & separators in og:image / twitter:image URLs as &amp; for valid HTML.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PATTERNS = [
  '*.html',
  'en/**/*.html',
  'blog/**/*.html',
  'calculators/**/*.html',
  'reports/**/*.html',
  'sectors/**/*.html',
  'v3/**/*.html',
  'wave4/**/*.html',
];

const files = PATTERNS.flatMap((p) => {
  try {
    return fs.globSync(p, { cwd: ROOT, absolute: true });
  } catch {
    return [];
  }
}).filter((f) => !f.includes('node_modules') && !f.includes('.vercel'));

let updated = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  // Encode unencoded ampersands in og:image and twitter:image content attributes
  html = html.replace(/<meta\s+(?:property=["']og:image["']|name=["']twitter:image["'])\s+content=["']([^"']*)["']/gi, function (match, url) {
    const encoded = url.replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;');
    return match.replace(url, encoded);
  });
  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    console.log('encoded', path.relative(ROOT, file));
    updated++;
  }
}

console.log(`\nEncoded ${updated} file(s).`);
