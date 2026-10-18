const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('public header responsive contract', () => {
  const css = read('header-footer.css');
  const layout = read('site-layout.js');
  const feasibilityCss = read('calculators/feasibility-template-shared.css');

  test('CSS and JS collapse navigation at the same width', () => {
    expect(layout).toContain('const NAV_COLLAPSE_WIDTH = 1280;');
    expect(layout).toContain('window.innerWidth <= NAV_COLLAPSE_WIDTH');
    expect(layout).not.toContain('window.innerWidth <= 900');

    expect(css).toContain('@media (max-width: 1280px)');
    expect(css).toContain('@media (min-width: 1281px)');
    expect(css).not.toContain('@media (max-width: 900px)');
    expect(css).not.toContain('min-width: 901px');
  });

  test('authenticated user name cannot expand the header without bound', () => {
    expect(css).toContain('#authContainer .bonds-user-menu > span:first-of-type');
    expect(css).toContain('max-width: 8rem;');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('text-overflow: ellipsis;');
    expect(css).toContain('white-space: nowrap;');
  });

  test('feasibility toolbar sticks below the fixed site header', () => {
    expect(feasibilityCss).toContain(
      '.template-toolbar { position:sticky; top:var(--header-height, 64px);'
    );
    expect(feasibilityCss).not.toContain('.template-toolbar { position:sticky; top:0;');
  });
});
