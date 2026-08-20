/**
 * Generate static search index from public HTML pages.
 * Outputs assets/search-index.json and assets/search-index-en.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_AR = path.join(ROOT, 'assets', 'search-index.json');
const OUT_EN = path.join(ROOT, 'assets', 'search-index-en.json');

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
  if (p === 'index.html') return '/';
  if (p.endsWith('/index.html')) {
    p = p.slice(0, -'index.html'.length);
  } else if (p.endsWith('.html')) {
    p = p.slice(0, -'.html'.length);
  }
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

function extractTag(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

function categoryFromPath(relPath, isEn) {
  const p = relPath.replace(/\\/g, '/');
  if (p.startsWith('en/')) return isEn ? 'English' : 'الإنجليزية';
  if (p.startsWith('calculators/') || p.includes('/calculators/')) return isEn ? 'Calculators' : 'الحاسبات';
  if (p.startsWith('reports/') || p.includes('/reports/')) return isEn ? 'Reports' : 'التقارير';
  if (p.startsWith('blog/') || p.includes('/blog/')) return isEn ? 'Insights' : 'المقالات';
  if (p.startsWith('sectors/') || p.includes('/sectors/')) return isEn ? 'Sectors' : 'القطاعات';
  if (p.startsWith('v3/') || p.includes('/v3/')) return isEn ? 'Intelligence' : 'الذكاء الاقتصادي';
  return isEn ? 'Pages' : 'الصفحات';
}

const entries = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
  if (relPath.includes('/auth/') || relPath.includes('/admin/') || relPath.includes('/client/')) continue;
  const isEn = relPath.startsWith('en/');
  const lang = isEn ? 'en' : 'ar';

  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
    extractTag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);

  if (!title && !description) continue;

  entries.push({
    title: title || (isEn ? 'Bonds Global' : 'بوندز'),
    description: description || '',
    url: canonicalUrl(relPath),
    lang,
    category: categoryFromPath(relPath, isEn),
  });
}

const arEntries = entries.filter((e) => e.lang === 'ar');
const enEntries = entries.filter((e) => e.lang === 'en');

fs.writeFileSync(OUT_AR, JSON.stringify({ version: Date.now(), count: arEntries.length, entries: arEntries }, null, 2), 'utf8');
fs.writeFileSync(OUT_EN, JSON.stringify({ version: Date.now(), count: enEntries.length, entries: enEntries }, null, 2), 'utf8');

console.log(`Generated search index: ${arEntries.length} AR, ${enEntries.length} EN entries.`);
