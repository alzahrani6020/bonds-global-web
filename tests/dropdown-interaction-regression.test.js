const fs = require('fs');
const path = require('path');

describe('Dropdown interaction regression', () => {
  const root = path.resolve(__dirname, '..');
  const headerCss = fs.readFileSync(path.join(root, 'header-footer.css'), 'utf8');
  const siteLayout = fs.readFileSync(path.join(root, 'site-layout.js'), 'utf8');
  const udCss = fs.readFileSync(path.join(root, 'components/universal-dropdown.css'), 'utf8');
  const udJs = fs.readFileSync(path.join(root, 'components/universal-dropdown.js'), 'utf8');

  test('desktop header dropdowns are opened only by explicit is-open state', () => {
    expect(headerCss).toContain('Explicit dropdown interaction state v2.70.0');
    expect(headerCss).toMatch(/\.main-header \.dropdown:hover > \.dropdown-menu\s*\{[\s\S]*?pointer-events:\s*none\s*!important/);
    expect(headerCss).toMatch(/\.main-header \.dropdown\.is-open > \.dropdown-menu\s*\{[\s\S]*?pointer-events:\s*auto\s*!important/);
  });

  test('desktop header logic opens from trigger pointerenter and supports Escape', () => {
    expect(siteLayout).toContain("toggle.addEventListener('pointerenter', scheduleOpen)");
    expect(siteLayout).toContain("menu.addEventListener('pointerenter'");
    expect(siteLayout).toContain("if (e.key === 'Escape')");
    expect(siteLayout).not.toContain("desktop hover handles it");
  });

  test('universal dropdown has readable explicit colors in both default and light contexts', () => {
    expect(udCss).toContain('Contrast hardening v2.52.0');
    expect(udCss).toMatch(/\.ud-dropdown \.ud-item\s*\{[\s\S]*?color:\s*var\(--ud-text\)\s*!important/);
    expect(udCss).toMatch(/\.ud-dropdown\[data-ud-theme="light"\] \.ud-item\s*\{[\s\S]*?color:\s*#142238\s*!important/);
    expect(udCss).toMatch(/\.ud-menu:not\(\.ud-open\)\s*\{[\s\S]*?pointer-events:\s*none\s*!important/);
  });

  test('public pages default UniversalDropdown to light unless dark is explicit', () => {
    expect(udJs).toContain("if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;");
    expect(udJs).toContain("return 'light';");
  });
});
