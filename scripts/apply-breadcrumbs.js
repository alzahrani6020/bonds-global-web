/**
 * Add breadcrumb navigation (HTML + JSON-LD) to calculator and report pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SECTIONS = [
  { dir: 'calculators', parent: '/calculator.html' },
  { dir: 'calculators/investment-center', parent: '/calculators/investment-center/index.html' },
  { dir: 'calculators/auth', parent: '/calculators/auth/index.html' },
  { dir: 'reports', parent: '/reports/index.html' },
  { dir: 'en/calculators', parent: '/en/calculator.html' },
  { dir: 'en/calculators/investment-center', parent: '/en/calculators/investment-center/index.html' },
  { dir: 'en/calculators/auth', parent: '/en/calculators/auth/index.html' },
  { dir: 'en/reports', parent: '/en/reports/index.html' },
];

const LABELS = {
  ar: {
    home: 'الرئيسية',
    calculators: 'الحاسبات',
    'investment-center': 'مركز الاستثمار',
    auth: 'حسابي',
    reports: 'التقارير',
  },
  en: {
    home: 'Home',
    calculators: 'Calculators',
    'investment-center': 'Investment Center',
    auth: 'Account',
    reports: 'Reports',
  },
};

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vercel' || entry.name === '.archive') continue;
      walk(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

function detectLang(html) {
  const match = html.match(/<html[^>]*\blang=["']([^"']+)["'][^>]*>/i);
  const lang = match ? match[1].toLowerCase() : 'ar';
  return lang.startsWith('en') ? 'en' : 'ar';
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!match) return '';
  return match[1].split(/\s*\|\s*/)[0].trim();
}

function getMeaningfulSegments(sectionDir) {
  const parts = sectionDir.split('/');
  if (parts[0] === 'en') parts.shift();
  return parts;
}

function buildBreadcrumb(lang, sectionDir, pageName, parentUrl) {
  const labels = LABELS[lang];
  const isEn = lang === 'en';
  const segments = getMeaningfulSegments(sectionDir);

  const items = [];

  // Home
  items.push({ name: labels.home, url: isEn ? '/en/' : '/' });

  // Top section
  const topKey = segments[0];
  const topLabel = labels[topKey] || topKey;
  const topUrl = isEn ? `/en/${topKey === 'calculators' ? 'calculator.html' : `${topKey}/index.html`}` : (topKey === 'calculators' ? '/calculator.html' : `/${topKey}/index.html`);
  items.push({ name: topLabel, url: topUrl });

  // Sub-section (investment-center / auth)
  if (segments.length > 1) {
    const sub = segments[1];
    const subLabel = labels[sub] || sub;
    const subUrl = isEn ? `/en/${segments[0]}/${sub}/index.html` : `/${segments[0]}/${sub}/index.html`;
    items.push({ name: subLabel, url: subUrl });
  }

  // Current page (no link)
  items.push({ name: pageName, url: null });

  return items;
}

function renderHtmlBreadcrumb(items, isEn) {
  const list = items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    if (isLast) {
      return `<li class="breadcrumbs__item breadcrumbs__item--current" aria-current="page">${item.name}</li>`;
    }
    return `<li class="breadcrumbs__item"><a class="breadcrumbs__link" href="${item.url}">${item.name}</a></li>`;
  }).join('<li class="breadcrumbs__sep" aria-hidden="true">' + (isEn ? '>' : '<') + '</li>');

  return `<nav aria-label="${isEn ? 'Breadcrumb' : 'مسار التنقل'}" class="breadcrumbs">\n  <ol class="breadcrumbs__list">\n    ${list}\n  </ol>\n</nav>`;
}

function renderJsonLd(items, pageUrl) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url ? `https://bonds-global.com${item.url}` : pageUrl,
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

function removeExistingBreadcrumbs(html) {
  // Remove breadcrumb HTML block
  html = html.replace(/\s*<nav aria-label=["'][^"']*Breadcrumb[^"']*["'][^>]*class=["']breadcrumbs["'][^>]*>[\s\S]*?<\/nav>\n?/i, '');
  // Remove JSON-LD BreadcrumbList
  html = html.replace(/\s*<script type=["']application\/ld\+json["']>[\s\S]*?"@type":\s*"BreadcrumbList"[\s\S]*?<\/script>\n?/i, '');
  return html;
}

let changedFiles = 0;

for (const section of SECTIONS) {
  const dir = path.join(ROOT, section.dir);
  if (!fs.existsSync(dir)) continue;

  for (const file of walk(dir)) {
    if (path.basename(file) === 'index.html') continue;

    let html = fs.readFileSync(file, 'utf8');
    html = removeExistingBreadcrumbs(html);

    const lang = detectLang(html);
    const isEn = lang === 'en';
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const pageUrl = `https://bonds-global.com/${rel}`;
    const pageName = extractTitle(html) || path.basename(file, '.html');

    const items = buildBreadcrumb(lang, section.dir, pageName, section.parent);
    const breadcrumbHtml = renderHtmlBreadcrumb(items, isEn);

    // Insert breadcrumb HTML after site-header div
    html = html.replace(
      /<div id=["']site-header["']><\/div>\n?/i,
      (m) => `${m}\n${breadcrumbHtml}\n`
    );

    // Insert JSON-LD before </head>
    const jsonLd = renderJsonLd(items, pageUrl);
    html = html.replace(/<\/head>/i, `${jsonLd}\n</head>`);

    fs.writeFileSync(file, html, 'utf8');
    console.log('✓', rel);
    changedFiles++;
  }
}

console.log(`\nDone. Added breadcrumbs to ${changedFiles} files.`);
