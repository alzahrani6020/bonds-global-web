const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

describe('funding sources filter dropdowns', () => {
  const ar = read('funding-sources.html');
  const en = read('en/funding-sources.html');
  const page = read('scripts/funding-sources-page.js');

  test('Arabic page uses real selects with add actions', () => {
    expect(ar).toMatch(/<select[^>]*id="matchSector"/);
    expect(ar).toMatch(/<select[^>]*id="filterSector"/);
    expect(ar).toMatch(/<select[^>]*id="matchCapital"/);
    expect(ar).not.toMatch(/<input type="text" id="matchSector"/);
    expect(ar).not.toMatch(/<input type="number" id="matchCapital"/);
    expect(ar).toContain('data-ud-theme="light"');
    expect(ar).not.toContain('data-ud-fixed="true"');
    expect(ar).toContain('value="__add_sector__"');
    expect(ar).toContain('value="__add_capital__"');
    expect(ar).toContain('value="__add_country__"');
  });

  test('English page mirrors the dropdowns', () => {
    expect(en).toMatch(/<select[^>]*id="matchSector"/);
    expect(en).toMatch(/<select[^>]*id="matchCapital"/);
    expect(en).toContain('value="__add_sector__"');
    expect(en).toContain('value="__add_capital__"');
  });

  test('page logic persists custom options and parses capital ranges', () => {
    expect(page).toContain('bonds_funding_custom_sectors');
    expect(page).toContain("mode: 'range'");
    expect(page).toContain('__add_sector__');
  });

  test('sector dropdowns load the canonical taxonomy used in the header', () => {
    expect(page).toContain('/api/v3/investment-taxonomy?depth=sector');
    expect(page).toContain('loadTaxonomySectors');
    expect(ar).toContain('data-ud-search-placeholder="ابحث عن قطاع..."');
    expect(en).toContain('data-ud-search-placeholder="Search for a sector..."');
    expect(ar).not.toContain('value="technology">تقنية');
    expect(ar).not.toContain('value="food">غذاء ومطاعم');
    expect(en).not.toContain('value="food">Food & restaurants');
  });

  test('search button sits beside the input and reset copy is explicit', () => {
    expect(ar).toContain('class="search-combo"');
    expect(en).toContain('class="search-combo"');
    expect(ar).toMatch(/<div class="search-combo">[\s\S]*id="filterSearch"[\s\S]*id="searchBtn"/);
    expect(en).toMatch(/<div class="search-combo">[\s\S]*id="filterSearch"[\s\S]*id="searchBtn"/);
    expect(ar).toContain('مسح الفلاتر');
    expect(en).toContain('Clear filters');
    expect(page).toContain('function normalizeSearch');
    expect(page).toContain('ignoreCountry');
    expect(page).toContain('widenedCountry');
  });

  test('page links the directory to hub tools, engines and the assistant', () => {
    expect(ar).toContain('id="openAssistant"');
    expect(en).toContain('id="openAssistant"');
    expect(ar).toContain('href="funding-readiness.html"');
    expect(ar).toContain('href="funding-extraction.html"');
    expect(ar).toContain('href="calculators/loan.html"');
    expect(ar).toContain('href="directory/"');
    expect(ar).toContain('href="v3/project/"');
    expect(ar).toContain('href="v3/portfolio/"');
    expect(en).toContain('href="../calculators/loan.html"');
    expect(en).toContain('href="../v3/project/"');
    expect(page).toContain('bonds-ai-chat-toggle');
  });
});
