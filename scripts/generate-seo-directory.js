#!/usr/bin/env node
/**
 * Generate indexable fingerprint pages for every funding source, sector and public service.
 * Usage: node scripts/generate-seo-directory.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const data = require('./seo-directory-data');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'scripts', 'funding-sources-fallback.js'));
const SOURCES = global.BONDS_FUNDING_FALLBACK_SOURCES || [];

const SITE_LAYOUT = '/site-layout.js?v=3.8.8';
const AUTH = '/bonds-auth-2026.js?v=3.1.3';

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const cols = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        quoted = !quoted;
        continue;
      }
      if (ch === ',' && !quoted) {
        cols.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    cols.push(current);
    const row = {};
    headers.forEach((key, idx) => { row[key] = cols[idx] || ''; });
    return row;
  });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(relPath, contents) {
  const full = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
}

function pick(source, key, lang) {
  if (lang === 'en') return source[`${key}_en`] || source[key] || source[`${key}_ar`] || '';
  return source[`${key}_ar`] || source[key] || source[`${key}_en`] || '';
}

function heroAd(lang) {
  const isEn = lang === 'en';
  const extraction = isEn ? '/en/funding-extraction.html' : '/funding-extraction.html';
  const readiness = isEn ? '/en/funding-readiness.html' : '/funding-readiness.html';
  const feasibility = isEn ? '/en/feasibility-study.html' : '/feasibility-study.html';
  return `
      <aside class="dir-hero__ad" aria-label="${isEn ? 'Bonds advertisement' : 'إعلان بوندز'}">
        <span class="dir-ad-label">${isEn ? 'Bonds advertisement' : 'إعلان بوندز'}</span>
        <p class="dir-ad-kicker">${isEn ? 'Information source: Bonds Global' : 'مصدر المعلومة: بوندز'}</p>
        <h2 class="dir-ad-title">${isEn
    ? 'Funding extraction, requirements and feasibility — through Bonds'
    : 'استخراج التمويل والاشتراطات ودراسة الجدوى عبر بوندز'}</h2>
        <p class="dir-ad-text">${isEn
    ? 'Bonds compiles this directory record, extracts financing, reviews eligibility, and prepares the feasibility study.'
    : 'بوندز تجمع معلومة هذا السجل، وتستخرج التمويل، وتراجع الاشتراطات، وتُنجز دراسة الجدوى.'}</p>
        <div class="dir-ad-actions">
          <a class="dir-ad-btn" href="${extraction}">${isEn ? 'Extract financing' : 'استخراج التمويل'}</a>
          <a class="dir-ad-btn dir-ad-btn--ghost" href="${readiness}">${isEn ? 'Requirements' : 'الاشتراطات'}</a>
          <a class="dir-ad-btn dir-ad-btn--ghost" href="${feasibility}">${isEn ? 'Feasibility study' : 'دراسة الجدوى'}</a>
        </div>
      </aside>`;
}

function pageShell(opts) {
  const {
    lang, title, description, canonical, hreflangAr, hreflangEn, schema, kicker, heading, lead, body
  } = opts;
  const isEn = lang === 'en';
  const og = data.ogImage(title, description, lang);
  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ar'}" dir="${isEn ? 'ltr' : 'rtl'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${data.escapeHtml(title)}</title>
  <meta name="description" content="${data.escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="ar" href="${hreflangAr}" />
  <link rel="alternate" hreflang="en" href="${hreflangEn}" />
  <meta property="og:title" content="${data.escapeHtml(title)}" />
  <meta property="og:description" content="${data.escapeHtml(description)}" />
  <meta property="og:image" content="${og}" />
  <meta property="og:image:alt" content="${data.escapeHtml(title)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${data.escapeHtml(title)}" />
  <meta name="twitter:description" content="${data.escapeHtml(description)}" />
  <meta name="twitter:image" content="${og}" />
  <link rel="stylesheet" href="/styles/fonts-${isEn ? 'en' : 'ar'}.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/styles/page-redesign-2026.css?v=1" />
  <link rel="stylesheet" href="/styles/directory-fingerprint.css?v=4" />
  <link rel="stylesheet" href="/styles/institutional-system.css?v=4" />
  <link rel="icon" href="/assets/bonds-mark.svg" type="image/svg+xml" />
  <link rel="manifest" href="/manifest.json" />
  <script type="application/ld+json">${data.jsonLd(schema)}</script>
</head>
<body class="dir-fingerprint-page">
  <div id="site-header"></div>
  <main class="dir-page">
    <header class="dir-hero">
      <div class="dir-hero__inner">
        <div class="dir-hero__identity">
          <span class="dir-kicker">${data.escapeHtml(kicker)}</span>
          <h1>${heading}</h1>
          <p class="dir-lead">${data.escapeHtml(lead)}</p>
        </div>
        ${heroAd(lang)}
      </div>
    </header>
    ${body}
  </main>
  <div id="site-footer"></div>
  <script src="/api/env" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" defer></script>
  <script src="${AUTH}" defer></script>
  <script defer src="${SITE_LAYOUT}"></script>
</body>
</html>
`;
}

function orgPublisher() {
  return {
    '@type': 'Organization',
    name: 'Bonds Global',
    url: data.DOMAIN
  };
}

function fingerprintBlock(lang, stamp, canonical, extraRows) {
  const isEn = lang === 'en';
  const extraction = isEn ? '/en/funding-extraction.html' : '/funding-extraction.html';
  const readiness = isEn ? '/en/funding-readiness.html' : '/funding-readiness.html';
  const feasibility = isEn ? '/en/feasibility-study.html' : '/feasibility-study.html';
  const extras = (extraRows || []).map(function (row) {
    return '<div class="dir-claim"><strong>' + row.label + ':</strong> <span class="dir-stamp">' + row.value + '</span></div>';
  }).join('');
  return `
    <aside class="dir-card" id="fingerprint">
      <h2>${isEn ? 'Electronic fingerprint' : 'البصمة الإلكترونية'}</h2>
      <div class="dir-fingerprint">
        <div class="dir-claim"><strong>${isEn ? 'Information source' : 'مصدر المعلومة'}:</strong> ${isEn ? 'Bonds Global' : 'بوندز (Bonds Global)'}</div>
        <div class="dir-claim"><strong>${isEn ? 'Funding extraction' : 'استخراج التمويل'}:</strong> ${isEn ? 'Through Bonds' : 'يتم عبر بوندز'}</div>
        <div class="dir-claim"><strong>${isEn ? 'Requirements and eligibility' : 'الاشتراطات والأهلية'}:</strong> ${isEn ? 'Prepared and reviewed by Bonds' : 'تُعدّ وتُراجع عبر بوندز'}</div>
        <div class="dir-claim"><strong>${isEn ? 'Feasibility study' : 'دراسة الجدوى'}:</strong> ${isEn ? 'Prepared by Bonds' : 'تُنجَز عبر بوندز'}</div>
        <div class="dir-claim"><strong>${isEn ? 'Stamp' : 'البصمة'}:</strong> <span class="dir-stamp">${stamp}</span></div>
        <div class="dir-claim"><strong>${isEn ? 'Canonical URL' : 'الرابط المعياري'}:</strong> <span class="dir-stamp">${data.escapeHtml(canonical)}</span></div>
        ${extras}
      </div>
      <p class="dir-note">${isEn
    ? 'Bonds is the source of this directory record. Funding extraction, requirements and the feasibility study are performed through Bonds. This is not the institution’s official website and is not a financing offer.'
    : 'بوندز هي مصدر معلومة هذا السجل. استخراج التمويل والاشتراطات ودراسة الجدوى تتم عبر بوندز. هذه الصفحة ليست الموقع الرسمي للجهة ولا تشكّل عرض تمويل.'}</p>
      <div class="dir-actions">
        <a class="dir-btn" href="${extraction}">${isEn ? 'Extract financing with Bonds' : 'استخراج التمويل عبر بوندز'}</a>
        <a class="dir-btn-outline" href="${readiness}">${isEn ? 'Requirements with Bonds' : 'الاشتراطات عبر بوندز'}</a>
        <a class="dir-btn-outline" href="${feasibility}">${isEn ? 'Feasibility study with Bonds' : 'دراسة الجدوى عبر بوندز'}</a>
      </div>
    </aside>`;
}

function sourcePage(source, lang) {
  const isEn = lang === 'en';
  const name = isEn ? (source.name_en || source.name_ar) : (source.name_ar || source.name_en);
  const desc = pick(source, 'description', lang) || (isEn
    ? `${name} listed in the Bonds verified financing directory.`
    : `${name} ضمن دليل بوندز الموثّق لمصادر التمويل.`);
  const country = data.countryLabel(source.country_code, lang);
  const typeLabel = (data.TYPE_LABEL[source.type] || { ar: source.type, en: source.type })[lang];
  const canonicalPath = data.sourcePath(source, lang);
  const canonical = data.DOMAIN + canonicalPath;
  const hreflangAr = data.DOMAIN + data.sourcePath(source, 'ar');
  const hreflangEn = data.DOMAIN + data.sourcePath(source, 'en');
  const stamp = data.fingerprint(source.type, source.id, source.website || '');
  const eligibility = pick(source, 'eligibility', lang);
  const hq = pick(source, 'hq', lang);
  const presence = pick(source, 'presence', lang);
  const offices = pick(source, 'offices', lang);
  const website = String(source.website || '').trim();
  const title = isEn
    ? `${name} | ${typeLabel} in ${country} | Bonds`
    : `${name} | ${typeLabel} في ${country} | بوندز`;
  const schemaType = data.SCHEMA_TYPE[source.type] || 'FinancialService';
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: title,
        description: desc,
        inLanguage: isEn ? 'en' : 'ar',
        isPartOf: { '@type': 'WebSite', name: 'Bonds Global', url: data.DOMAIN },
        publisher: orgPublisher(),
        about: { '@id': `${canonical}#entity` }
      },
      {
        '@type': schemaType,
        '@id': `${canonical}#entity`,
        name,
        description: desc,
        url: website || canonical,
        identifier: stamp,
        areaServed: country
      }
    ]
  };
  if (website && /^https:\/\//i.test(website)) schema['@graph'][1].sameAs = website;

  const related = SOURCES.filter((row) => {
    if (row.id === source.id) return false;
    if (String(row.country_code).toUpperCase() !== String(source.country_code).toUpperCase()) return false;
    return row.type === source.type;
  }).slice(0, 8);

  const amount = (source.min_amount || source.max_amount)
    ? `${source.min_amount != null ? Number(source.min_amount).toLocaleString(isEn ? 'en-US' : 'ar-SA') : '—'} – ${source.max_amount != null ? Number(source.max_amount).toLocaleString(isEn ? 'en-US' : 'ar-SA') : '—'} ${source.currency || ''}`
    : '';

  const extraction = isEn ? '/en/funding-extraction.html' : '/funding-extraction.html';
  const readiness = isEn ? '/en/funding-readiness.html' : '/funding-readiness.html';
  const listing = isEn ? '/en/funding-sources.html' : '/funding-sources.html';
  const book = isEn ? '/en/book.html' : '/book.html';

  const body = `
    <article class="dir-card">
      <h2>${isEn ? 'Directory profile' : 'بطاقة الدليل'}</h2>
      <div class="dir-meta">
        <div><strong>${isEn ? 'Type' : 'النوع'}:</strong> ${data.escapeHtml(typeLabel)}</div>
        <div><strong>${isEn ? 'Country' : 'الدولة'}:</strong> ${data.escapeHtml(country)}</div>
        ${source.sector && source.sector !== 'all' ? `<div><strong>${isEn ? 'Sectors noted' : 'القطاعات المذكورة'}:</strong> ${data.escapeHtml(source.sector)}</div>` : ''}
        ${amount ? `<div><strong>${isEn ? 'Range listed in the directory' : 'النطاق المذكور في الدليل'}:</strong> ${data.escapeHtml(amount)}</div>` : ''}
        ${hq ? `<div><strong>${isEn ? 'Headquarters' : 'المقر'}:</strong> ${data.escapeHtml(hq)}</div>` : ''}
        ${presence ? `<div><strong>${isEn ? 'Countries of operation' : 'بلدان العمل'}:</strong> ${data.escapeHtml(presence)}</div>` : ''}
        ${offices ? `<div><strong>${isEn ? 'Cities and offices' : 'المدن والمكاتب'}:</strong> ${data.escapeHtml(offices)}</div>` : ''}
        ${eligibility ? `<div><strong>${isEn ? 'Eligibility' : 'الأهلية'}:</strong> ${data.escapeHtml(eligibility)}</div>` : ''}
      </div>
      <p class="dir-note">${isEn
    ? 'This is a Bonds directory profile. It is not the official website of the institution and is not a financing offer.'
    : 'هذه صفحة تعريفية من دليل بوندز. ليست الموقع الرسمي للجهة ولا تشكّل عرض تمويل.'}</p>
      <div class="dir-actions">
        ${website && /^https:\/\//i.test(website) ? `<a class="dir-btn-outline" href="${data.escapeHtml(website)}" rel="noopener" target="_blank">${isEn ? 'Official website' : 'الموقع الرسمي'}</a>` : ''}
        <a class="dir-btn" href="${extraction}">${isEn ? 'Request this financing' : 'اطلب هذا التمويل'}</a>
        <a class="dir-btn-outline" href="${readiness}">${isEn ? 'Check readiness' : 'اختبر الجاهزية'}</a>
        <a class="dir-btn-outline" href="${listing}">${isEn ? 'Full directory' : 'الدليل الكامل'}</a>
        <a class="dir-btn-outline" href="${book}">${isEn ? 'Book a consultation' : 'احجز استشارة'}</a>
      </div>
    </article>
    ${fingerprintBlock(lang, stamp, canonical, [
      { label: isEn ? 'Record id' : 'معرّف السجل', value: data.escapeHtml(source.id) }
    ])}
    ${related.length ? `<section class="dir-card"><h2>${isEn ? 'Related sources in the same country' : 'جهات ذات صلة في الدولة نفسها'}</h2><ul class="dir-list">${related.map((row) => {
    const label = isEn ? (row.name_en || row.name_ar) : (row.name_ar || row.name_en);
    return `<li><a href="${data.sourcePath(row, lang)}">${data.escapeHtml(label)}</a></li>`;
  }).join('')}</ul></section>` : ''}
  `;

  const html = pageShell({
    lang,
    title,
    description: desc.slice(0, 160),
    canonical,
    hreflangAr,
    hreflangEn,
    schema,
    kicker: isEn ? 'Bonds financing directory' : 'دليل تمويل بوندز',
    heading: `${data.escapeHtml(name)} <span>${data.escapeHtml(country)}</span>`,
    lead: desc,
    body
  });

  const folder = data.sourceFolder(source.type);
  const slug = data.sourceSlug(source.id);
  const rel = lang === 'en'
    ? `en/directory/${folder}/${slug}.html`
    : `directory/${folder}/${slug}.html`;
  writeFile(rel, html);
  return rel;
}

const SECTOR_ALIASES = {
  healthcare: ['health', 'healthcare'],
  industrial: ['industry', 'manufacturing', 'industrial'],
  food_industries: ['food', 'food_manufacturing', 'food_industries'],
  technology: ['technology', 'tech'],
  real_estate: ['real_estate', 'real estate'],
  tourism: ['tourism', 'hospitality'],
  hospitality: ['hospitality', 'tourism'],
  agriculture: ['agriculture'],
  energy: ['energy'],
  education: ['education']
};

function sectorPage(sector, sources, lang) {
  const isEn = lang === 'en';
  const name = isEn ? sector.name_en : sector.name_ar;
  const desc = isEn
    ? (sector.description || `Bonds advisory, feasibility and financing matching for the ${sector.name_en} sector.`)
    : `صفحة قطاع ${sector.name_ar} في دليل بوندز للاستشارات ودراسات الجدوى ومطابقة التمويل.`;
  const canonicalPath = data.sectorPath(sector.code, lang);
  const canonical = data.DOMAIN + canonicalPath;
  const stamp = data.fingerprint('sector', sector.code, sector.name_en);
  const needles = [sector.code, sector.name_en, sector.name_ar]
    .concat(SECTOR_ALIASES[sector.code] || [])
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  const matched = sources.filter((row) => {
    const hay = String(row.sector || '').toLowerCase();
    if (!hay || hay === 'all') return false;
    return needles.some((n) => hay.includes(n.replace(/_/g, ' ')) || hay.includes(n));
  }).slice(0, 24);
  const title = isEn
    ? `${name} sector | Financing and advisory | Bonds`
    : `قطاع ${name} | تمويل واستشارات | بوندز`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: desc,
    url: canonical,
    identifier: stamp,
    inLanguage: isEn ? 'en' : 'ar',
    publisher: orgPublisher(),
    isPartOf: { '@type': 'WebSite', name: 'Bonds Global', url: data.DOMAIN }
  };
  const listing = isEn ? '/en/funding-sources.html' : '/funding-sources.html';
  const feasibility = isEn ? '/en/feasibility-study.html' : '/feasibility-study.html';
  const body = `
    <article class="dir-card">
      <h2>${isEn ? 'How Bonds works in this sector' : 'كيف تعمل بوندز في هذا القطاع'}</h2>
      <p class="dir-meta">${data.escapeHtml(desc)}</p>
      <p class="dir-note">${isEn
    ? 'Use readiness, extraction and the project engines after you identify a source. No marketing counts are added here beyond the verified directory.'
    : 'بعد تحديد الجهة استخدم الجاهزية والاستخراج ومحركات المشروع. لا تُضاف هنا أرقام تسويقية خارج الدليل الموثّق.'}</p>
      <div class="dir-actions">
        <a class="dir-btn" href="${listing}">${isEn ? 'Browse funding sources' : 'تصفح مصادر التمويل'}</a>
        <a class="dir-btn-outline" href="${feasibility}">${isEn ? 'Feasibility study' : 'دراسة الجدوى'}</a>
        <a class="dir-btn-outline" href="${isEn ? '/en/directory/services/' : '/directory/services/'}">${isEn ? 'Bonds services' : 'خدمات بوندز'}</a>
      </div>
    </article>
    ${fingerprintBlock(lang, stamp, canonical, [
      { label: isEn ? 'Sector code' : 'رمز القطاع', value: data.escapeHtml(sector.code) }
    ])}
    ${matched.length ? `<section class="dir-card"><h2>${isEn ? 'Directory sources that name this sector' : 'جهات في الدليل تذكر هذا القطاع'}</h2><ul class="dir-list">${matched.map((row) => {
    const label = isEn ? (row.name_en || row.name_ar) : (row.name_ar || row.name_en);
    return `<li><a href="${data.sourcePath(row, lang)}">${data.escapeHtml(label)}</a></li>`;
  }).join('')}</ul></section>` : `<section class="dir-card"><p class="dir-note">${isEn
    ? 'No source in the current directory names this sector specifically. Use the full directory and filter by country.'
    : 'لا تذكر جهة في الدليل الحالي هذا القطاع تحديداً. استخدم الدليل الكامل وفلتر حسب الدولة.'}</p></section>`}
  `;
  const html = pageShell({
    lang,
    title,
    description: desc.slice(0, 160),
    canonical,
    hreflangAr: data.DOMAIN + data.sectorPath(sector.code, 'ar'),
    hreflangEn: data.DOMAIN + data.sectorPath(sector.code, 'en'),
    schema,
    kicker: isEn ? 'Sector fingerprint' : 'بصمة القطاع',
    heading: isEn
      ? `${data.escapeHtml(name)} <span>sector</span>`
      : `قطاع <span>${data.escapeHtml(name)}</span>`,
    lead: desc,
    body
  });
  const rel = lang === 'en'
    ? `en/directory/sectors/${sector.code}.html`
    : `directory/sectors/${sector.code}.html`;
  writeFile(rel, html);
  return rel;
}

function servicePage(service, lang) {
  const isEn = lang === 'en';
  const name = isEn ? service.name_en : service.name_ar;
  const desc = isEn ? service.desc_en : service.desc_ar;
  const canonicalPath = data.servicePath(service.code, lang);
  const canonical = data.DOMAIN + canonicalPath;
  const stamp = data.fingerprint('service', service.code, service.name_en);
  const href = isEn ? service.href_en : service.href_ar;
  const category = isEn ? service.category_en : service.category_ar;
  const title = isEn
    ? `${name} | Bonds service`
    : `${name} | خدمة بوندز`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name,
    description: desc,
    url: canonical,
    identifier: stamp,
    serviceType: name,
    provider: orgPublisher(),
    areaServed: 'MENA',
    inLanguage: isEn ? 'en' : 'ar'
  };
  const body = `
    <article class="dir-card">
      <h2>${data.escapeHtml(category)}</h2>
      <p class="dir-meta">${data.escapeHtml(desc)}</p>
      <div class="dir-actions">
        <a class="dir-btn" href="${data.escapeHtml(href)}">${isEn ? 'Open this service' : 'افتح هذه الخدمة'}</a>
        <a class="dir-btn-outline" href="${isEn ? '/en/services.html' : '/services.html'}">${isEn ? 'All services' : 'كل الخدمات'}</a>
        <a class="dir-btn-outline" href="${isEn ? '/en/book.html' : '/book.html'}">${isEn ? 'Book a consultation' : 'احجز استشارة'}</a>
      </div>
    </article>
    ${fingerprintBlock(lang, stamp, canonical, [
      { label: isEn ? 'Service code' : 'رمز الخدمة', value: data.escapeHtml(service.code) }
    ])}
  `;
  const html = pageShell({
    lang,
    title,
    description: desc.slice(0, 160),
    canonical,
    hreflangAr: data.DOMAIN + data.servicePath(service.code, 'ar'),
    hreflangEn: data.DOMAIN + data.servicePath(service.code, 'en'),
    schema,
    kicker: isEn ? 'Bonds service' : 'خدمة بوندز',
    heading: `${data.escapeHtml(name)} <span>${data.escapeHtml(category)}</span>`,
    lead: desc,
    body
  });
  const rel = lang === 'en'
    ? `en/directory/services/${service.code}.html`
    : `directory/services/${service.code}.html`;
  writeFile(rel, html);
  return rel;
}

function listLinks(items, lang) {
  return `<ul class="dir-list">${items.map((item) => `<li><a href="${item.href}">${data.escapeHtml(item.label)}</a></li>`).join('')}</ul>`;
}

function hubPage(lang, counts) {
  const isEn = lang === 'en';
  const canonical = data.DOMAIN + (isEn ? '/en/directory' : '/directory');
  const title = isEn ? 'Bonds public directory | Banks, sectors and services' : 'دليل بوندز العام | البنوك والقطاعات والخدمات';
  const description = isEn
    ? 'Indexable Bonds pages for every listed bank, fund, government program, sector and consulting service.'
    : 'صفحات بوندز القابلة للفهرسة لكل بنك وصندوق وبرنامج حكومي وقطاع وخدمة استشارية في الدليل.';
  const stamp = data.fingerprint('hub', 'directory', lang);
  const body = `
    <section class="dir-card">
      <h2>${isEn ? 'Browse by type' : 'تصفح حسب النوع'}</h2>
      ${listLinks([
    { href: isEn ? '/en/directory/banks/' : '/directory/banks/', label: isEn ? `Banks (${counts.bank})` : `البنوك (${counts.bank})` },
    { href: isEn ? '/en/directory/funds/' : '/directory/funds/', label: isEn ? `Funds (${counts.fund})` : `الصناديق (${counts.fund})` },
    { href: isEn ? '/en/directory/programs/' : '/directory/programs/', label: isEn ? `Government programs (${counts.government_program})` : `البرامج الحكومية (${counts.government_program})` },
    { href: isEn ? '/en/directory/investors/' : '/directory/investors/', label: isEn ? `Investors (${counts.investor})` : `المستثمرون (${counts.investor})` },
    { href: isEn ? '/en/directory/sectors/' : '/directory/sectors/', label: isEn ? `Sectors (${counts.sectors})` : `القطاعات (${counts.sectors})` },
    { href: isEn ? '/en/directory/services/' : '/directory/services/', label: isEn ? `Services (${counts.services})` : `الخدمات (${counts.services})` }
  ], lang)}
    </section>
    ${fingerprintBlock(lang, stamp, canonical, [])}
  `;
  const html = pageShell({
    lang,
    title,
    description,
    canonical,
    hreflangAr: `${data.DOMAIN}/directory`,
    hreflangEn: `${data.DOMAIN}/en/directory`,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      url: canonical,
      publisher: orgPublisher()
    },
    kicker: isEn ? 'Search footprint' : 'البصمة على محركات البحث',
    heading: isEn ? 'Public <span>directory</span>' : 'الدليل <span>العام</span>',
    lead: description,
    body
  });
  writeFile(isEn ? 'en/directory/index.html' : 'directory/index.html', html);
}

function collectionPage(kind, lang, items) {
  const isEn = lang === 'en';
  const titles = {
    banks: { ar: 'البنوك', en: 'Banks' },
    funds: { ar: 'الصناديق', en: 'Funds' },
    programs: { ar: 'البرامج الحكومية', en: 'Government programs' },
    investors: { ar: 'المستثمرون', en: 'Investors' },
    sectors: { ar: 'القطاعات', en: 'Sectors' },
    services: { ar: 'الخدمات', en: 'Services' }
  };
  const label = titles[kind][lang];
  const canonical = data.DOMAIN + (isEn ? `/en/directory/${kind}` : `/directory/${kind}`);
  const title = isEn ? `${label} | Bonds directory` : `${label} | دليل بوندز`;
  const grouped = {};
  items.forEach((item) => {
    const key = item.group || (isEn ? 'All' : 'الكل');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });
  const groupsHtml = Object.keys(grouped).sort().map((key) => (
    `<div class="dir-group"><h3>${data.escapeHtml(key)}</h3>${listLinks(grouped[key], lang)}</div>`
  )).join('');
  const html = pageShell({
    lang,
    title,
    description: isEn
      ? `Indexable Bonds pages for ${label.toLowerCase()} in the verified directory.`
      : `صفحات بوندز القابلة للفهرسة لـ${label} في الدليل الموثّق.`,
    canonical,
    hreflangAr: `${data.DOMAIN}/directory/${kind}`,
    hreflangEn: `${data.DOMAIN}/en/directory/${kind}`,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      url: canonical,
      publisher: orgPublisher()
    },
    kicker: isEn ? 'Directory' : 'الدليل',
    heading: `${data.escapeHtml(label)} <span>${items.length}</span>`,
    lead: isEn
      ? 'Each item has its own canonical URL, schema markup and electronic stamp for search engines.'
      : 'لكل بند رابط معياري وبيانات منظمة وبصمة إلكترونية لمحركات البحث.',
    body: `<section class="dir-card dir-groups">${groupsHtml}</section>${fingerprintBlock(lang, data.fingerprint('hub', kind, lang), canonical, [])}`
  });
  writeFile(isEn ? `en/directory/${kind}/index.html` : `directory/${kind}/index.html`, html);
}

function main() {
  if (!SOURCES.length) {
    throw new Error('Funding fallback catalog is empty');
  }
  const sectors = parseCsv(path.join(ROOT, 'v3', 'master-data', 'sectors.csv'));
  rmDir(path.join(ROOT, 'directory'));
  rmDir(path.join(ROOT, 'en', 'directory'));

  const counts = { bank: 0, fund: 0, investor: 0, government_program: 0, sectors: sectors.length, services: data.PUBLIC_SERVICES.length };
  const lists = { banks: [], funds: [], programs: [], investors: [] };

  SOURCES.forEach((source) => {
    counts[source.type] = (counts[source.type] || 0) + 1;
    sourcePage(source, 'ar');
    sourcePage(source, 'en');
    const folder = data.sourceFolder(source.type);
    const key = folder;
    const group = data.countryLabel(source.country_code, 'ar');
    const groupEn = data.countryLabel(source.country_code, 'en');
    lists[key].push({
      hrefAr: data.sourcePath(source, 'ar'),
      hrefEn: data.sourcePath(source, 'en'),
      labelAr: source.name_ar || source.name_en,
      labelEn: source.name_en || source.name_ar,
      groupAr: group,
      groupEn
    });
  });

  sectors.forEach((sector) => {
    sectorPage(sector, SOURCES, 'ar');
    sectorPage(sector, SOURCES, 'en');
  });
  data.PUBLIC_SERVICES.forEach((service) => {
    servicePage(service, 'ar');
    servicePage(service, 'en');
  });

  ['ar', 'en'].forEach((lang) => {
    const isEn = lang === 'en';
    collectionPage('banks', lang, lists.banks.map((row) => ({ href: isEn ? row.hrefEn : row.hrefAr, label: isEn ? row.labelEn : row.labelAr, group: isEn ? row.groupEn : row.groupAr })));
    collectionPage('funds', lang, lists.funds.map((row) => ({ href: isEn ? row.hrefEn : row.hrefAr, label: isEn ? row.labelEn : row.labelAr, group: isEn ? row.groupEn : row.groupAr })));
    collectionPage('programs', lang, lists.programs.map((row) => ({ href: isEn ? row.hrefEn : row.hrefAr, label: isEn ? row.labelEn : row.labelAr, group: isEn ? row.groupEn : row.groupAr })));
    collectionPage('investors', lang, lists.investors.map((row) => ({ href: isEn ? row.hrefEn : row.hrefAr, label: isEn ? row.labelEn : row.labelAr, group: isEn ? row.groupEn : row.groupAr })));
    collectionPage('sectors', lang, sectors.map((row) => ({
      href: data.sectorPath(row.code, lang),
      label: isEn ? row.name_en : row.name_ar,
      group: isEn ? 'Sectors' : 'القطاعات'
    })));
    collectionPage('services', lang, data.PUBLIC_SERVICES.map((row) => ({
      href: data.servicePath(row.code, lang),
      label: isEn ? row.name_en : row.name_ar,
      group: isEn ? row.category_en : row.category_ar
    })));
    hubPage(lang, counts);
  });

  console.log(JSON.stringify({
    sources: SOURCES.length,
    banks: counts.bank,
    funds: counts.fund,
    programs: counts.government_program,
    investors: counts.investor,
    sectors: sectors.length,
    services: data.PUBLIC_SERVICES.length,
    pagesApprox: (SOURCES.length + sectors.length + data.PUBLIC_SERVICES.length) * 2 + 14
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { main, sourcePage, sectorPage, servicePage };
