/**
 * Inject structured data (SoftwareApplication JSON-LD) into calculator pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOMAIN = process.env.DOMAIN || 'https://bonds-global.com';

const PATTERNS = [
  'calculators/**/*.html',
  'en/calculators/**/*.html',
];

const files = PATTERNS.flatMap((p) => {
  try {
    return fs.globSync(p, { cwd: ROOT, absolute: true });
  } catch {
    return [];
  }
}).filter((f) => !f.includes('node_modules') && !f.includes('.vercel') && !/(\\|\/)auth(\\|\/)/i.test(f));

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

function extractTag(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

function escapeJson(str) {
  return JSON.stringify(str).slice(1, -1);
}

let updated = 0;
let skipped = 0;

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
  if (/"@type"\s*:\s*"SoftwareApplication"/i.test(html)) {
    skipped++;
    continue;
  }

  const isEn = relPath.startsWith('en/');
  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
    extractTag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i) ||
    (isEn ? 'Financial calculator from Bonds Global.' : 'حاسبة مالية من بوندز.');
  const url = canonicalUrl(relPath);
  const name = title.split('|')[0].trim() || (isEn ? 'Bonds Calculator' : 'حاسبة بوندز');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    inLanguage: isEn ? 'en' : 'ar',
    provider: {
      '@type': 'Organization',
      name: 'Bonds Global',
      url: DOMAIN,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'SAR',
    },
  };

  const scriptTag = `\n  <script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>\n`;
  const idx = html.search(/<\/head>/i);
  if (idx === -1) {
    skipped++;
    continue;
  }
  html = html.slice(0, idx) + scriptTag + html.slice(idx);

  if (html !== original) {
    fs.writeFileSync(file, html, 'utf8');
    console.log(` ${relPath}`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nUpdated ${updated} file(s), skipped ${skipped} file(s).`);
