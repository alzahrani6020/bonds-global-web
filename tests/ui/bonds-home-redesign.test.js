/**
 * BONDS Global homepage redesign — static safety contracts.
 * Functional / visual browser verification remains a separate release gate.
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Bonds bilingual homepage redesign', () => {
  const pages = [
    {file:'index.html', lang:'ar', dir:'rtl', prefix:'/'},
    {file:'en/index.html', lang:'en', dir:'ltr', prefix:'/en/'}
  ];
  test.each(pages)('$file is explicitly localized and uses the new theme', ({file,lang,dir,prefix}) => {
    const html = read(file);
    expect(html).toContain('lang="'+lang+'" dir="'+dir+'"');
    expect(html).toMatch(/<body[^>]*class="bonds-redesign"/);
    expect(html).toContain('bonds-redesign-2026.css');
    expect(html).toContain('class="bonds-hero"');
    expect(html).toContain('class="bonds-quicklinks"');
    expect(html).toContain('id="site-header"');
    expect(html).toContain('id="site-footer"');
    expect(html).toContain('site-layout.js');
    expect(html).toContain('href="'+prefix+'calculators/investment-center/index.html"');
    expect(html).toContain('href="'+prefix+'my-bonds/"');
    expect(html).not.toContain('heritage-home');
    expect(html).not.toContain('fixed-income-landing.css');
    expect(html).not.toContain('canva-site-2026.css');
  });
  test('old public heritage theme is not injected into redesigned pages', () => {
    const js = read('site-layout.js');
    expect(js).toContain("if (!document.body.classList.contains('bonds-redesign')) ensurePublicHeritageIdentity();");
    expect(js).toContain('setupBondsLocalClock(headerContainer, lang)');
  });
  test('redesign-only brand elements do not alter other pages', () => {
    const js = read('site-layout.js');
    expect(js).toContain("redesignNav ? '<span class=\"bonds-brand-map\"");
    expect(js).toContain("redesignNav ? '<span class=\"bonds-brand-wordmark\"");
  });
  test('clock uses browser timezone with user override and no geolocation', () => {
    const js = read('site-layout.js');
    expect(js).toContain('Intl.DateTimeFormat().resolvedOptions().timeZone');
    expect(js).toContain("localStorage.setItem('bonds:timezone', selected)");
    expect(js).toContain('islamic-umalqura');
    expect(js).not.toContain('navigator.geolocation');
  });
  test('hero photo fills the frame without imposing full inset or height on globe overlay', () => {
    const css = read('styles/bonds-redesign-2026.css');
    expect(css).toContain('.bonds-hero__image img.bonds-hero__photo{position:absolute;inset:0;');
    expect(css).not.toMatch(/\.bonds-hero__image img\s*\{[^}]*inset\s*:\s*0/);
    expect(css).toContain('body.bonds-redesign .bonds-hero__globe{position:absolute;');
    expect(css).toContain('html[dir="ltr"] body.bonds-redesign .bonds-hero__globe');
  });
  test('English desktop cards reserve icon space on their left without affecting Arabic', () => {
    const css = read('styles/bonds-redesign-2026.css');
    expect(css).toMatch(/html\[dir="ltr"\] body\.bonds-redesign \.bonds-quicklink\s*\{\s*padding:20px 15px 18px 82px;/);
  });
  test('new theme has matching responsive and direction rules', () => {
    const css = read('styles/bonds-redesign-2026.css');
    expect(css).toContain('html[dir="ltr"] body.bonds-redesign');
    expect(css).toContain('@media(max-width:1280px)');
    expect(css).toContain('@media(max-width:700px)');
    expect(css).toContain('.bonds-topbar');
  });
});
