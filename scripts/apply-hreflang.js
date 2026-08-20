/**
 * Inject hreflang alternate link tags for Arabic/English mirrored pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
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

function canonicalUrl(relPath) {
  let p = relPath.replace(/\\/g, '/').replace(/^\//, '');
  if (p === 'index.html') return `${DOMAIN}/`;
  if (p.endsWith('/index.html')) {
    p = p.slice(0, -'index.html'.length);
  } else if (p.endsWith('.html')) {
    p = p.slice(0, -'.html'.length);
  }
  if (!p.startsWith('/')) p = '/' + p;
  return `${DOMAIN}${p}`;
}

function urlPath(relPath) {
  return canonicalUrl(relPath).replace(DOMAIN, '');
}

function detectLang(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (p.startsWith('en/') || p.includes('/en/')) return 'en';
  return 'ar';
}

function counterpartRelPath(relPath) {
  const p = relPath.replace(/\\/g, '/');
  const parts = p.split('/');

  // Case: en/blog/foo.html? Not used. Blog English is blog/en/foo.html.
  // Case: blog/en/foo.html -> blog/foo.html
  if (parts.length >= 2 && parts[0] === 'blog' && parts[1] === 'en') {
    return ['blog'].concat(parts.slice(2)).join('/');
  }
  // Case: reports/en/foo.html -> reports/foo.html
  if (parts.length >= 2 && parts[0] === 'reports' && parts[1] === 'en') {
    return ['reports'].concat(parts.slice(2)).join('/');
  }
  // Case: en/foo.html -> foo.html
  if (parts[0] === 'en') {
    return parts.slice(1).join('/');
  }
  // Case: blog/foo.html -> blog/en/foo.html
  if (parts[0] === 'blog') {
    return ['blog', 'en'].concat(parts.slice(1)).join('/');
  }
  // Case: reports/foo.html -> reports/en/foo.html
  if (parts[0] === 'reports') {
    return ['reports', 'en'].concat(parts.slice(1)).join('/');
  }
  // Default: foo.html -> en/foo.html
  return ['en'].concat(parts).join('/');
}

const fileExists = new Set(files.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')));

let updated = 0;
let skipped = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');

  // Skip internal/admin/auth pages
  if (/(^|\/)auth(\/|$)/.test(relPath) || /(^|\/)admin(\/|$)/.test(relPath) || /(^|\/)client(\/|$)/.test(relPath) || /(^|\/)my-bonds(\/|$)/.test(relPath)) {
    skipped++;
    continue;
  }

  const lang = detectLang(relPath);
  const selfUrl = canonicalUrl(relPath);
  const counterRel = counterpartRelPath(relPath);
  const hasCounter = fileExists.has(counterRel);

  let tags = `  <link rel="alternate" hreflang="${lang}" href="${selfUrl}" />\n`;
  if (hasCounter) {
    const counterUrl = canonicalUrl(counterRel);
    const counterLang = lang === 'ar' ? 'en' : 'ar';
    tags += `  <link rel="alternate" hreflang="${counterLang}" href="${counterUrl}" />\n`;
  }

  // Remove existing hreflang link tags to avoid duplicates
  let newHtml = html.replace(/\s*<link\s+rel=["']alternate["']\s+hreflang=["'][^"']*["']\s+href=["'][^"']*["']\s*\/?>\s*/gi, '\n');

  // Insert before </head>
  const idx = newHtml.search(/<\/head>/i);
  if (idx === -1) {
    skipped++;
    continue;
  }
  newHtml = newHtml.slice(0, idx) + '\n' + tags + newHtml.slice(idx);

  if (newHtml !== html) {
    fs.writeFileSync(file, newHtml, 'utf8');
    console.log(` ${relPath}`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nUpdated ${updated} file(s), skipped ${skipped} file(s).`);
