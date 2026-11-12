/**
 * @jest-environment node
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('investment header navigation uses root-absolute workspace routes', () => {
  test('valuation page cannot prefix My BONDS deal/workspace routes with /valuation/', () => {
    const source = read('site-layout.js');

    expect(source).toContain("const dealsHref = isEn ? '/en/my-bonds/deals/' : '/my-bonds/deals/'");
    expect(source).toContain("{ label: labels.sharedDeals, href: dealsHref + '?view=shared' }");
    expect(source).not.toContain("dealsHref + '#dealSharedPanel'");
    expect(source).toContain("const valuationHref = isEn ? '/en/valuation/index.html' : '/valuation/index.html'");
    expect(source).toContain("const investmentOpportunitiesHref = isEn ? '/en/investment-opportunities.html' : '/investment-opportunities.html'");
    expect(source).toContain("isEn ? '/en/my-bonds/workspace/?service=feasibility_studies' : '/my-bonds/workspace/?service=feasibility_studies'");
    expect(source).toContain("isEn ? '/en/my-bonds/workspace/?service=risk_analysis' : '/my-bonds/workspace/?service=risk_analysis'");

    expect(source).not.toContain("langBase + 'my-bonds/deals/'");
    expect(source).not.toContain("langBase + 'my-bonds/workspace/");

    const base = new URL('https://bonds-global.com/valuation/');
    expect(new URL('/my-bonds/deals/?view=shared', base).pathname).toBe('/my-bonds/deals/');
    expect(new URL('/my-bonds/deals/?view=shared', base).href).toBe(
      'https://bonds-global.com/my-bonds/deals/?view=shared'
    );
  });
});
