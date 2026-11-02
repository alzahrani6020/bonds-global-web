/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('header hover and automated refresh stabilization', () => {
  test('desktop dropdown cannot be opened by hovering the detached menu footprint', () => {
    const css = read('header-footer.css');
    expect(css).not.toContain('.dropdown:hover > .dropdown-menu');
    expect(css).not.toContain('.dropdown:hover > .dropdown-menu--grouped');
    expect(css).toContain('.dropdown-menu {\n  pointer-events: none;');
    expect(css).toContain('.dropdown.is-open > .dropdown-menu');
    expect(css).toContain('pointer-events: auto;');
  });

  test('shared header CSS cache version is bumped', () => {
    const layout = read('site-layout.js');
    expect(layout).toContain("/header-footer.css?v=2.71.0");
  });

  test('V3 high-traffic intelligence pages request the new shared layout version', () => {
    for (const file of [
      'v3/opportunity-bank.html',
      'v3/city-intelligence.html',
      'v3/investment-map.html',
      'v3/city-comparison.html',
      'v3/project-readiness.html',
      'v3/scenarios.html'
    ]) {
      expect(read(file)).toContain('site-layout.js?v=3.4.0');
    }
    expect(read('contact.html')).toContain('site-layout.js?v=3.8.4');
  });

  test('market refresh has a daily Vercel cron and bearer-authenticated endpoint', () => {
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.rewrites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: '/api/market-intelligence-cron',
        destination: '/api/reference-data?__route=market-intelligence-cron'
      })
    ]));
    expect(vercel.crons).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/api/market-intelligence-cron', schedule: '15 1 * * *' })
    ]));

    const api = read('api/reference-data.js');
    expect(api).toContain('async function handleMarketIntelligenceCron');
    expect(api).toContain("authHeader !== `Bearer ${secret}`");
    expect(api).toContain('normalizeScheduledSourceUrl');
    expect(api).toContain("url.searchParams.delete('date')");
    expect(api).toContain('inferRecordedAt(rec, now)');
  });

  test('city intelligence can show sourced national context without pretending it is city data', () => {
    const api = read('v3/api/index.js');
    const page = read('v3/city-intelligence.html');
    expect(api).toContain('async function handleCountryContext');
    expect(api).toContain("geographic_scope: 'country'");
    expect(page).toContain('أحدث سياق اقتصادي وطني متاح');
    expect(page).toContain('هذه القيم على مستوى الدولة وليست قيماً خاصة بالمدينة');
    expect(page).toContain('/context');
  });

  test('governance dropdown exposes KYC intake in both languages', () => {
    const layout = read('site-layout.js');
    expect(layout).toContain("kyc: isEn ? 'Know Your Customer (KYC)' : 'اعرف عميلك (KYC)'");
    expect(layout).toContain("const kycHref = isEn ? '/en/client/kyc' : '/client/kyc';");
    expect(layout).toContain('{ label: labels.kyc, href: kycHref }');
  });

  test('funding dropdown exposes one organized funding-file entry point instead of raw form links', () => {
    const layout = read('site-layout.js');
    expect(layout).not.toContain("heading: { ar: 'نماذج', en: 'Forms' }");
    expect(layout).toContain("fundingFileGroup: isEn ? 'Funding File' : 'ملف التمويل'");
    expect(layout).toContain("fundingRequirements: isEn ? 'Requirements & Forms' : 'المتطلبات والنماذج'");
    expect(layout).toContain("fundingCases: isEn ? 'Funding Cases' : 'حالات التمويل'");
    expect(layout).toContain("const fundingCasesHref = isEn ? '/en/client/funding-cases' : '/client/funding-cases';");
    expect(layout).toContain("const fundingRequirementsHref = fundingExtractionHref + '#funding-file';");
    expect(layout).toContain('{ label: labels.fundingCases, href: fundingCasesHref }');
    expect(layout).toContain('{ label: labels.fundingRequirements, href: fundingRequirementsHref }');
    expect(layout).toContain('{ label: labels.clientPortalNav, href: clientPortalHref }');
    expect(read('funding-extraction.html')).toContain('id="funding-file"');
    expect(read('funding-extraction.html')).toContain('data-funding-file-grid');
    expect(read('en/funding-extraction.html')).toContain('id="funding-file"');
    expect(read('en/funding-extraction.html')).toContain('data-funding-file-grid');
  });
});
