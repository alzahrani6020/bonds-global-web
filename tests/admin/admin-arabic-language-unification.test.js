/** @jest-environment node */
const fs=require('fs');
const path=require('path');

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

describe('Admin bilingual language unification',()=>{
  const dashboard=read('admin/dashboard.html');
  const i18n=read('admin/admin-i18n.js');
  const locale=read('admin/admin-locale.js');

  test('dashboard loads only the central Admin i18n source',()=>{
    expect(dashboard).toContain('/admin/admin-i18n.js?v=2');
    expect(dashboard).not.toContain('/admin/admin-locale.js');
    expect(dashboard).not.toContain('shellLabels');
  });

  test('every embedded admin page is normalized through the central i18n contract',()=>{
    expect(dashboard).toContain('adminI18n?.bind(doc)');
    expect(dashboard).toContain("doc.documentElement.lang = locale");
    expect(dashboard).toContain("doc.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'");
    expect(dashboard).toContain("postMessage({ type: 'admin-locale', locale }");
  });

  test('central dictionary covers the visible mixed-language control-center labels in both languages',()=>{
    for(const key of [
      'bondsUnifiedControlCenter','dualCoreControlSurface','assistant','learning','training',
      'evolution','capabilities','models','approvals','releases','health','audit',
      'selfTraining','normalEmergencyFullStop'
    ]) {
      expect(i18n).toContain(key + ':');
    }
    expect(i18n).toContain("bondsUnifiedControlCenter: 'مركز التحكم الموحد لبوندز'");
    expect(i18n).toContain("bondsUnifiedControlCenter: 'BONDS Unified Control Center'");
  });

  test('locale shim no longer forces Arabic or watches dynamic content',()=>{
    expect(locale).toContain('global.BondsAdminI18n');
    expect(locale).not.toContain("html.setAttribute('lang','ar')");
    expect(locale).not.toContain("html.setAttribute('dir','rtl')");
    expect(locale).not.toContain('new MutationObserver');
    expect(locale).not.toMatch(/\bEXACT\b|\bPHRASES\b/);
  });

  test('central binder skips scripts, styles and code blocks',()=>{
    expect(i18n).toContain("['SCRIPT','STYLE','CODE','PRE','TEXTAREA']");
  });
});
