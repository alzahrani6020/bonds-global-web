/**
 * Funding sources directory — shared AR/EN page logic.
 */
(function () {
  'use strict';

  const locale = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const isEn = locale === 'en';

  const COUNTRY_NAMES = {
    SA: { ar: 'السعودية', en: 'Saudi Arabia' },
    AE: { ar: 'الإمارات', en: 'UAE' },
    EG: { ar: 'مصر', en: 'Egypt' },
    JO: { ar: 'الأردن', en: 'Jordan' },
    KW: { ar: 'الكويت', en: 'Kuwait' },
    QA: { ar: 'قطر', en: 'Qatar' },
    BH: { ar: 'البحرين', en: 'Bahrain' },
    OM: { ar: 'عُمان', en: 'Oman' },
    MA: { ar: 'المغرب', en: 'Morocco' },
    TN: { ar: 'تونس', en: 'Tunisia' },
    DZ: { ar: 'الجزائر', en: 'Algeria' },
    IQ: { ar: 'العراق', en: 'Iraq' },
    LB: { ar: 'لبنان', en: 'Lebanon' },
    LY: { ar: 'ليبيا', en: 'Libya' },
    SD: { ar: 'السودان', en: 'Sudan' },
    YE: { ar: 'اليمن', en: 'Yemen' },
    PS: { ar: 'فلسطين', en: 'Palestine' },
    SY: { ar: 'سوريا', en: 'Syria' },
    MR: { ar: 'موريتانيا', en: 'Mauritania' },
    SO: { ar: 'الصومال', en: 'Somalia' },
    DJ: { ar: 'جيبوتي', en: 'Djibouti' },
    KM: { ar: 'جزر القمر', en: 'Comoros' },
    ALL: { ar: 'عربي / إقليمي مشترك', en: 'Pan-Arab / regional' }
  };

  const I18N = isEn ? {
    loading: 'Loading funding sources...',
    results: 'Results',
    fallback: 'Directory compiled from central-bank registers and official programmes — replaced by live sources when available.',
    empty: 'No sources match these filters. Try another country or entity type, or clear filters.',
    emptyCountry: 'No sample sources are listed for this country yet.',
    emptySearch: 'No source matches this name. Try a shorter word, or clear filters to browse the full directory.',
    searchHint: 'Search by name, e.g. Al Ahli. Arabic spelling variants are ignored, and matches from other countries appear if the current filter is empty.',
    resetHint: 'Clear filters restores entity type, country, sector, capital and the search box, then shows every source again.',
    reset: 'Clear filters',
    resetTitle: 'Clear all filters and search, then show every source',
    widened: 'This name was not in the current country filter, so results from other countries are shown.',
    applySearch: 'Search',
    saved: 'Saved for comparison:',
    featured: 'Featured',
    save: 'Save for comparison',
    eligibility: 'Eligibility',
    hq: 'Headquarters',
    presence: 'Countries of operation',
    offices: 'Cities and offices',
    visit: 'Visit website',
    request: 'Request this financing',
    profile: 'Directory page',
    allSectors: 'All sectors',
    addSectorPrompt: 'Enter a sector name to add',
    addCapitalPrompt: 'Enter the required amount (numbers only)',
    addCountryPrompt: 'Enter a 2-letter country code, e.g. JO',
    invalidCountry: 'Use a 2-letter country code such as SA or JO.',
    invalidAmount: 'Enter a valid amount greater than zero.',
    types: {
      bank: 'Bank',
      fund: 'Fund',
      investor: 'Investor',
      government_program: 'Government program'
    },
    financing: {
      loan: 'Loan',
      equity: 'Equity',
      guarantee: 'Guarantee'
    },
    extractionType: {
      bank: 'Companies & Institutions',
      fund: 'Companies & Institutions',
      investor: 'Startups',
      government_program: 'Companies & Institutions'
    }
  } : {
    loading: 'جاري تحميل مصادر التمويل...',
    results: 'عدد النتائج',
    fallback: 'دليل موثّق من البنوك المركزية وبرامج التمويل الرسمية — يُستبدل بالمصادر الحية عند توفرها.',
    empty: 'لا توجد مصادر مطابقة لهذه الفلاتر. جرّب دولة أو نوع جهة آخر، أو امسح الفلاتر.',
    emptyCountry: 'لا توجد مصادر توضيحية لهذه الدولة بعد.',
    emptySearch: 'لا توجد جهة بهذا الاسم. جرّب كلمة أقصر، أو امسح الفلاتر لعرض الدليل كاملاً.',
    searchHint: 'ابحث باسم الجهة مثل البنك الأهلي. البحث يتجاهل الهمزات، ويعرض نتائج من دول أخرى إذا لم يوجد الاسم في الفلتر الحالي.',
    resetHint: 'مسح الفلاتر يعيد نوع الجهة والدولة والقطاع ورأس المال وكلمة البحث، ثم يعرض كل المصادر من جديد.',
    reset: 'مسح الفلاتر',
    resetTitle: 'مسح كل الفلاتر والبحث وإظهار كل المصادر',
    widened: 'لم يُعثر على هذا الاسم ضمن فلتر الدولة الحالي، فُعرضت نتائج من دول أخرى.',
    applySearch: 'بحث',
    saved: 'المحفوظات للمفاضلة:',
    featured: 'مميز',
    save: 'حفظ للمفاضلة',
    eligibility: 'الأهلية',
    hq: 'المقر',
    presence: 'البلدان',
    offices: 'المدن والمكاتب',
    visit: 'زيارة الموقع',
    request: 'اطلب هذا التمويل',
    profile: 'صفحة الدليل',
    allSectors: 'جميع القطاعات',
    addSectorPrompt: 'أدخل اسم القطاع لإضافته',
    addCapitalPrompt: 'أدخل المبلغ المطلوب (أرقام فقط)',
    addCountryPrompt: 'أدخل رمز الدولة بحرفين مثل JO',
    invalidCountry: 'استخدم رمز دولة من حرفين مثل SA أو JO.',
    invalidAmount: 'أدخل مبلغاً صحيحاً أكبر من صفر.',
    types: {
      bank: 'بنك',
      fund: 'صندوق',
      investor: 'مستثمر',
      government_program: 'برنامج حكومي'
    },
    financing: {
      loan: 'قرض',
      equity: 'ملكية',
      guarantee: 'ضمان'
    },
    extractionType: {
      bank: 'شركات ومؤسسات',
      fund: 'شركات ومؤسسات',
      investor: 'مشاريع ناشئة',
      government_program: 'شركات ومؤسسات'
    }
  };

  const resultsEl = document.getElementById('results');
  const resultsInfo = document.getElementById('resultsInfo');
  const typeEl = document.getElementById('filterType');
  const countryEl = document.getElementById('filterCountry');
  const sectorEl = document.getElementById('filterSector');
  const searchEl = document.getElementById('filterSearch');
  const matchCountryEl = document.getElementById('matchCountry');
  const matchSectorEl = document.getElementById('matchSector');
  const matchCapitalEl = document.getElementById('matchCapital');
  if (!resultsEl || !typeEl || !countryEl) return;

  const fallbackSources = Array.isArray(window.BONDS_FUNDING_FALLBACK_SOURCES)
    ? window.BONDS_FUNDING_FALLBACK_SOURCES.slice()
    : [];

  const ADD_SECTOR = '__add_sector__';
  const ADD_CAPITAL = '__add_capital__';
  const ADD_COUNTRY = '__add_country__';
  const CUSTOM_SECTORS_KEY = 'bonds_funding_custom_sectors';
  const CUSTOM_CAPITALS_KEY = 'bonds_funding_custom_capitals';
  const CUSTOM_COUNTRIES_KEY = 'bonds_funding_custom_countries';

  let allSources = [];
  let isFallback = false;
  let savedIds = new Set(JSON.parse(localStorage.getItem('bonds_saved_funding') || '[]'));

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setSelectValue(el, value) {
    if (!el) return;
    const next = value == null ? '' : String(value);
    el.value = next;
    const dd = window.getUniversalDropdown && window.getUniversalDropdown(el);
    if (dd) dd.value = next;
  }

  function countryMatches(sourceCountry, selected) {
    if (!selected) return true;
    const raw = String(sourceCountry || '').toUpperCase();
    const want = String(selected).toUpperCase();
    if (want === 'REGIONAL') {
      return raw === 'ALL' || raw === '*' || raw === 'REGIONAL';
    }
    if (!raw || raw === 'ALL' || raw === '*' || raw === 'REGIONAL') return true;
    return raw.split(/[,\s]+/).filter(Boolean).indexOf(want) !== -1;
  }

  function countryName(code) {
    const row = COUNTRY_NAMES[String(code || '').toUpperCase()];
    if (!row) return code || '';
    return isEn ? row.en : row.ar;
  }

  function pickText(source, key) {
    const localized = isEn
      ? source[key + '_en'] || source[key] || source[key + '_ar']
      : source[key + '_ar'] || source[key] || source[key + '_en'];
    return localized || '';
  }

  function displayName(source) {
    return isEn
      ? (source.name_en || source.name_ar || '')
      : (source.name_ar || source.name_en || '');
  }

  const SECTOR_PARTS = {
    technology: { ar: 'تقنية', en: 'technology' },
    manufacturing: { ar: 'صناعة', en: 'manufacturing' },
    industry: { ar: 'صناعة', en: 'industry' },
    food: { ar: 'غذاء', en: 'food' },
    healthcare: { ar: 'صحة', en: 'healthcare' },
    infrastructure: { ar: 'بنية تحتية', en: 'infrastructure' },
    energy: { ar: 'طاقة', en: 'energy' }
  };

  const LEGACY_SECTOR_ALIASES = {
    health: ['health', 'healthcare', 'صحة'],
    education: ['education', 'تعليم'],
    industry: ['industry', 'manufacturing', 'صناعة'],
    food_manufacturing: ['food_manufacturing', 'food', 'restaurants', 'غذاء', 'مطاعم'],
    pharma_biotech: ['pharma', 'biotech', 'healthcare', 'health', 'أدوية'],
    agriculture: ['agriculture', 'زراعة'],
    technology: ['technology', 'تقنية'],
    real_estate: ['real_estate', 'real estate', 'عقار'],
    tourism: ['tourism', 'سياحة'],
    conventional_energy: ['energy', 'طاقة'],
    renewable_energy: ['energy', 'طاقة', 'renewable'],
    construction: ['construction', 'manufacturing', 'تشييد'],
    manufacturing: ['manufacturing', 'industry', 'صناعة'],
    food: ['food', 'restaurants', 'مطاعم', 'غذاء'],
    healthcare: ['healthcare', 'health', 'صحة'],
    infrastructure: ['infrastructure', 'بنية'],
    energy: ['energy', 'طاقة']
  };

  let taxonomySectors = [];

  function taxonomyLabel(row) {
    if (!row) return '';
    return isEn ? (row.name_en || row.name_ar || row.code) : (row.name_ar || row.name_en || row.code);
  }

  function findTaxonomySector(value) {
    const key = String(value || '').trim().toLowerCase();
    if (!key) return null;
    return taxonomySectors.find(function (row) {
      return String(row.code || '').toLowerCase() === key
        || String(row.name_ar || '').toLowerCase() === key
        || String(row.name_en || '').toLowerCase() === key;
    }) || null;
  }

  function sectorLabel(sector) {
    const raw = String(sector || '').trim();
    if (!raw || raw.toLowerCase() === 'all') return I18N.allSectors;
    return raw.split(',').map(function (part) {
      const key = part.trim();
      const tax = findTaxonomySector(key);
      if (tax) return taxonomyLabel(tax);
      const legacy = SECTOR_PARTS[key.toLowerCase()];
      if (legacy) return isEn ? legacy.en : legacy.ar;
      return key;
    }).join(isEn ? ', ' : '، ');
  }

  function validWebsite(url) {
    const value = String(url || '').trim();
    if (!value || value === '#') return '';
    try {
      const parsed = new URL(value, window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (_) {
      return '';
    }
  }

  function isBlankFilter(value) {
    const v = String(value == null ? '' : value).trim();
    return !v || v === 'all' || v === '*' || v.indexOf('__add_') === 0;
  }

  function parseCapital(raw) {
    const value = String(raw || '').trim();
    if (isBlankFilter(value)) return { mode: 'any' };
    if (value.indexOf('exact:') === 0) {
      const amount = Number(value.slice(6));
      return Number.isFinite(amount) && amount > 0 ? { mode: 'exact', amount: amount } : { mode: 'any' };
    }
    if (value.indexOf('range:') === 0) {
      const parts = value.slice(6).split('-');
      const min = Number(parts[0]);
      const max = parts[1] === '' || parts[1] == null ? Infinity : Number(parts[1]);
      if (!Number.isFinite(min)) return { mode: 'any' };
      return { mode: 'range', min: min, max: Number.isFinite(max) ? max : Infinity };
    }
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? { mode: 'exact', amount: amount } : { mode: 'any' };
  }

  function currentFilters() {
    const type = isBlankFilter(typeEl.value) ? '' : typeEl.value;
    const country = isBlankFilter(countryEl.value)
      ? (isBlankFilter(matchCountryEl && matchCountryEl.value) ? '' : matchCountryEl.value)
      : countryEl.value;
    const sector = isBlankFilter(sectorEl.value)
      ? (isBlankFilter(matchSectorEl && matchSectorEl.value) ? '' : String(matchSectorEl.value).trim())
      : String(sectorEl.value).trim();
    return {
      type: type,
      country: country,
      sector: sector,
      search: (searchEl.value || '').trim(),
      capital: parseCapital(matchCapitalEl && matchCapitalEl.value)
    };
  }

  function sectorNeedles(selected) {
    const key = String(selected || '').trim();
    const needles = [key, key.replace(/_/g, ' ')];
    const tax = findTaxonomySector(key);
    if (tax) {
      needles.push(tax.code, tax.name_ar, tax.name_en);
    }
    const aliases = LEGACY_SECTOR_ALIASES[key.toLowerCase()] || [];
    aliases.forEach(function (alias) { needles.push(alias); });
    return needles.filter(Boolean).map(function (n) { return String(n).toLowerCase(); });
  }

  function sectorMatches(sourceSector, selected) {
    const hay = String(sourceSector || '').toLowerCase();
    if (!selected) return true;
    if (!hay || hay === 'all') return true;
    return sectorNeedles(selected).some(function (needle) {
      return needle && hay.indexOf(needle) !== -1;
    });
  }

  function capitalMatches(source, capital) {
    if (!capital || capital.mode === 'any') return true;
    const min = Number(source.min_amount);
    const max = Number(source.max_amount);
    const sourceMin = Number.isFinite(min) ? min : 0;
    const sourceMax = Number.isFinite(max) ? max : Infinity;
    if (capital.mode === 'exact') {
      return capital.amount >= sourceMin && capital.amount <= sourceMax;
    }
    if (capital.mode === 'range') {
      return sourceMax >= capital.min && sourceMin <= capital.max;
    }
    return true;
  }

  function normalizeSearch(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ء/g, '')
      .replace(/[“”"'`]/g, ' ')
      .replace(/[؟?!.,،:;؛()\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sourceHaystack(source) {
    const code = String(source.country_code || '').toUpperCase();
    const country = COUNTRY_NAMES[code];
    return normalizeSearch([
      source.name_en, source.name_ar,
      source.description, source.description_ar, source.description_en,
      source.eligibility, source.eligibility_ar, source.eligibility_en,
      source.hq_ar, source.hq_en, source.presence_ar, source.presence_en,
      source.offices_ar, source.offices_en,
      source.website, source.country_code,
      country && country.ar, country && country.en
    ].join(' '));
  }

  function applyClientFilters(list, filters, options) {
    const ignoreCountry = options && options.ignoreCountry;
    const t = filters.type;
    const c = String(filters.country || '').toUpperCase();
    const se = String(filters.sector || '').toLowerCase();
    const q = normalizeSearch(filters.search);
    return list.filter(function (s) {
      if (t && s.type !== t) return false;
      if (!ignoreCountry && c && !countryMatches(s.country_code, c)) return false;
      if (se && !sectorMatches(s.sector, se)) return false;
      if (q && sourceHaystack(s).indexOf(q) === -1) return false;
      if (!capitalMatches(s, filters.capital)) return false;
      return true;
    });
  }

  function directoryHref(source) {
    const folder = ({
      bank: 'banks',
      fund: 'funds',
      investor: 'investors',
      government_program: 'programs'
    })[source.type] || 'banks';
    const slug = String(source.id || '').replace(/^fs-/i, '').toLowerCase();
    return (isEn ? '/en/directory/' : '/directory/') + folder + '/' + slug;
  }

  function extractionUrl(source) {
    if (!window.BondsFundingContext) {
      return isEn ? 'funding-extraction.html' : 'funding-extraction.html';
    }
    const amount = Number(source.max_amount) || Number(source.min_amount) || 0;
    return window.BondsFundingContext.buildUrl('funding-extraction.html', {
      source: 'sources',
      country: source.country_code,
      sector: source.sector,
      amount: amount > 0 ? amount : undefined,
      financingType: I18N.extractionType[source.type] || (isEn ? 'Other' : 'أخرى'),
      selectedSource: displayName(source)
    }, locale);
  }

  function formatAmount(n) {
    if (n == null || n === '') return '-';
    return Number(n).toLocaleString(isEn ? 'en-US' : 'ar-SA');
  }

  function renderSaved(list) {
    const el = document.getElementById('savedSection');
    if (!el) return;
    const saved = list.filter(function (s) { return savedIds.has(String(s.id)); });
    if (!saved.length) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = '<strong>' + escapeHtml(I18N.saved) + '</strong> ' +
      saved.map(function (s) {
        return '<span style="display:inline-block;background:rgba(212,168,83,0.15);color:var(--gold);padding:0.2rem 0.6rem;border-radius:12px;margin:0.25rem;font-size:0.8rem;">' +
          escapeHtml(displayName(s)) + '</span>';
      }).join('');
  }

  function locationBlock(source) {
    const hq = pickText(source, 'hq');
    const presence = pickText(source, 'presence');
    const offices = pickText(source, 'offices');
    if (!hq && !presence && !offices) return '';
    let html = '<div class="location">';
    if (hq) html += '<div><strong>' + escapeHtml(I18N.hq) + ':</strong> ' + escapeHtml(hq) + '</div>';
    if (presence) html += '<div><strong>' + escapeHtml(I18N.presence) + ':</strong> ' + escapeHtml(presence) + '</div>';
    if (offices) html += '<div><strong>' + escapeHtml(I18N.offices) + ':</strong> ' + escapeHtml(offices) + '</div>';
    html += '</div>';
    return html;
  }

  function render() {
    const filters = currentFilters();
    let filtered = applyClientFilters(allSources, filters);
    let widenedCountry = false;
    if (!filtered.length && filters.search) {
      const acrossCountries = applyClientFilters(allSources, filters, { ignoreCountry: true });
      if (acrossCountries.length) {
        filtered = acrossCountries;
        widenedCountry = true;
      }
    }
    resultsInfo.style.display = 'flex';
    resultsInfo.innerHTML = '<span>' + escapeHtml(I18N.results) + ': <strong>' + filtered.length + '</strong></span>' +
      (widenedCountry ? '<span class="widen-note">' + escapeHtml(I18N.widened) + '</span>' : '') +
      (isFallback ? '<span class="fallback-note">(' + escapeHtml(I18N.fallback) + ')</span>' : '');

    renderSaved(allSources);

    if (!filtered.length) {
      const onlyCountry = filters.country && !filters.type && !filters.sector && !filters.search && (!filters.capital || filters.capital.mode === 'any');
      const msg = filters.search
        ? I18N.emptySearch
        : ((onlyCountry && isFallback) ? I18N.emptyCountry : I18N.empty);
      resultsEl.innerHTML = '<div class="empty">' + escapeHtml(msg) + '</div>';
      return;
    }

    resultsEl.innerHTML = filtered.map(function (s) {
      const website = validWebsite(s.website);
      const sector = sectorLabel(s.sector);
      const country = countryName(s.country_code);
      const financing = I18N.financing[s.financing_type] || '';
      const desc = pickText(s, 'description');
      const eligibility = pickText(s, 'eligibility');
      const id = String(s.id || '');
      return (
        '<div class="source-card">' +
          (s.is_featured ? '<span class="featured-tag">' + escapeHtml(I18N.featured) + '</span>' : '') +
          '<button class="save-btn' + (savedIds.has(id) ? ' saved' : '') + '" data-save-id="' + escapeHtml(id) + '" title="' + escapeHtml(I18N.save) + '">' +
            (savedIds.has(id) ? '★' : '☆') +
          '</button>' +
          '<span class="badge badge-' + escapeHtml(s.type || '') + '">' + escapeHtml(I18N.types[s.type] || s.type || '') + '</span>' +
          '<h3><a href="' + escapeHtml(directoryHref(s)) + '">' + escapeHtml(displayName(s)) + '</a></h3>' +
          '<div class="meta">' + escapeHtml([country, sector, financing].filter(Boolean).join(' · ')) + '</div>' +
          (s.min_amount || s.max_amount
            ? '<div class="amount">' + escapeHtml(formatAmount(s.min_amount) + ' – ' + formatAmount(s.max_amount) + ' ' + (s.currency || '')) + '</div>'
            : '') +
          (desc ? '<div class="desc">' + escapeHtml(desc) + '</div>' : '') +
          locationBlock(s) +
          (eligibility ? '<div class="eligibility"><strong>' + escapeHtml(I18N.eligibility) + ':</strong> ' + escapeHtml(eligibility) + '</div>' : '') +
          '<div class="source-card__actions">' +
            '<a href="' + escapeHtml(directoryHref(s)) + '" class="source-card__cta" style="background:transparent;color:var(--gold)!important;border:1px solid var(--border);">' + escapeHtml(I18N.profile) + '</a>' +
            '<a href="' + escapeHtml(extractionUrl(s)) + '" data-fr-extraction="' + escapeHtml(id) + '" class="source-card__cta">' + escapeHtml(I18N.request) + '</a>' +
            (website ? '<a href="' + escapeHtml(website) + '" target="_blank" rel="noopener">' + escapeHtml(I18N.visit) + ' ←</a>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function useFallback() {
    isFallback = true;
    allSources = fallbackSources.slice();
  }

  async function load() {
    resultsEl.innerHTML = '<div class="loading">' + escapeHtml(I18N.loading) + '</div>';
    resultsInfo.style.display = 'none';
    isFallback = false;
    const filters = currentFilters();
    try {
      const params = new URLSearchParams();
      if (filters.type && !filters.search) params.set('type', filters.type);
      if (filters.country && !filters.search && String(filters.country).toLowerCase() !== 'regional') {
        params.set('country_code', filters.country);
      }
      if (filters.sector && !filters.search) params.set('sector', filters.sector);

      const qs = params.toString();
      const res = await fetch('/api/funding-sources' + (qs ? '?' + qs : ''));
      const json = await res.json().catch(function () { return {}; });
      const rows = Array.isArray(json.data) ? json.data : [];
      if (!res.ok || !rows.length || rows.length < fallbackSources.length) {
        useFallback();
      } else {
        allSources = rows;
      }
    } catch (e) {
      useFallback();
    }
    render();
  }

  function syncCountries(fromEl, toEl) {
    if (!fromEl || !toEl || fromEl.value === toEl.value) return;
    setSelectValue(toEl, fromEl.value);
  }

  function syncSectors(fromEl, toEl) {
    if (!fromEl || !toEl || fromEl.value === toEl.value) return;
    setSelectValue(toEl, fromEl.value);
  }

  function readCustomList(key) {
    try {
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  function writeCustomList(key, rows) {
    localStorage.setItem(key, JSON.stringify(rows));
  }

  function insertOptionBeforeAdd(el, value, label) {
    if (!el) return;
    const exists = Array.from(el.options).some(function (opt) { return opt.value === value; });
    if (exists) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    const addOpt = Array.from(el.options).find(function (item) { return String(item.value).indexOf('__add_') === 0; });
    if (addOpt) el.insertBefore(opt, addOpt);
    else el.appendChild(opt);
  }

  function refreshDropdown(el) {
    if (!el) return;
    const dd = window.getUniversalDropdown && window.getUniversalDropdown(el);
    if (!dd || !dd.setOptions) return;
    const current = el.value;
    dd.setOptions(Array.from(el.options).map(function (opt) {
      return { value: opt.value, label: opt.text };
    }));
    dd.value = current;
  }

  function addCustomOption(els, value, label, storageKey) {
    const list = readCustomList(storageKey);
    if (!list.some(function (row) { return row.value === value; })) {
      list.push({ value: value, label: label });
      writeCustomList(storageKey, list);
    }
    els.forEach(function (el) {
      insertOptionBeforeAdd(el, value, label);
      refreshDropdown(el);
      setSelectValue(el, value);
    });
  }

  function buildSectorItems() {
    const items = [{ value: 'all', label: isEn ? 'All' : 'الكل' }];
    taxonomySectors.forEach(function (row) {
      items.push({ value: row.code, label: taxonomyLabel(row) });
    });
    readCustomList(CUSTOM_SECTORS_KEY).forEach(function (row) {
      if (!items.some(function (item) { return item.value === row.value; })) {
        items.push({ value: row.value, label: row.label || row.value });
      }
    });
    items.push({ value: ADD_SECTOR, label: isEn ? '+ Add sector' : '+ إضافة قطاع' });
    return items;
  }

  function applySectorItems() {
    const items = buildSectorItems();
    [matchSectorEl, sectorEl].forEach(function (el) {
      if (!el) return;
      const current = isBlankFilter(el.value) ? 'all' : el.value;
      const dd = window.getUniversalDropdown && window.getUniversalDropdown(el);
      if (dd && dd.setOptions) {
        dd.setOptions(items);
      } else {
        el.innerHTML = '';
        items.forEach(function (item) {
          const opt = document.createElement('option');
          opt.value = item.value;
          opt.textContent = item.label;
          el.appendChild(opt);
        });
      }
      setSelectValue(el, items.some(function (item) { return item.value === current; }) ? current : 'all');
    });
  }

  function loadTaxonomySectors() {
    const applyWhenReady = function () { applySectorItems(); };
    document.addEventListener('DOMContentLoaded', function () {
      if (taxonomySectors.length) applyWhenReady();
    });
    return fetch('/api/v3/investment-taxonomy?depth=sector', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        taxonomySectors = json && Array.isArray(json.sectors) ? json.sectors.slice() : [];
        applyWhenReady();
      })
      .catch(function () {
        taxonomySectors = [];
        applyWhenReady();
      });
  }

  function buildCountryItems() {
    const items = [{ value: 'all', label: isEn ? 'All' : 'الكل' }];
    items.push({ value: 'regional', label: isEn ? 'Pan-Arab / regional' : 'عربي / إقليمي مشترك' });
    Object.keys(COUNTRY_NAMES).forEach(function (code) {
      if (code === 'ALL') return;
      const row = COUNTRY_NAMES[code];
      items.push({ value: code, label: isEn ? row.en : row.ar });
    });
    readCustomList(CUSTOM_COUNTRIES_KEY).forEach(function (row) {
      if (!items.some(function (item) { return item.value === row.value; })) {
        items.push({ value: row.value, label: row.label || row.value });
      }
    });
    items.push({ value: ADD_COUNTRY, label: isEn ? '+ Add country' : '+ إضافة دولة' });
    return items;
  }

  function applySelectItems(els, items) {
    els.forEach(function (el) {
      if (!el) return;
      const current = isBlankFilter(el.value) ? 'all' : el.value;
      const dd = window.getUniversalDropdown && window.getUniversalDropdown(el);
      if (dd && dd.setOptions) {
        dd.setOptions(items);
      } else {
        el.innerHTML = '';
        items.forEach(function (item) {
          const opt = document.createElement('option');
          opt.value = item.value;
          opt.textContent = item.label;
          el.appendChild(opt);
        });
      }
      setSelectValue(el, items.some(function (item) { return item.value === current; }) ? current : 'all');
    });
  }

  function applyCountryItems() {
    applySelectItems([matchCountryEl, countryEl], buildCountryItems());
  }

  function hydrateCustomOptions() {
    readCustomList(CUSTOM_CAPITALS_KEY).forEach(function (row) {
      insertOptionBeforeAdd(matchCapitalEl, row.value, row.label || row.value);
    });
    refreshDropdown(matchCapitalEl);
    applyCountryItems();
  }

  function revertSelect(el) {
    setSelectValue(el, el.dataset.prevValue || 'all');
  }

  function handleAddOption(el) {
    const value = el.value;
    if (value === ADD_SECTOR) {
      const name = window.prompt(I18N.addSectorPrompt);
      if (!name || !String(name).trim()) {
        revertSelect(el);
        return false;
      }
      const label = String(name).trim();
      addCustomOption([matchSectorEl, sectorEl], label, label, CUSTOM_SECTORS_KEY);
      return true;
    }
    if (value === ADD_CAPITAL) {
      const raw = window.prompt(I18N.addCapitalPrompt);
      const amount = Number(String(raw || '').replace(/[^\d.]/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) {
        window.alert(I18N.invalidAmount);
        revertSelect(el);
        return false;
      }
      const token = 'exact:' + amount;
      const label = amount.toLocaleString(isEn ? 'en-US' : 'ar-SA');
      addCustomOption([matchCapitalEl], token, label, CUSTOM_CAPITALS_KEY);
      return true;
    }
    if (value === ADD_COUNTRY) {
      const raw = window.prompt(I18N.addCountryPrompt);
      const code = String(raw || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) {
        window.alert(I18N.invalidCountry);
        revertSelect(el);
        return false;
      }
      addCustomOption([matchCountryEl, countryEl], code, code, CUSTOM_COUNTRIES_KEY);
      return true;
    }
    return false;
  }

  function onFilterSelectChange(el, after) {
    if (String(el.value).indexOf('__add_') === 0) {
      if (handleAddOption(el)) after();
      return;
    }
    el.dataset.prevValue = el.value;
    after();
  }

  window.toggleSave = function (id) {
    const key = String(id || '');
    if (!key) return;
    if (savedIds.has(key)) savedIds.delete(key);
    else savedIds.add(key);
    localStorage.setItem('bonds_saved_funding', JSON.stringify(Array.from(savedIds)));
    render();
  };

  resultsEl.addEventListener('click', function (e) {
    const saveBtn = e.target.closest('[data-save-id]');
    if (saveBtn) {
      e.preventDefault();
      window.toggleSave(saveBtn.getAttribute('data-save-id'));
      return;
    }
    const link = e.target.closest('[data-fr-extraction]');
    if (!link) return;
    const id = link.dataset.frExtraction;
    const s = allSources.find(function (x) { return String(x.id) === id; });
    if (s && window.BondsFundingContext) {
      const amount = Number(s.max_amount) || Number(s.min_amount) || 0;
      window.BondsFundingContext.set({
        source: 'sources',
        country: s.country_code,
        sector: s.sector,
        amount: amount > 0 ? amount : undefined,
        financingType: I18N.extractionType[s.type] || (isEn ? 'Other' : 'أخرى'),
        selectedSource: displayName(s)
      });
    }
    if (typeof gtag !== 'undefined') gtag('event', 'funding_sources_extraction_clicked', { source_id: id });
  });

  const debounce = (window.BondsCommon && window.BondsCommon.debounce)
    ? window.BondsCommon.debounce
    : function (fn) { return fn; };

  hydrateCustomOptions();
  applyCountryItems();
  loadTaxonomySectors();

  typeEl.addEventListener('change', function () {
    onFilterSelectChange(typeEl, applySearch);
  });
  countryEl.addEventListener('change', function () {
    onFilterSelectChange(countryEl, function () {
      syncCountries(countryEl, matchCountryEl);
      applySearch();
    });
  });
  if (matchCountryEl) {
    matchCountryEl.addEventListener('change', function () {
      onFilterSelectChange(matchCountryEl, function () {
        syncCountries(matchCountryEl, countryEl);
      });
    });
  }
  if (sectorEl) {
    sectorEl.addEventListener('change', function () {
      onFilterSelectChange(sectorEl, function () {
        syncSectors(sectorEl, matchSectorEl);
        applySearch();
      });
    });
  }
  if (matchSectorEl) {
    matchSectorEl.addEventListener('change', function () {
      onFilterSelectChange(matchSectorEl, function () {
        syncSectors(matchSectorEl, sectorEl);
      });
    });
  }
  if (matchCapitalEl) {
    matchCapitalEl.addEventListener('change', function () {
      onFilterSelectChange(matchCapitalEl, render);
    });
  }
  function applySearch() {
    if (allSources.length) render();
    else load();
  }

  if (searchEl) {
    searchEl.addEventListener('input', debounce(applySearch, 250));
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        applySearch();
      }
    });
  }

  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) searchBtn.addEventListener('click', applySearch);

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.title = I18N.resetTitle;
    resetBtn.addEventListener('click', function () {
      setSelectValue(typeEl, 'all');
      setSelectValue(countryEl, 'all');
      setSelectValue(matchCountryEl, 'all');
      setSelectValue(sectorEl, 'all');
      setSelectValue(matchSectorEl, 'all');
      setSelectValue(matchCapitalEl, 'all');
      if (searchEl) searchEl.value = '';
      load();
    });
  }

  const matchBtn = document.getElementById('matchBtn');
  if (matchBtn) {
    matchBtn.addEventListener('click', function () {
      syncCountries(matchCountryEl, countryEl);
      syncSectors(matchSectorEl, sectorEl);
      applySearch();
    });
  }

  const assistantBtn = document.getElementById('openAssistant');
  if (assistantBtn) {
    assistantBtn.addEventListener('click', function (e) {
      e.preventDefault();
      const toggle = document.querySelector('#bonds-ai-chat-root .bonds-ai-chat-toggle');
      if (toggle) {
        toggle.click();
        return;
      }
      window.location.href = isEn ? '../book.html' : 'book.html';
    });
  }

  load();
})();
