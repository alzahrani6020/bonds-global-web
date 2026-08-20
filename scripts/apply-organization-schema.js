/**
 * Inject Organization JSON-LD into all public HTML pages (once).
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

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Bonds Global',
  alternateName: 'بوندز BONDS للاستشارات المالية والإدارية',
  url: DOMAIN,
  logo: `${DOMAIN}/assets/bonds-logo-2026-v2.png`,
  sameAs: [
    'https://www.linkedin.com/company/bonds-global',
    'https://x.com/bonds_global',
    'https://instagram.com/bonds.global',
    'https://www.youtube.com/@bondsglobal',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+966-56-756-6616',
    contactType: 'customer service',
    availableLanguage: ['Arabic', 'English'],
  },
};

const scriptTag = `\n  <script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>\n`;

let updated = 0;
let skipped = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  if (/"@type"\s*:\s*"Organization"/i.test(html)) {
    skipped++;
    continue;
  }
  const idx = html.search(/<\/head>/i);
  if (idx === -1) {
    skipped++;
    continue;
  }
  const newHtml = html.slice(0, idx) + scriptTag + html.slice(idx);
  fs.writeFileSync(file, newHtml, 'utf8');
  console.log(` ${path.relative(ROOT, file)}`);
  updated++;
}

console.log(`\nUpdated ${updated} file(s), skipped ${skipped} file(s).`);
