/** @jest-environment node */
const fs=require('fs');
const path=require('path');

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

describe('Admin Arabic language unification',()=>{
  const dashboard=read('admin/dashboard.html');
  const locale=read('admin/admin-locale.js');

  test('dashboard loads the shared Arabic locale layer',()=>{
    expect(dashboard).toContain('/admin/admin-locale.js?v=1');
    expect(dashboard).toContain('BondsAdminLocale.applyToDocument(document)');
  });

  test('every embedded admin page is normalized after iframe load',()=>{
    expect(dashboard).toContain('BondsAdminLocale.applyToDocument(iframe.contentDocument)');
  });

  test('shared locale covers the visible mixed-language control-center labels',()=>{
    for(const value of [
      "'BONDS Unified Control Center':'مركز التحكم الموحد لبوندز'",
      "'Dual-Core Control Surface':'سطح التحكم ثنائي النواة'",
      "'Assistant':'المساعد'",
      "'Learning':'التعلم'",
      "'Training':'التدريب'",
      "'Evolution':'التطور'",
      "'Capabilities':'القدرات'",
      "'Models':'النماذج'",
      "'Approvals':'الموافقات'",
      "'Releases':'الإصدارات'",
      "'Health':'الصحة التشغيلية'",
      "'Audit':'سجل المراجعة'",
      "['Self-Training','التدريب الذاتي']",
      "['Normal / Emergency / Full Stop','عادي / طوارئ / إيقاف كامل']"
    ]) expect(locale).toContain(value);
  });

  test('locale forces Arabic direction and watches dynamic content',()=>{
    expect(locale).toContain("html.setAttribute('lang','ar')");
    expect(locale).toContain("html.setAttribute('dir','rtl')");
    expect(locale).toContain('new MutationObserver');
    expect(locale).toContain('childList:true');
    expect(locale).toContain('subtree:true');
  });

  test('scripts, styles and code blocks are not rewritten',()=>{
    expect(locale).toContain("['SCRIPT','STYLE','CODE','PRE','TEXTAREA']");
  });
});
