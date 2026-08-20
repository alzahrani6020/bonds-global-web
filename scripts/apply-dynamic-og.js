/**
 * Apply dynamic OG image URLs to calculator/report and other public pages.
 * Replaces og:image / twitter:image with /api/og-image?title=...&description=...&lang=...
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOMAIN = process.env.DOMAIN || 'https://bonds-global.com';

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

function extractTag(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : '';
}

function ogImageUrl(title, description, lang) {
  const t = encodeURIComponent(title).replace(/%20/g, '+');
  const d = encodeURIComponent(description).replace(/%20/g, '+');
  return `${DOMAIN}/api/og-image?title=${t}&description=${d}&lang=${lang}`;
}

let updated = 0;
let skipped = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
  const isEn = relPath.startsWith('en/');
  const lang = isEn ? 'en' : 'ar';

  const titleTag = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
    extractTag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const ogTitle = extractTag(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i) || titleTag || (isEn ? 'Bonds Global' : 'بوندز');
  const ogDesc = extractTag(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i) || description || (isEn ? 'Specialized financial calculators and economic consulting from Bonds.' : 'حاسبات مالية متخصصة واستشارات اقتصادية من بوندز.');

  const imageUrl = ogImageUrl(ogTitle, ogDesc, lang);

  // Replace existing og:image / twitter:image
  html = html.replace(/<meta[^>]+property=["']og:image["'][^>]*>/gi, `<meta property="og:image" content="${imageUrl}" />`);
  html = html.replace(/<meta[^>]+name=["']twitter:image["'][^>]*>/gi, `<meta name="twitter:image" content="${imageUrl}" />`);

  // Also add og:image:alt if missing
  if (!/<meta[^>]+property=["']og:image:alt["']/i.test(html)) {
    html = html.replace(/<meta[^>]+property=["']og:image["'][^>]*>/i, (match) => `${match}\n  <meta property="og:image:alt" content="${ogTitle.replace(/"/g, '&quot;')}" />`);
  }

  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    console.log(` ${relPath}`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nUpdated ${updated} file(s), skipped ${skipped} file(s).`);
