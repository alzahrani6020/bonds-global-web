/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const layout = fs.readFileSync(path.resolve(__dirname, '../../site-layout.js'), 'utf8');

function block(name) {
  const start = layout.indexOf(`const ${name} = [`);
  expect(start).toBeGreaterThan(-1);
  return layout.slice(start, layout.indexOf('\n    ];', start));
}

describe('header opportunities menu', () => {
  test('sits right after funding in the main navigation', () => {
    const funding = layout.indexOf("{ type: 'dropdown', label: labels.fundingGroup, items: fundingDropdown }");
    const opportunities = layout.indexOf("{ type: 'dropdown', navId: 'opportunities', label: labels.opportunitiesNav, items: opportunitiesDropdown }");
    const sectors = layout.indexOf("{ href: langBase + 'sectors.html', label: labels.sectors }");
    expect(funding).toBeGreaterThan(-1);
    expect(opportunities).toBeGreaterThan(funding);
    expect(sectors).toBeGreaterThan(opportunities);
  });

  test('is bilingual', () => {
    expect(layout).toContain("opportunitiesNav: isEn ? 'Deals' : 'الفرص'");
    expect(layout).toContain("dealWorkspace: isEn ? 'Deal Workspace' : 'مساحة الصفقات'");
    expect(layout).toContain("sharedDeals: isEn ? 'Shared with me' : 'فرص مشاركة معي'");
  });

  test('owns the discovery, analysis and deal groups', () => {
    const menu = block('opportunitiesDropdown');
    expect(menu).toContain('heading: { ar: labels.investmentDiscoveryGroup');
    expect(menu).toContain('heading: { ar: labels.investmentAnalysisGroup');
    expect(menu).toContain('heading: { ar: labels.dealsGroup');
    expect(menu).toContain('labels.investmentOpportunities');
    expect(menu).toContain('labels.opportunityBank');
    expect(menu).toContain('labels.opportunityValuation');
    expect(menu).toContain('labels.compareOpportunities');
    expect(menu).toContain('labels.dealWorkspace');
    expect(menu).toContain("dealsHref + '?view=shared'");
    expect(menu).not.toContain("dealsHref + '#dealSharedPanel'");
    expect(layout).toContain("const dealsHref = isEn ? '/en/my-bonds/deals/' : '/my-bonds/deals/';");
    expect(layout).not.toContain("const dealsHref = langBase + 'my-bonds/deals/';");
  });

  test('funding menu no longer duplicates the opportunity links', () => {
    const funding = block('fundingDropdown');
    expect(funding).not.toContain('labels.investmentOpportunities');
    expect(funding).not.toContain('labels.opportunityBank');
    expect(funding).not.toContain('investmentDiscoveryGroup');
    expect(funding).not.toContain('investmentAnalysisGroup');
    expect(funding).toContain('labels.fundingCases');
  });

  test('deal workspace sends signed-out users to the matching-language login and preserves the requested shared view', () => {
    const workspace = fs.readFileSync(path.resolve(__dirname, '../../components/deal-workspace.js'), 'utf8');
    expect(workspace).toContain("(EN?'/en/calculators/auth':'/calculators/auth')+'?redirect='");
    expect(workspace).toContain('location.pathname+location.search+location.hash');
  });
});
