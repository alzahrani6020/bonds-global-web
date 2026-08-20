/**
 * Apply canonical, Open Graph and Twitter Card tags to all public HTML pages.
 * Uses existing <title> and description when available, otherwise sensible defaults.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOMAIN = process.env.DOMAIN || 'https://bonds-global.com';
const DEFAULT_IMAGE = `${DOMAIN}/assets/bonds-logo-2026.webp`;

function ogImageUrl(title, description, lang) {
  const t = encodeURIComponent(title).replace(/%20/g, '+');
  const d = encodeURIComponent(description).replace(/%20/g, '+');
  return `${DOMAIN}/api/og-image?title=${t}&description=${d}&lang=${lang}`;
}
const DEFAULT_DESC = 'حاسبات مالية متخصصة واستشارات اقتصادية من بوندز.';
const DEFAULT_DESC_EN = 'Specialized financial calculators and economic consulting from Bonds.';

const PATTERNS = [
  '*.html',
  'en/**/*.html',
  'blog/**/*.html',
  'calculators/**/*.html',
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

function canonicalUrl(relPath) {
  // Normalize backslashes
  let p = relPath.replace(/\\/g, '/');
  // Remove leading slash if present
  p = p.replace(/^\//, '');
  if (p === 'index.html') return `${DOMAIN}/`;
  if (p.endsWith('/index.html')) {
    p = p.slice(0, -'index.html'.length);
  } else if (p.endsWith('.html')) {
    p = p.slice(0, -'.html'.length);
  }
  if (!p.startsWith('/')) p = '/' + p;
  return `${DOMAIN}${p}`;
}

function extractTag(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : '';
}

function insertBeforeCloseHead(html, snippet) {
  const idx = html.search(/<\/head>/i);
  if (idx === -1) return html;
  return html.slice(0, idx) + snippet + '\n' + html.slice(idx);
}

function hasTag(html, regex) {
  return regex.test(html);
}

let updated = 0;
let skipped = 0;

for (const file of files) {
  const originalHtml = fs.readFileSync(file, 'utf8');
  let html = originalHtml;
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
  const isEn = relPath.startsWith('en/');
  const url = canonicalUrl(relPath);

  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || extractTag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);

  const ogTitle = title || (isEn ? 'Bonds Global' : 'بوندز');
  const ogDesc = description || (isEn ? DEFAULT_DESC_EN : DEFAULT_DESC);

  // Normalize canonical and og:url to match the file path
  html = html.replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, `<link rel="canonical" href="${url}" />`);
  html = html.replace(/<meta[^>]+property=["']og:url["'][^>]*>/gi, `<meta property="og:url" content="${url}" />`);

  let tagsToAdd = '';

  if (!hasTag(html, /<meta[^>]+name=["']description["']/i)) {
    tagsToAdd += `  <meta name="description" content="${ogDesc}" />\n`;
  }

  if (!hasTag(html, /<link[^>]+rel=["']canonical["']/i)) {
    tagsToAdd += `  <link rel="canonical" href="${url}" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+property=["']og:title["']/i)) {
    tagsToAdd += `  <meta property="og:title" content="${ogTitle}" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+property=["']og:description["']/i)) {
    tagsToAdd += `  <meta property="og:description" content="${ogDesc}" />\n`;
  }
  const dynamicImage = ogImageUrl(ogTitle, ogDesc, isEn ? 'en' : 'ar');
  if (!hasTag(html, /<meta[^>]+property=["']og:image["']/i)) {
    tagsToAdd += `  <meta property="og:image" content="${dynamicImage}" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+property=["']og:image:alt["']/i)) {
    tagsToAdd += `  <meta property="og:image:alt" content="${ogTitle}" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+property=["']og:url["']/i)) {
    tagsToAdd += `  <meta property="og:url" content="${url}" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+property=["']og:type["']/i)) {
    tagsToAdd += `  <meta property="og:type" content="website" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+name=["']twitter:card["']/i)) {
    tagsToAdd += `  <meta name="twitter:card" content="summary_large_image" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+name=["']twitter:title["']/i)) {
    tagsToAdd += `  <meta name="twitter:title" content="${ogTitle}" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+name=["']twitter:description["']/i)) {
    tagsToAdd += `  <meta name="twitter:description" content="${ogDesc}" />\n`;
  }
  if (!hasTag(html, /<meta[^>]+name=["']twitter:image["']/i)) {
    tagsToAdd += `  <meta name="twitter:image" content="${dynamicImage}" />\n`;
  }

  if (tagsToAdd) {
    html = insertBeforeCloseHead(html, tagsToAdd);
  }

  if (html !== originalHtml) {
    fs.writeFileSync(file, html, 'utf8');
    console.log(` ${relPath}`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nUpdated ${updated} file(s), skipped ${skipped} file(s).`);
