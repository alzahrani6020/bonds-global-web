const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

describe('Admin i18n and executive analytics resilience',()=>{
  test('admin shell exposes persisted AR/EN locale switch and syncs locale to iframe',()=>{
    const dash=read('admin/dashboard.html');
    const i18n=read('admin/admin-i18n.js');
    expect(dash).toContain('id="languageToggle"');
    expect(dash).toContain("type: 'admin-locale'");
    expect(dash).toContain('applyShellLocale');
    expect(i18n).toContain("bonds-admin-locale");
    expect(i18n).toContain("document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'");
    expect(i18n).toContain("supported: ['ar', 'en']");
  });

  test('embedded admin modules accept same-origin locale context',()=>{
    const embed=read('admin/admin-embed.js');
    expect(embed).toContain("e.origin !== location.origin");
    expect(embed).toContain("e.source !== window.parent");
    expect(embed).toContain("e.data.type === 'admin-locale'");
    expect(embed).toContain('applyEmbeddedLocale');
  });

  test('executive analytics degrades by source instead of failing the whole dashboard',()=>{
    const api=read('api/admin.js');
    expect(api).toContain('const sourceQueries=[');
    expect(api).toContain('Promise.allSettled(sourceQueries.map');
    expect(api).toContain("status:'unavailable'");
    expect(api).toContain("status:Object.values(sourceStatus).some");
    expect(api).toContain('sources:sourceStatus');
  });

  test('executive analytics UI localizes labels, formats locale-aware values and surfaces request ids',()=>{
    const page=read('admin/executive-ai-analytics.html');
    expect(page).toContain('/admin/admin-i18n.js');
    expect(page).toContain('data-i18n="executiveAnalytics"');
    expect(page).toContain('I.formatCurrency');
    expect(page).toContain('Promise.allSettled');
    expect(page).toContain("requestId");
    expect(page).toContain('killSwitchList');
    expect(page).toContain('promptVersionList');
  });
});
