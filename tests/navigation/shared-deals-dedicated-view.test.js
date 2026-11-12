/**
 * @jest-environment node
 */
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

describe('dedicated shared-deals view',()=>{
  test('header routes shared opportunities to view=shared, not an anchor-only scroll',()=>{
    const layout=read('site-layout.js');
    expect(layout).toContain("{ label: labels.sharedDeals, href: dealsHref + '?view=shared' }");
    expect(layout).not.toContain("dealsHref + '#dealSharedPanel'");
  });

  test('deal workspace hides owned/create surfaces in shared view and keeps shared list visible',()=>{
    const client=read('components/deal-workspace.js');
    expect(client).toContain("params.get('view')==='shared'");
    expect(client).toContain("if(sharedView)");
    expect(client).toContain("if(create)create.hidden=true");
    expect(client).toContain("if(title)title.hidden=true");
    expect(client).toContain("if(cards)cards.hidden=true");
    expect(client).toContain("if(sharedPanel)sharedPanel.hidden=false");
    expect(client).toContain("لا توجد فرص مشاركة معك بعد");
    expect(client).toContain("url.searchParams.set('view','shared')");
  });

  test('arabic and english pages expose mode-aware title hooks',()=>{
    const ar=read('my-bonds/deals/index.html');
    const en=read('en/my-bonds/deals/index.html');
    for(const html of [ar,en]){
      expect(html).toContain('id="dealPageTitle"');
      expect(html).toContain('id="dealPageSubtitle"');
      expect(html).toContain('id="dealBreadcrumbLabel"');
      expect(html).toContain('/components/deal-workspace.js?v=7');
    }
  });
});
